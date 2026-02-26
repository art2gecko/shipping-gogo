import { Router } from "express";
import { prisma } from "../db/client";
import { recordAudit } from "../db/operations";
import { AuditAction } from "@prisma/client";

const router = Router();

// POST /api/serials/capture
router.post("/capture", async (req, res) => {
  try {
    const { orderItemId, serialCode } = req.body;

    if (!orderItemId || !serialCode) {
      res.status(400).json({ error: "orderItemId and serialCode are required" });
      return;
    }

    // Check for duplicate
    const existing = await prisma.serialCapture.findFirst({
      where: { serialCode },
    });
    if (existing) {
      res.status(409).json({ error: `Duplicate serial: ${serialCode}` });
      return;
    }

    // Verify item exists and needs serials
    const item = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: { serialCaptures: true },
    });
    if (!item) {
      res.status(404).json({ error: "Order item not found" });
      return;
    }
    if (!item.serialRequired) {
      res.status(400).json({ error: "This item does not require serial capture" });
      return;
    }
    if (item.serialCaptures.length >= item.quantity) {
      res.status(400).json({ error: "All serials already captured for this item" });
      return;
    }

    const capture = await prisma.serialCapture.create({
      data: {
        orderItemId,
        serialCode,
      },
    });

    await recordAudit({
      action: AuditAction.SERIAL_SCANNED,
      detail: `Serial ${serialCode} captured for item ${item.sku}`,
      orderId: item.orderId,
    });

    res.status(201).json(capture);
  } catch (err) {
    console.error("Capture serial error:", err);
    res.status(500).json({ error: "Failed to capture serial" });
  }
});

export default router;
