import { Router } from "express";
import { prisma } from "../db/client";
import { markOrderHold, recordAudit } from "../db/operations";
import { OrderStatus, AuditAction } from "@prisma/client";

const router = Router();

// GET /api/orders
router.get("/", async (req, res) => {
  try {
    const { search, channel, status, limit } = req.query;

    const where: Record<string, unknown> = {};

    if (channel && typeof channel === "string") {
      where.channel = channel;
    }
    if (status && typeof status === "string") {
      where.status = status;
    }
    if (search && typeof search === "string") {
      where.OR = [
        { externalOrderId: { contains: search, mode: "insensitive" } },
        { buyerName: { contains: search, mode: "insensitive" } },
        { shipToName: { contains: search, mode: "insensitive" } },
        { id: { contains: search, mode: "insensitive" } },
      ];
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: true,
        shipment: { include: { labels: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit ? parseInt(limit as string, 10) : 200,
    });

    res.json(orders);
  } catch (err) {
    console.error("List orders error:", err);
    res.status(500).json({ error: "Failed to list orders" });
  }
});

// GET /api/orders/:orderId
router.get("/:orderId", async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.orderId },
      include: {
        items: { include: { serialCaptures: true } },
        shipment: { include: { labels: true } },
        documents: { orderBy: { createdAt: "desc" } },
        exceptions: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    res.json(order);
  } catch (err) {
    console.error("Get order error:", err);
    res.status(500).json({ error: "Failed to get order" });
  }
});

// POST /api/orders/:orderId/hold
router.post("/:orderId/hold", async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await markOrderHold(
      req.params.orderId,
      reason || "Manual hold",
    );
    res.json(order);
  } catch (err) {
    console.error("Hold order error:", err);
    res.status(500).json({ error: "Failed to hold order" });
  }
});

// POST /api/orders/:orderId/release-hold
router.post("/:orderId/release-hold", async (req, res) => {
  try {
    const order = await prisma.order.update({
      where: { id: req.params.orderId },
      data: { status: OrderStatus.READY, holdReason: null },
    });

    await recordAudit({
      action: AuditAction.ORDER_UPDATED,
      detail: "Order hold released",
      orderId: order.id,
    });

    res.json(order);
  } catch (err) {
    console.error("Release hold error:", err);
    res.status(500).json({ error: "Failed to release hold" });
  }
});

export default router;
