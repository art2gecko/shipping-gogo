import { Router } from "express";
import { LabelSource } from "@prisma/client";
import { prisma } from "../db/client";
import { saveLabelDocument } from "../services/documentService";
import { v4 as uuid } from "uuid";

const router = Router();

// ─── POST /api/labels/orders/:orderId/upload-manual ──────────────────────────
// Accepts a raw PDF or PNG body (Content-Type should be application/pdf or image/png).
router.post("/orders/:orderId/upload-manual", async (req, res) => {
  try {
    const orderId = req.params.orderId as string;
    const contentType = (req.headers["content-type"] as string | undefined) ?? "";

    let ext: string;
    if (contentType.includes("png")) {
      ext = ".png";
    } else if (contentType.includes("pdf")) {
      ext = ".pdf";
    } else {
      res.status(400).json({ error: "Content-Type must be application/pdf or image/png" });
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    const labelBuffer = Buffer.concat(chunks);

    if (labelBuffer.length === 0) {
      res.status(400).json({ error: "Empty body" });
      return;
    }

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { shipment: true },
    });

    // Save file to disk + Document record
    const doc = await saveLabelDocument(orderId, order.channel, labelBuffer, ext);

    // Create Label record on the shipment
    if (order.shipment) {
      await prisma.label.create({
        data: {
          shipmentId: order.shipment.id,
          source: LabelSource.MANUAL,
          filePath: doc.filePath,
          idempotencyKey: `manual_${orderId}_${uuid()}`,
        },
      });
    }

    res.status(201).json(doc);
  } catch (err: any) {
    console.error("Manual label upload failed:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
