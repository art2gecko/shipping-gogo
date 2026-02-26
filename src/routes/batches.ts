import { Router } from "express";
import { prisma } from "../db/client";
import { createBatchFromOrders } from "../db/operations";

const router = Router();

// GET /api/batches
router.get("/", async (req, res) => {
  try {
    const { date } = req.query;

    const where: Record<string, unknown> = {};
    if (date && typeof date === "string") {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      where.createdAt = { gte: start, lt: end };
    }

    const batches = await prisma.batch.findMany({
      where,
      include: {
        _count: { select: { batchOrders: true } },
        documents: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Map _count to match frontend expectation
    const result = batches.map((b) => ({
      ...b,
      _count: { orders: b._count.batchOrders },
    }));

    res.json(result);
  } catch (err) {
    console.error("List batches error:", err);
    res.status(500).json({ error: "Failed to list batches" });
  }
});

// GET /api/batches/:batchId
router.get("/:batchId", async (req, res) => {
  try {
    const batch = await prisma.batch.findUnique({
      where: { id: req.params.batchId },
      include: {
        batchOrders: {
          include: { order: { include: { items: true } } },
          orderBy: { position: "asc" },
        },
        documents: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!batch) {
      res.status(404).json({ error: "Batch not found" });
      return;
    }

    // Rename batchOrders -> orders for frontend
    const result = {
      ...batch,
      orders: batch.batchOrders,
      batchOrders: undefined,
    };

    res.json(result);
  } catch (err) {
    console.error("Get batch error:", err);
    res.status(500).json({ error: "Failed to get batch" });
  }
});

// POST /api/batches
router.post("/", async (req, res) => {
  try {
    const { orderIds, strategy } = req.body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      res.status(400).json({ error: "orderIds array is required" });
      return;
    }

    const batch = await createBatchFromOrders(orderIds, strategy);
    res.status(201).json(batch);
  } catch (err) {
    console.error("Create batch error:", err);
    res.status(500).json({ error: "Failed to create batch" });
  }
});

export default router;
