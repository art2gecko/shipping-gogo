import {
  ChannelType,
  OrderStatus,
  AuditAction,
  ExceptionType,
  DocumentType,
  Prisma,
} from "@prisma/client";
import { prisma } from "./client";

// ─── Order Operations ────────────────────────────────────────────────────────

/**
 * Find an existing order by channel + external ID, or create a new one.
 * Returns the order with items and shipment.
 */
export async function getOrCreateOrderByExternalId(
  channel: ChannelType,
  externalOrderId: string,
  orderData: {
    buyerName: string;
    shipToName: string;
    shipToAddress1: string;
    shipToAddress2?: string;
    shipToCity: string;
    shipToState: string;
    shipToZip: string;
    shipToCountry?: string;
    orderDate: Date;
    items: {
      sku: string;
      title: string;
      quantity: number;
      unitPrice?: number;
      serialRequired?: boolean;
      binLocation?: string;
    }[];
  }
) {
  const existing = await prisma.order.findUnique({
    where: { channel_externalOrderId: { channel, externalOrderId } },
    include: { items: true, shipment: true },
  });

  if (existing) return { order: existing, created: false };

  const order = await prisma.order.create({
    data: {
      channel,
      externalOrderId,
      buyerName: orderData.buyerName,
      shipToName: orderData.shipToName,
      shipToAddress1: orderData.shipToAddress1,
      shipToAddress2: orderData.shipToAddress2,
      shipToCity: orderData.shipToCity,
      shipToState: orderData.shipToState,
      shipToZip: orderData.shipToZip,
      shipToCountry: orderData.shipToCountry ?? "US",
      orderDate: orderData.orderDate,
      items: {
        create: orderData.items.map((it) => ({
          sku: it.sku,
          title: it.title,
          quantity: it.quantity,
          unitPrice: it.unitPrice ?? 0,
          serialRequired: it.serialRequired ?? false,
          binLocation: it.binLocation,
        })),
      },
      shipment: { create: {} },
    },
    include: { items: true, shipment: true },
  });

  return { order, created: true };
}

// ─── Hold Management ─────────────────────────────────────────────────────────

/**
 * Put an order on HOLD with a reason. Records an audit log entry.
 */
export async function markOrderHold(
  orderId: string,
  reason: string,
  userId?: string
) {
  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.HOLD, holdReason: reason },
  });

  await recordAudit({
    action: AuditAction.ORDER_UPDATED,
    detail: `Order placed on HOLD: ${reason}`,
    orderId,
    userId,
  });

  return order;
}

// ─── Batch Operations ────────────────────────────────────────────────────────

/**
 * Create a pick-wave batch from a set of order IDs.
 */
export async function createBatchFromOrders(
  orderIds: string[],
  strategy?: string,
  userId?: string
) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const count = await prisma.batch.count({
    where: { createdAt: { gte: new Date(dateStr) } },
  });
  const name = `WAVE-${dateStr}-${String(count + 1).padStart(3, "0")}`;

  const batch = await prisma.batch.create({
    data: {
      name,
      strategy: strategy ?? "multi_sku",
      batchOrders: {
        create: orderIds.map((oid, i) => ({ orderId: oid, position: i })),
      },
    },
    include: { batchOrders: { include: { order: true } } },
  });

  await recordAudit({
    action: AuditAction.BATCH_CREATED,
    detail: `Batch "${name}" created with ${orderIds.length} orders`,
    batchId: batch.id,
    userId,
  });

  return batch;
}

// ─── Document Operations ─────────────────────────────────────────────────────

/**
 * Attach a document record to an order and/or batch.
 */
export async function attachDocumentToOrderOrBatch(params: {
  type: DocumentType;
  filePath: string;
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
  orderId?: string;
  batchId?: string;
  userId?: string;
}) {
  const doc = await prisma.document.create({
    data: {
      type: params.type,
      filePath: params.filePath,
      fileName: params.fileName,
      mimeType: params.mimeType ?? "application/pdf",
      sizeBytes: params.sizeBytes,
      orderId: params.orderId,
      batchId: params.batchId,
    },
  });

  await recordAudit({
    action: AuditAction.DOCUMENT_CREATED,
    detail: `${params.type} document "${params.fileName}" created`,
    orderId: params.orderId,
    batchId: params.batchId,
    userId: params.userId,
  });

  return doc;
}

// ─── Exception Queue ─────────────────────────────────────────────────────────

/**
 * Record an exception. Optionally puts the linked order on HOLD.
 */
export async function recordException(params: {
  type: ExceptionType;
  message: string;
  orderId?: string;
  context?: Prisma.InputJsonValue;
  holdOrder?: boolean;
  userId?: string;
}) {
  const exception = await prisma.exception.create({
    data: {
      type: params.type,
      message: params.message,
      orderId: params.orderId,
      context: params.context,
    },
  });

  await recordAudit({
    action: AuditAction.EXCEPTION_CREATED,
    detail: `${params.type}: ${params.message}`,
    orderId: params.orderId,
    userId: params.userId,
  });

  if (params.holdOrder && params.orderId) {
    await markOrderHold(params.orderId, params.message, params.userId);
  }

  return exception;
}

// ─── Audit Log ───────────────────────────────────────────────────────────────

/**
 * Write an audit log entry.
 */
export async function recordAudit(params: {
  action: AuditAction;
  detail?: string;
  metadata?: Prisma.InputJsonValue;
  userId?: string;
  orderId?: string;
  batchId?: string;
}) {
  return prisma.auditLog.create({
    data: {
      action: params.action,
      detail: params.detail,
      metadata: params.metadata,
      userId: params.userId,
      orderId: params.orderId,
      batchId: params.batchId,
    },
  });
}
