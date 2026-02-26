import * as path from "path";
import * as fs from "fs";
import { chromium, Browser } from "playwright";
import { PDFDocument } from "pdf-lib";
import {
  DocumentType,
  AuditAction,
  ExceptionType,
  OrderStatus,
  ShipmentStatus,
  ChannelType,
} from "@prisma/client";

import { prisma } from "../db/client";
import { recordAudit, recordException, attachDocumentToOrderOrBatch } from "../db/operations";
import {
  ensureDailyFolders,
  writeFileAtomic,
  sanitizeFilename,
  packingSlipDir,
  pickListDir,
  labelsDir,
  manifestsDir,
  channelToDir,
  ChannelDir,
} from "./filesystem";
import { renderPackingSlipHTML, PackingSlipData } from "../templates/packingSlip";
import { renderPickListHTML, PickListData } from "../templates/pickList";
import { MANIFEST_HEADER, manifestRowToCSV, ManifestRow } from "../templates/manifest";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getShipmentRoot(): Promise<string> {
  const setting = await prisma.setting.findUnique({ where: { key: "shipment_root" } });
  return path.resolve(setting?.value ?? process.env.SHIPMENT_ROOT ?? "./Shipments");
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

let _browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!_browser || !_browser.isConnected()) {
    _browser = await chromium.launch({ headless: true });
  }
  return _browser;
}

async function htmlToPdfBuffer(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdf = await page.pdf({
      format: "Letter",
      margin: { top: "0.5in", bottom: "0.5in", left: "0.5in", right: "0.5in" },
      printBackground: true,
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

/**
 * Check if a document of the given type already exists for order/batch + date.
 * Returns the existing Document or null.
 */
async function existingDocument(
  type: DocumentType,
  dateISO: string,
  opts: { orderId?: string; batchId?: string }
) {
  const startOfDay = new Date(`${dateISO}T00:00:00.000Z`);
  const endOfDay = new Date(`${dateISO}T23:59:59.999Z`);

  return prisma.document.findFirst({
    where: {
      type,
      orderId: opts.orderId ?? undefined,
      batchId: opts.batchId ?? undefined,
      createdAt: { gte: startOfDay, lte: endOfDay },
    },
  });
}

// ─── Packing Slip ────────────────────────────────────────────────────────────

export async function generatePackingSlip(
  orderId: string,
  dateISO?: string,
  userId?: string
) {
  const date = dateISO ?? todayISO();

  // Idempotency check
  const existing = await existingDocument(DocumentType.PACKING_SLIP, date, { orderId });
  if (existing) return existing;

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true },
  });

  const data: PackingSlipData = {
    orderId: order.id,
    externalOrderId: order.externalOrderId,
    channel: order.channel,
    shipToName: order.shipToName,
    shipToAddress1: order.shipToAddress1,
    shipToAddress2: order.shipToAddress2,
    shipToCity: order.shipToCity,
    shipToState: order.shipToState,
    shipToZip: order.shipToZip,
    shipToCountry: order.shipToCountry,
    items: order.items.map((it) => ({
      sku: it.sku,
      title: it.title,
      quantity: it.quantity,
      serialRequired: it.serialRequired,
    })),
  };

  const html = renderPackingSlipHTML(data);
  const pdfBuf = await htmlToPdfBuffer(html);

  const root = await getShipmentRoot();
  const dayDir = ensureDailyFolders(date, root);
  const fileName = sanitizeFilename(`packing-slip_${order.externalOrderId}.pdf`);
  const absPath = path.join(packingSlipDir(dayDir), fileName);
  writeFileAtomic(absPath, pdfBuf);

  const relPath = path.relative(root, absPath);

  return attachDocumentToOrderOrBatch({
    type: DocumentType.PACKING_SLIP,
    filePath: relPath,
    fileName,
    sizeBytes: pdfBuf.length,
    orderId,
    userId,
  });
}

// ─── Pick List ───────────────────────────────────────────────────────────────

export async function generatePickList(
  batchId: string,
  dateISO?: string,
  userId?: string
) {
  const date = dateISO ?? todayISO();

  const existing = await existingDocument(DocumentType.PICK_LIST, date, { batchId });
  if (existing) return existing;

  const batch = await prisma.batch.findUniqueOrThrow({
    where: { id: batchId },
    include: {
      batchOrders: {
        include: {
          order: { include: { items: true } },
        },
        orderBy: { position: "asc" },
      },
    },
  });

  // Aggregate items by SKU
  const skuMap = new Map<
    string,
    {
      sku: string;
      title: string;
      binLocation: string;
      totalQty: number;
      orders: { orderId: string; externalOrderId: string; qty: number }[];
    }
  >();

  for (const bo of batch.batchOrders) {
    for (const item of bo.order.items) {
      const entry = skuMap.get(item.sku) ?? {
        sku: item.sku,
        title: item.title,
        binLocation: item.binLocation ?? "UNKNOWN",
        totalQty: 0,
        orders: [],
      };
      entry.totalQty += item.quantity;
      entry.orders.push({
        orderId: bo.order.id,
        externalOrderId: bo.order.externalOrderId,
        qty: item.quantity,
      });
      skuMap.set(item.sku, entry);
    }
  }

  const pickData: PickListData = {
    batchId: batch.id,
    batchName: batch.name,
    date,
    lines: Array.from(skuMap.values()),
  };

  const html = renderPickListHTML(pickData);
  const pdfBuf = await htmlToPdfBuffer(html);

  const root = await getShipmentRoot();
  const dayDir = ensureDailyFolders(date, root);
  const fileName = sanitizeFilename(`pick-list_${batch.name}.pdf`);
  const absPath = path.join(pickListDir(dayDir), fileName);
  writeFileAtomic(absPath, pdfBuf);

  const relPath = path.relative(root, absPath);

  return attachDocumentToOrderOrBatch({
    type: DocumentType.PICK_LIST,
    filePath: relPath,
    fileName,
    sizeBytes: pdfBuf.length,
    batchId,
    userId,
  });
}

// ─── Label Document ──────────────────────────────────────────────────────────

/**
 * Save a label file (PDF or PNG→PDF) into /03_LABELS/{Channel}/.
 * If the input is a PNG, it wraps it in a PDF page.
 */
export async function saveLabelDocument(
  orderId: string,
  channel: ChannelType,
  labelBuffer: Buffer,
  ext: string,
  dateISO?: string,
  userId?: string
) {
  const date = dateISO ?? todayISO();

  let pdfBuf: Buffer;
  if (ext.toLowerCase() === ".png") {
    const pdfDoc = await PDFDocument.create();
    const img = await pdfDoc.embedPng(labelBuffer);
    const page = pdfDoc.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    pdfBuf = Buffer.from(await pdfDoc.save());
  } else {
    pdfBuf = labelBuffer;
  }

  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  const root = await getShipmentRoot();
  const dayDir = ensureDailyFolders(date, root);
  const chDir: ChannelDir = channelToDir(channel);
  const fileName = sanitizeFilename(`label_${order.externalOrderId}.pdf`);
  const absPath = path.join(labelsDir(dayDir, chDir), fileName);
  writeFileAtomic(absPath, pdfBuf);

  const relPath = path.relative(root, absPath);

  return attachDocumentToOrderOrBatch({
    type: DocumentType.LABEL,
    filePath: relPath,
    fileName,
    sizeBytes: pdfBuf.length,
    orderId,
    userId,
  });
}

// ─── Manifest ────────────────────────────────────────────────────────────────

export async function generateBatchManifest(
  batchId: string,
  dateISO?: string,
  userId?: string
) {
  const date = dateISO ?? todayISO();

  const existing = await existingDocument(DocumentType.MANIFEST, date, { batchId });
  if (existing) return existing;

  const batch = await prisma.batch.findUniqueOrThrow({
    where: { id: batchId },
    include: {
      batchOrders: {
        include: { order: { include: { items: true } } },
        orderBy: { position: "asc" },
      },
    },
  });

  const rows: ManifestRow[] = batch.batchOrders.map((bo) => {
    const o = bo.order;
    const skuSummary = o.items.map((it) => `${it.sku} x${it.quantity}`).join(", ");
    const qtyTotal = o.items.reduce((s, it) => s + it.quantity, 0);
    return {
      orderId: o.id,
      channel: o.channel,
      externalOrderId: o.externalOrderId,
      shipToName: o.shipToName,
      shipToAddress1: o.shipToAddress1,
      shipToCity: o.shipToCity,
      shipToState: o.shipToState,
      shipToZip: o.shipToZip,
      skuSummary,
      qtyTotal,
    };
  });

  const csv = [MANIFEST_HEADER, ...rows.map(manifestRowToCSV)].join("\n") + "\n";
  const csvBuf = Buffer.from(csv, "utf-8");

  const root = await getShipmentRoot();
  const dayDir = ensureDailyFolders(date, root);
  const fileName = sanitizeFilename(`manifest_${batch.name}.csv`);
  const absPath = path.join(manifestsDir(dayDir), fileName);
  writeFileAtomic(absPath, csvBuf);

  const relPath = path.relative(root, absPath);

  return attachDocumentToOrderOrBatch({
    type: DocumentType.MANIFEST,
    filePath: relPath,
    fileName,
    mimeType: "text/csv",
    sizeBytes: csvBuf.length,
    batchId,
    userId,
  });
}

// ─── Shutdown helper ─────────────────────────────────────────────────────────

export async function closeBrowser() {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}
