import { Router } from "express";
import { syncOrdersForAccount, syncAllAccounts } from "../services/orderSyncService";

const router = Router();

// ─── POST /api/sync/orders ──────────────────────────────────────────────────
// Trigger order sync for all active accounts
router.post("/orders", async (req, res) => {
  try {
    const results = await syncAllAccounts();

    const totalImported = results.reduce((sum, r) => sum + r.imported, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);

    res.json({
      message: `Synced ${results.length} accounts: ${totalImported} orders imported`,
      accounts: results,
      totalImported,
      totalErrors,
    });
  } catch (err) {
    console.error("Order sync error:", err);
    res.status(500).json({ error: "Order sync failed" });
  }
});

// ─── POST /api/sync/orders/:accountId ───────────────────────────────────────
// Trigger order sync for a specific account
router.post("/orders/:accountId", async (req, res) => {
  try {
    const { accountId } = req.params;
    const { createdAfter, updatedAfter, pageSize } = req.body;

    const result = await syncOrdersForAccount(accountId, {
      createdAfter,
      updatedAfter,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });

    res.json({
      message: `Synced: ${result.imported} imported, ${result.skipped} existing, ${result.errors} errors`,
      ...result,
    });
  } catch (err) {
    console.error("Account sync error:", err);
    res.status(500).json({ error: `Sync failed: ${(err as Error).message}` });
  }
});

export default router;
