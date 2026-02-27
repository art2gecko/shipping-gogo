import { ChannelType, AuditAction, ExceptionType } from "@prisma/client";
import { prisma } from "../db/client";
import { getOrCreateOrderByExternalId, recordAudit, recordException } from "../db/operations";
import { getProvider } from "./channels";
import { decrypt, encrypt } from "./tokenService";
import type { FetchOrdersParams, NormalizedOrder } from "./channels";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CHANNEL_NAME_MAP: Record<ChannelType, string> = {
  AMAZON: "amazon",
  EBAY: "ebay",
  WALMART: "walmart",
  TEMU: "temu",
  OTHER: "other",
};

/**
 * Get a valid access token for the account, refreshing if needed.
 */
async function getAccessToken(accountId: string): Promise<string> {
  const account = await prisma.channelAccount.findUniqueOrThrow({
    where: { id: accountId },
  });

  const channelName = CHANNEL_NAME_MAP[account.channel];
  const provider = getProvider(channelName);

  // Refresh if token is expired or will expire within 60s
  if (
    account.refreshTokenEncrypted &&
    (!account.tokenExpiresAt || account.tokenExpiresAt < new Date(Date.now() + 60_000))
  ) {
    const refreshToken = decrypt(account.refreshTokenEncrypted);
    const result = await provider.refreshAccessToken(refreshToken);

    await prisma.channelAccount.update({
      where: { id: account.id },
      data: {
        accessTokenEncrypted: encrypt(result.accessToken),
        tokenExpiresAt: new Date(Date.now() + result.expiresIn * 1000),
      },
    });

    return result.accessToken;
  }

  if (!account.accessTokenEncrypted) {
    throw new Error(`No access token available for account ${accountId}`);
  }

  return decrypt(account.accessTokenEncrypted);
}

// ─── Sync Orders ─────────────────────────────────────────────────────────────

export interface SyncResult {
  accountId: string;
  channel: ChannelType;
  imported: number;
  skipped: number;
  errors: number;
  nextToken?: string;
}

/**
 * Sync orders from a single marketplace account.
 * Fetches orders from the marketplace API and upserts them into our DB.
 */
export async function syncOrdersForAccount(
  accountId: string,
  params: FetchOrdersParams = {},
): Promise<SyncResult> {
  const account = await prisma.channelAccount.findUniqueOrThrow({
    where: { id: accountId },
  });

  const channelName = CHANNEL_NAME_MAP[account.channel];
  const provider = getProvider(channelName);
  const accessToken = await getAccessToken(accountId);

  // Default: sync orders from last sync time, or last 24h
  if (!params.createdAfter && !params.updatedAfter && !params.nextToken) {
    const since = account.lastSyncedAt || new Date(Date.now() - 24 * 60 * 60 * 1000);
    params.createdAfter = since.toISOString();
  }

  let imported = 0;
  let skipped = 0;
  let errors = 0;
  let nextToken: string | undefined;

  try {
    const result = await provider.fetchOrders(accessToken, params);
    nextToken = result.nextToken;

    for (const order of result.orders) {
      try {
        const { created } = await getOrCreateOrderByExternalId(
          account.channel,
          order.externalOrderId,
          {
            buyerName: order.buyerName,
            shipToName: order.shipToName,
            shipToAddress1: order.shipToAddress1,
            shipToAddress2: order.shipToAddress2,
            shipToCity: order.shipToCity,
            shipToState: order.shipToState,
            shipToZip: order.shipToZip,
            shipToCountry: order.shipToCountry,
            orderDate: order.orderDate,
            items: order.items,
          },
        );

        // Link the order to this channel account
        if (created) {
          const dbOrder = await prisma.order.findUnique({
            where: {
              channel_externalOrderId: {
                channel: account.channel,
                externalOrderId: order.externalOrderId,
              },
            },
          });
          if (dbOrder && !dbOrder.channelAccountId) {
            await prisma.order.update({
              where: { id: dbOrder.id },
              data: { channelAccountId: accountId },
            });
          }
          imported++;
        } else {
          skipped++;
        }
      } catch (err) {
        errors++;
        console.error(`  Failed to import order ${order.externalOrderId}:`, err);
        await recordException({
          type: ExceptionType.UNKNOWN,
          message: `Order import failed for ${order.externalOrderId}: ${(err as Error).message}`,
        });
      }
    }

    // Update last sync timestamp
    await prisma.channelAccount.update({
      where: { id: accountId },
      data: { lastSyncedAt: new Date() },
    });

    await recordAudit({
      action: AuditAction.ORDER_IMPORTED,
      detail: `Synced ${channelName}: ${imported} imported, ${skipped} existing, ${errors} failed`,
      metadata: { accountId, channel: channelName, imported, skipped, errors },
    });
  } catch (err) {
    console.error(`Order sync failed for account ${accountId}:`, err);

    await prisma.channelAccount.update({
      where: { id: accountId },
      data: { status: "ERROR" },
    });

    await recordException({
      type: ExceptionType.API_AUTH_FAILED,
      message: `Order sync failed for ${channelName} account ${account.accountName}: ${(err as Error).message}`,
    });

    throw err;
  }

  return { accountId, channel: account.channel, imported, skipped, errors, nextToken };
}

/**
 * Sync orders for all active accounts across all channels.
 */
export async function syncAllAccounts(): Promise<SyncResult[]> {
  const accounts = await prisma.channelAccount.findMany({
    where: { status: "OK" },
    orderBy: { lastSyncedAt: "asc" },
  });

  console.log(`Syncing orders for ${accounts.length} active accounts...`);
  const results: SyncResult[] = [];

  for (const account of accounts) {
    try {
      // Paginate through all pages
      let nextToken: string | undefined;
      let totalImported = 0;
      let totalSkipped = 0;
      let totalErrors = 0;

      do {
        const result = await syncOrdersForAccount(account.id, { nextToken });
        totalImported += result.imported;
        totalSkipped += result.skipped;
        totalErrors += result.errors;
        nextToken = result.nextToken;
      } while (nextToken);

      results.push({
        accountId: account.id,
        channel: account.channel,
        imported: totalImported,
        skipped: totalSkipped,
        errors: totalErrors,
      });
    } catch (err) {
      console.error(`Sync failed for ${account.channel} / ${account.accountName}:`, err);
      results.push({
        accountId: account.id,
        channel: account.channel,
        imported: 0,
        skipped: 0,
        errors: 1,
      });
    }
  }

  return results;
}
