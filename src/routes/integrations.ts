import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../db/client";
import { encrypt, decrypt } from "../services/tokenService";
import { getProvider } from "../services/channels";
import type { ChannelType } from "@prisma/client";

const router = Router();

const VALID_CHANNELS = ["amazon", "ebay", "temu"] as const;
type ValidChannel = (typeof VALID_CHANNELS)[number];

const CHANNEL_ENUM_MAP: Record<ValidChannel, ChannelType> = {
  amazon: "AMAZON",
  ebay: "EBAY",
  temu: "TEMU",
};

function validateChannel(channel: string): channel is ValidChannel {
  return VALID_CHANNELS.includes(channel as ValidChannel);
}

// ─── Credential field definitions per channel ────────────────────────────────

interface CredentialField {
  envKey: string;
  label: string;
  secret: boolean;
  defaultValue?: string;
}

const CHANNEL_CREDENTIAL_FIELDS: Record<ValidChannel, CredentialField[]> = {
  ebay: [
    { envKey: "EBAY_CLIENT_ID", label: "Client ID", secret: false },
    { envKey: "EBAY_CLIENT_SECRET", label: "Client Secret", secret: true },
    { envKey: "EBAY_REDIRECT_URI", label: "Redirect URI", secret: false, defaultValue: "http://localhost:3000/api/integrations/ebay/callback" },
  ],
  amazon: [
    { envKey: "AMAZON_LWA_CLIENT_ID", label: "LWA Client ID", secret: false },
    { envKey: "AMAZON_LWA_CLIENT_SECRET", label: "LWA Client Secret", secret: true },
    { envKey: "AMAZON_REDIRECT_URI", label: "Redirect URI", secret: false, defaultValue: "http://localhost:3000/api/integrations/amazon/callback" },
  ],
  temu: [
    { envKey: "TEMU_APP_KEY", label: "App Key", secret: false },
    { envKey: "TEMU_APP_SECRET", label: "App Secret", secret: true },
    { envKey: "TEMU_REDIRECT_URI", label: "Redirect URI", secret: false, defaultValue: "http://localhost:3000/api/integrations/temu/callback" },
  ],
};

/** Load saved credentials from the Settings table into process.env so providers can read them. */
async function loadChannelCredentials(channel: ValidChannel): Promise<void> {
  const fields = CHANNEL_CREDENTIAL_FIELDS[channel];
  for (const field of fields) {
    // Only load from DB if not already set in environment
    if (!process.env[field.envKey]) {
      const setting = await prisma.setting.findUnique({
        where: { key: `cred:${field.envKey}` },
      });
      if (setting) {
        process.env[field.envKey] = field.secret ? decrypt(setting.value) : setting.value;
      } else if (field.defaultValue) {
        process.env[field.envKey] = field.defaultValue;
      }
    }
  }
}

// ─── GET /api/integrations/:channel/credentials ─────────────────────────────
// Check which credentials are configured (does NOT return secret values)
router.get("/:channel/credentials", async (req, res) => {
  try {
    const { channel } = req.params;
    if (!validateChannel(channel)) {
      res.status(400).json({ error: `Invalid channel: ${channel}` });
      return;
    }

    const fields = CHANNEL_CREDENTIAL_FIELDS[channel];
    const result: { key: string; label: string; secret: boolean; configured: boolean; value?: string }[] = [];

    for (const field of fields) {
      // Check env first, then DB
      const envValue = process.env[field.envKey];
      const dbSetting = await prisma.setting.findUnique({
        where: { key: `cred:${field.envKey}` },
      });

      const configured = !!(envValue || dbSetting || field.defaultValue);
      result.push({
        key: field.envKey,
        label: field.label,
        secret: field.secret,
        configured,
        // Return non-secret values so the form can show them; never return secrets
        value: !field.secret
          ? (dbSetting ? dbSetting.value : envValue || field.defaultValue || "")
          : undefined,
      });
    }

    res.json(result);
  } catch (err) {
    console.error("Get credentials error:", err);
    res.status(500).json({ error: "Failed to get credentials" });
  }
});

// ─── POST /api/integrations/:channel/credentials ────────────────────────────
// Save channel API credentials (stored encrypted in Settings table)
router.post("/:channel/credentials", async (req, res) => {
  try {
    const { channel } = req.params;
    if (!validateChannel(channel)) {
      res.status(400).json({ error: `Invalid channel: ${channel}` });
      return;
    }

    const credentials = req.body as Record<string, string>;
    const fields = CHANNEL_CREDENTIAL_FIELDS[channel];
    const saved: string[] = [];

    for (const field of fields) {
      const value = credentials[field.envKey];
      if (value !== undefined && value !== "") {
        const storeValue = field.secret ? encrypt(value) : value;
        await prisma.setting.upsert({
          where: { key: `cred:${field.envKey}` },
          update: { value: storeValue },
          create: { key: `cred:${field.envKey}`, value: storeValue },
        });
        // Also set in process.env so it takes effect immediately
        process.env[field.envKey] = value;
        saved.push(field.label);
      }
    }

    // Audit log — don't let this block credential saving
    prisma.auditLog.create({
      data: {
        action: "INTEGRATION_CREDENTIALS",
        detail: `Updated ${channel} credentials: ${saved.join(", ")}`,
        metadata: { channel },
      },
    }).catch(() => {/* enum may not exist in DB yet */});

    res.json({ message: `Saved ${saved.length} credential(s) for ${channel}` });
  } catch (err) {
    console.error("Save credentials error:", err);
    res.status(500).json({ error: "Failed to save credentials" });
  }
});

// ─── GET /api/integrations/:channel/accounts ────────────────────────────────
// List connected accounts for a channel
router.get("/:channel/accounts", async (req, res) => {
  try {
    const { channel } = req.params;
    if (!validateChannel(channel)) {
      res.status(400).json({ error: `Invalid channel: ${channel}` });
      return;
    }

    const accounts = await prisma.channelAccount.findMany({
      where: { channel: CHANNEL_ENUM_MAP[channel] },
      select: {
        id: true,
        channel: true,
        accountName: true,
        externalSellerId: true,
        status: true,
        scopes: true,
        lastSyncedAt: true,
        tokenExpiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(accounts);
  } catch (err) {
    console.error("List accounts error:", err);
    res.status(500).json({ error: "Failed to list accounts" });
  }
});

// ─── GET /api/integrations/:channel/start ───────────────────────────────────
// Generate OAuth state nonce and redirect URL
router.get("/:channel/start", async (req, res) => {
  try {
    const { channel } = req.params;
    if (!validateChannel(channel)) {
      res.status(400).json({ error: `Invalid channel: ${channel}` });
      return;
    }

    // Load saved credentials from DB into process.env
    await loadChannelCredentials(channel);

    const provider = getProvider(channel);

    // Generate CSRF state nonce and store in DB
    const state = crypto.randomBytes(32).toString("hex");
    await prisma.integrationState.create({
      data: {
        state,
        channel: CHANNEL_ENUM_MAP[channel],
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });

    const authUrl = provider.getAuthUrl(state);
    res.json({ authUrl, state });
  } catch (err) {
    console.error("OAuth start error:", err);
    res.status(500).json({ error: "Failed to start OAuth flow" });
  }
});

// ─── GET /api/integrations/:channel/callback ────────────────────────────────
// Handle OAuth callback: validate state, exchange code, store tokens
router.get("/:channel/callback", async (req, res) => {
  try {
    const { channel } = req.params;
    const { code, state } = req.query;

    if (!validateChannel(channel)) {
      res.status(400).json({ error: `Invalid channel: ${channel}` });
      return;
    }

    if (!code || !state) {
      res.status(400).json({ error: "Missing code or state parameter" });
      return;
    }

    // Validate CSRF state
    const stateRecord = await prisma.integrationState.findUnique({
      where: { state: state as string },
    });

    if (!stateRecord) {
      res.status(403).json({ error: "Invalid state parameter (CSRF check failed)" });
      return;
    }

    if (stateRecord.expiresAt < new Date()) {
      await prisma.integrationState.delete({ where: { id: stateRecord.id } });
      res.status(403).json({ error: "State expired, please try again" });
      return;
    }

    if (stateRecord.channel !== CHANNEL_ENUM_MAP[channel]) {
      res.status(403).json({ error: "State channel mismatch" });
      return;
    }

    // Clean up used state
    await prisma.integrationState.delete({ where: { id: stateRecord.id } });

    // Load saved credentials from DB into process.env
    await loadChannelCredentials(channel);

    const provider = getProvider(channel);

    // Exchange authorization code for tokens
    const tokens = await provider.exchangeCode(code as string);

    // Fetch seller identity
    const identity = await provider.fetchSellerIdentity(tokens.accessToken);

    const channelEnum = CHANNEL_ENUM_MAP[channel];

    // Idempotency: upsert based on (channel, externalSellerId)
    const account = await prisma.channelAccount.upsert({
      where: {
        channel_externalSellerId: {
          channel: channelEnum,
          externalSellerId: identity.externalSellerId,
        },
      },
      update: {
        accountName: identity.accountName || `${channel} account`,
        refreshTokenEncrypted: encrypt(tokens.refreshToken),
        accessTokenEncrypted: encrypt(tokens.accessToken),
        tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        scopes: tokens.scopes || null,
        status: "OK",
      },
      create: {
        channel: channelEnum,
        accountName: identity.accountName || `${channel} account`,
        externalSellerId: identity.externalSellerId,
        refreshTokenEncrypted: encrypt(tokens.refreshToken),
        accessTokenEncrypted: encrypt(tokens.accessToken),
        tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        scopes: tokens.scopes || null,
        status: "OK",
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "INTEGRATION_CONNECT",
        detail: `Connected ${channel} account: ${account.accountName}`,
        metadata: {
          channelAccountId: account.id,
          channel,
          externalSellerId: identity.externalSellerId,
        },
      },
    });

    // Redirect back to integrations page with success
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendUrl}/settings/integrations?connected=${channel}&account=${account.id}`);
  } catch (err) {
    console.error("OAuth callback error:", err);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendUrl}/settings/integrations?error=${encodeURIComponent((err as Error).message)}`);
  }
});

// ─── POST /api/integrations/:channel/test ───────────────────────────────────
// Test connection for a specific account
router.post("/:channel/test", async (req, res) => {
  try {
    const { channel } = req.params;
    const { accountId } = req.body;

    if (!validateChannel(channel)) {
      res.status(400).json({ error: `Invalid channel: ${channel}` });
      return;
    }

    if (!accountId) {
      res.status(400).json({ error: "accountId is required" });
      return;
    }

    const account = await prisma.channelAccount.findUnique({
      where: { id: accountId },
    });

    if (!account || account.channel !== CHANNEL_ENUM_MAP[channel]) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    await loadChannelCredentials(channel);
    const provider = getProvider(channel);

    // Refresh access token if expired or about to expire
    let accessToken: string;
    if (
      account.refreshTokenEncrypted &&
      (!account.tokenExpiresAt || account.tokenExpiresAt < new Date(Date.now() + 60_000))
    ) {
      try {
        const refreshToken = decrypt(account.refreshTokenEncrypted);
        const refreshResult = await provider.refreshAccessToken(refreshToken);
        accessToken = refreshResult.accessToken;

        // Update stored access token
        await prisma.channelAccount.update({
          where: { id: account.id },
          data: {
            accessTokenEncrypted: encrypt(refreshResult.accessToken),
            tokenExpiresAt: new Date(Date.now() + refreshResult.expiresIn * 1000),
          },
        });
      } catch (refreshErr) {
        // Mark as needs reauth on refresh failure
        await prisma.channelAccount.update({
          where: { id: account.id },
          data: { status: "NEEDS_REAUTH" },
        });

        await prisma.auditLog.create({
          data: {
            action: "INTEGRATION_TEST",
            detail: `Test failed for ${channel} account: ${account.accountName} (refresh failed)`,
            metadata: { channelAccountId: account.id, channel, error: (refreshErr as Error).message },
          },
        });

        res.json({ ok: false, status: "NEEDS_REAUTH", message: "Token refresh failed, please reconnect" });
        return;
      }
    } else if (account.accessTokenEncrypted) {
      accessToken = decrypt(account.accessTokenEncrypted);
    } else {
      res.json({ ok: false, status: "ERROR", message: "No tokens available" });
      return;
    }

    const result = await provider.testConnection(accessToken);

    // Update account status based on test result
    const newStatus = result.ok ? "OK" : "ERROR";
    await prisma.channelAccount.update({
      where: { id: account.id },
      data: { status: newStatus },
    });

    await prisma.auditLog.create({
      data: {
        action: "INTEGRATION_TEST",
        detail: `Test ${result.ok ? "passed" : "failed"} for ${channel} account: ${account.accountName}`,
        metadata: { channelAccountId: account.id, channel, result: result.message },
      },
    });

    res.json({ ok: result.ok, status: newStatus, message: result.message });
  } catch (err) {
    console.error("Test connection error:", err);
    res.status(500).json({ error: "Failed to test connection" });
  }
});

// ─── DELETE /api/integrations/accounts/:id ──────────────────────────────────
// Disconnect (delete) an account
router.delete("/accounts/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const account = await prisma.channelAccount.findUnique({
      where: { id },
    });

    if (!account) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    await prisma.channelAccount.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: "INTEGRATION_DISCONNECT",
        detail: `Disconnected ${account.channel} account: ${account.accountName}`,
        metadata: {
          channelAccountId: id,
          channel: account.channel,
          externalSellerId: account.externalSellerId,
        },
      },
    });

    res.json({ message: "Account disconnected" });
  } catch (err) {
    console.error("Delete account error:", err);
    res.status(500).json({ error: "Failed to disconnect account" });
  }
});

// ─── POST /api/integrations/temu/manual ─────────────────────────────────────
// Manual token connect for Temu
router.post("/temu/manual", async (req, res) => {
  try {
    const { accountName, accessToken, refreshToken, externalSellerId } = req.body;

    if (!accountName || !accessToken) {
      res.status(400).json({ error: "accountName and accessToken are required" });
      return;
    }

    const sellerId = externalSellerId || `temu-manual-${Date.now()}`;

    // Idempotency: upsert based on (channel, externalSellerId)
    const account = await prisma.channelAccount.upsert({
      where: {
        channel_externalSellerId: {
          channel: "TEMU",
          externalSellerId: sellerId,
        },
      },
      update: {
        accountName,
        accessTokenEncrypted: encrypt(accessToken),
        refreshTokenEncrypted: refreshToken ? encrypt(refreshToken) : null,
        status: "OK",
      },
      create: {
        channel: "TEMU",
        accountName,
        externalSellerId: sellerId,
        accessTokenEncrypted: encrypt(accessToken),
        refreshTokenEncrypted: refreshToken ? encrypt(refreshToken) : null,
        status: "OK",
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "INTEGRATION_CONNECT",
        detail: `Manually connected Temu account: ${accountName}`,
        metadata: {
          channelAccountId: account.id,
          channel: "TEMU",
          method: "manual",
        },
      },
    });

    res.json(account);
  } catch (err) {
    console.error("Temu manual connect error:", err);
    res.status(500).json({ error: "Failed to connect Temu account" });
  }
});

export default router;
