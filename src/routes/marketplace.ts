import { Router } from "express";
import { LabelSource, AuditAction, ExceptionType, ShipmentStatus } from "@prisma/client";
import { prisma } from "../db/client";
import { decrypt, encrypt } from "../services/tokenService";
import { getProvider } from "../services/channels";
import { recordAudit, recordException } from "../db/operations";
import { saveLabelDocument } from "../services/documentService";
import { v4 as uuid } from "uuid";

const router = Router();

const CHANNEL_NAME_MAP: Record<string, string> = {
  AMAZON: "amazon",
  EBAY: "ebay",
  WALMART: "walmart",
  TEMU: "temu",
  OTHER: "other",
};

const LABEL_SOURCE_MAP: Record<string, LabelSource> = {
  AMAZON: LabelSource.AMAZON_BUY_SHIPPING,
  EBAY: LabelSource.EBAY_LABELS,
  TEMU: LabelSource.TEMU_LABELS,
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

// ─── POST /api/marketplace/orders/:orderId/purchase-label ───────────────────
// Purchase a shipping label through the marketplace for a specific order
router.post("/orders/:orderId/purchase-label", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { shipFromAddress, packageDetails, carrierCode, serviceCode } = req.body;

    if (!shipFromAddress || !packageDetails) {
      res.status(400).json({ error: "shipFromAddress and packageDetails are required" });
      return;
    }

    // Find the order with its channel account
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { shipment: true, channelAccount: true },
    });

    if (!order.channelAccountId || !order.channelAccount) {
      res.status(400).json({ error: "Order is not linked to a marketplace account" });
      return;
    }

    const channelName = CHANNEL_NAME_MAP[order.channel];
    const provider = getProvider(channelName);
    const accessToken = await getAccessToken(order.channelAccountId);

    // Purchase label via marketplace API
    const result = await provider.purchaseLabel(accessToken, {
      externalOrderId: order.externalOrderId,
      shipFromAddress,
      shipToAddress: {
        name: order.shipToName,
        address1: order.shipToAddress1,
        address2: order.shipToAddress2 || undefined,
        city: order.shipToCity,
        state: order.shipToState,
        zip: order.shipToZip,
        country: order.shipToCountry,
      },
      packageDetails,
      carrierCode,
      serviceCode,
    });

    // Save label file if we got PDF data
    let filePath: string | undefined;
    if (result.labelData) {
      const doc = await saveLabelDocument(orderId, order.channel, result.labelData, ".pdf");
      filePath = doc.filePath;
    }

    // Ensure shipment exists
    let shipmentId = order.shipment?.id;
    if (!shipmentId) {
      const shipment = await prisma.shipment.create({
        data: { orderId },
      });
      shipmentId = shipment.id;
    }

    // Update shipment with tracking info
    await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        trackingNumber: result.trackingNumber,
        carrierCode: result.carrierCode,
        status: ShipmentStatus.LABEL_PURCHASED,
        weightOz: packageDetails.weightOz,
        lengthIn: packageDetails.lengthIn,
        widthIn: packageDetails.widthIn,
        heightIn: packageDetails.heightIn,
      },
    });

    // Create label record
    const labelSource = LABEL_SOURCE_MAP[order.channel] || LabelSource.CARRIER_API;
    await prisma.label.create({
      data: {
        shipmentId,
        source: labelSource,
        trackingNumber: result.trackingNumber,
        carrierCode: result.carrierCode,
        cost: result.cost,
        filePath,
        idempotencyKey: `${channelName}_${orderId}_${uuid()}`,
      },
    });

    await recordAudit({
      action: AuditAction.LABEL_PURCHASED,
      detail: `${channelName} label purchased: ${result.trackingNumber} via ${result.carrierCode}`,
      orderId,
      metadata: {
        trackingNumber: result.trackingNumber,
        carrierCode: result.carrierCode,
        cost: result.cost,
        source: labelSource,
      },
    });

    res.json({
      trackingNumber: result.trackingNumber,
      carrierCode: result.carrierCode,
      cost: result.cost,
      labelUrl: result.labelUrl,
      filePath,
    });
  } catch (err: any) {
    console.error("Label purchase error:", err);

    // Record exception
    await recordException({
      type: ExceptionType.LABEL_PURCHASE_FAILED,
      message: `Marketplace label purchase failed: ${err.message}`,
      orderId: req.params.orderId,
    }).catch(() => {});

    res.status(500).json({ error: `Label purchase failed: ${err.message}` });
  }
});

// ─── POST /api/marketplace/orders/:orderId/upload-tracking ──────────────────
// Upload tracking info back to the marketplace
router.post("/orders/:orderId/upload-tracking", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { trackingNumber, carrierCode, shipDate } = req.body;

    // Find the order with shipment
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { shipment: true, channelAccount: true },
    });

    if (!order.channelAccountId || !order.channelAccount) {
      res.status(400).json({ error: "Order is not linked to a marketplace account" });
      return;
    }

    // Use provided tracking or pull from shipment
    const tracking = trackingNumber || order.shipment?.trackingNumber;
    const carrier = carrierCode || order.shipment?.carrierCode;

    if (!tracking || !carrier) {
      res.status(400).json({ error: "trackingNumber and carrierCode are required (or must exist on shipment)" });
      return;
    }

    const channelName = CHANNEL_NAME_MAP[order.channel];
    const provider = getProvider(channelName);
    const accessToken = await getAccessToken(order.channelAccountId);

    const result = await provider.uploadTracking(accessToken, {
      externalOrderId: order.externalOrderId,
      trackingNumber: tracking,
      carrierCode: carrier,
      shipDate,
    });

    // Update shipment status
    if (order.shipment) {
      await prisma.shipment.update({
        where: { id: order.shipment.id },
        data: {
          status: ShipmentStatus.SHIPPED,
          trackingNumber: tracking,
          carrierCode: carrier,
          shipDate: new Date(shipDate || Date.now()),
        },
      });
    }

    // Update order status to SHIPPED
    await prisma.order.update({
      where: { id: orderId },
      data: { status: "SHIPPED" },
    });

    await recordAudit({
      action: AuditAction.TRACKING_UPLOADED,
      detail: `Tracking uploaded to ${channelName}: ${tracking} (${carrier})`,
      orderId,
      metadata: {
        trackingNumber: tracking,
        carrierCode: carrier,
        channel: channelName,
        result: result.message,
      },
    });

    res.json({
      ok: result.ok,
      message: result.message,
      trackingNumber: tracking,
      carrierCode: carrier,
    });
  } catch (err: any) {
    console.error("Tracking upload error:", err);

    await recordException({
      type: ExceptionType.TRACKING_UPLOAD_FAILED,
      message: `Tracking upload failed: ${err.message}`,
      orderId: req.params.orderId,
    }).catch(() => {});

    res.status(500).json({ error: `Tracking upload failed: ${err.message}` });
  }
});

// ─── POST /api/marketplace/orders/bulk-upload-tracking ──────────────────────
// Upload tracking for multiple orders at once
router.post("/orders/bulk-upload-tracking", async (req, res) => {
  try {
    const { orderIds } = req.body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      res.status(400).json({ error: "orderIds array is required" });
      return;
    }

    const results: Array<{ orderId: string; ok: boolean; message: string }> = [];

    for (const orderId of orderIds) {
      try {
        const order = await prisma.order.findUniqueOrThrow({
          where: { id: orderId },
          include: { shipment: true, channelAccount: true },
        });

        if (!order.channelAccountId || !order.channelAccount) {
          results.push({ orderId, ok: false, message: "Not linked to marketplace account" });
          continue;
        }

        if (!order.shipment?.trackingNumber || !order.shipment?.carrierCode) {
          results.push({ orderId, ok: false, message: "No tracking info on shipment" });
          continue;
        }

        const channelName = CHANNEL_NAME_MAP[order.channel];
        const provider = getProvider(channelName);
        const accessToken = await getAccessToken(order.channelAccountId);

        const result = await provider.uploadTracking(accessToken, {
          externalOrderId: order.externalOrderId,
          trackingNumber: order.shipment.trackingNumber,
          carrierCode: order.shipment.carrierCode,
        });

        if (result.ok) {
          await prisma.shipment.update({
            where: { id: order.shipment.id },
            data: { status: ShipmentStatus.SHIPPED, shipDate: new Date() },
          });
          await prisma.order.update({
            where: { id: orderId },
            data: { status: "SHIPPED" },
          });
        }

        results.push({ orderId, ok: result.ok, message: result.message });
      } catch (err) {
        results.push({ orderId, ok: false, message: (err as Error).message });
      }
    }

    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;

    res.json({
      message: `Bulk tracking: ${succeeded} succeeded, ${failed} failed`,
      results,
    });
  } catch (err) {
    console.error("Bulk tracking upload error:", err);
    res.status(500).json({ error: "Bulk tracking upload failed" });
  }
});

export default router;
