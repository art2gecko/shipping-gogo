import { Router } from "express";
import { prisma } from "../db/client";

const router = Router();

// GET /api/dashboard/stats
router.get("/stats", async (_req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [unshipped, ready, onHold, exceptions, labelsPurchasedToday, batchesToday] =
      await Promise.all([
        prisma.order.count({
          where: { status: { in: ["NEW", "READY", "HOLD"] } },
        }),
        prisma.order.count({
          where: { status: "READY" },
        }),
        prisma.order.count({
          where: { status: "HOLD" },
        }),
        prisma.exception.count({
          where: { resolved: false },
        }),
        prisma.label.count({
          where: { purchasedAt: { gte: today } },
        }),
        prisma.batch.count({
          where: { createdAt: { gte: today } },
        }),
      ]);

    res.json({
      unshipped,
      ready,
      onHold,
      exceptions,
      labelsPurchasedToday,
      batchesToday,
    });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
