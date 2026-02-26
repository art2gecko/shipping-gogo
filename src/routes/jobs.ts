import { Router } from "express";
import { recordAudit } from "../db/operations";
import { AuditAction } from "@prisma/client";

const router = Router();

// POST /api/jobs/daily-run
router.post("/daily-run", async (_req, res) => {
  try {
    // Import dynamically to avoid loading playwright eagerly
    const { dailyRun } = await import("../jobs/dailyRun");
    // Fire and don't wait — return immediately
    dailyRun().catch((err: unknown) => console.error("Daily run error:", err));
    res.json({ message: "Daily automation started" });
  } catch (err) {
    console.error("Daily run trigger error:", err);
    res.status(500).json({ error: "Failed to start daily run" });
  }
});

// POST /api/jobs/sync-orders
router.post("/sync-orders", async (_req, res) => {
  try {
    await recordAudit({
      action: AuditAction.ORDER_IMPORTED,
      detail: "Manual order sync triggered (no marketplace integrations configured yet)",
    });

    res.json({ message: "Order sync triggered. Connect marketplace APIs to enable automatic syncing." });
  } catch (err) {
    console.error("Sync orders error:", err);
    res.status(500).json({ error: "Failed to trigger sync" });
  }
});

export default router;
