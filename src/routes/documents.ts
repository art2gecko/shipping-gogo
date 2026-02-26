import { Router } from "express";
import * as path from "path";
import * as fs from "fs";
import { prisma } from "../db/client";
import {
  generatePackingSlip,
  generatePickList,
} from "../services/documentService";

const router = Router();

// ─── POST /api/documents/orders/:orderId/packing-slip ────────────────────────
router.post("/orders/:orderId/packing-slip", async (req, res) => {
  try {
    const orderId = req.params.orderId as string;
    const doc = await generatePackingSlip(orderId);
    res.status(201).json(doc);
  } catch (err: any) {
    console.error("Packing slip generation failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/documents/batches/:batchId/pick-list ──────────────────────────
router.post("/batches/:batchId/pick-list", async (req, res) => {
  try {
    const batchId = req.params.batchId as string;
    const doc = await generatePickList(batchId);
    res.status(201).json(doc);
  } catch (err: any) {
    console.error("Pick list generation failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/documents/:documentId/download ────────────────────────────────
router.get("/:documentId/download", async (req, res) => {
  try {
    const documentId = req.params.documentId as string;
    const doc = await prisma.document.findUniqueOrThrow({
      where: { id: documentId },
    });

    const setting = await prisma.setting.findUnique({ where: { key: "shipment_root" } });
    const root = path.resolve(setting?.value ?? process.env.SHIPMENT_ROOT ?? "./Shipments");
    const absPath = path.join(root, doc.filePath);

    if (!fs.existsSync(absPath)) {
      res.status(404).json({ error: "File not found on disk" });
      return;
    }

    res.setHeader("Content-Type", doc.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${doc.fileName}"`);
    fs.createReadStream(absPath).pipe(res);
  } catch (err: any) {
    console.error("Document download failed:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
