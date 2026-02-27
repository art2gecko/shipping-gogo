import { prisma } from "../db/client";
import { syncAllAccounts } from "../services/orderSyncService";

/**
 * Order sync job: fetches new orders from all connected marketplace accounts.
 * Can be run on a schedule (e.g., every 15 minutes) or triggered manually.
 */
export async function runOrderSync() {
  console.log("\n=== Order Sync Job Started ===\n");

  try {
    const results = await syncAllAccounts();

    const totalImported = results.reduce((sum, r) => sum + r.imported, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);

    console.log(`\nSync complete: ${totalImported} imported, ${totalSkipped} existing, ${totalErrors} errors`);
    console.log(`Accounts processed: ${results.length}`);

    for (const r of results) {
      console.log(`  ${r.channel} (${r.accountId}): +${r.imported} imported, ${r.skipped} skipped, ${r.errors} errors`);
    }

    console.log("\n=== Order Sync Job Complete ===\n");
    return results;
  } catch (err) {
    console.error("Order sync job failed:", err);
    throw err;
  }
}

// Allow running directly: npx ts-node src/jobs/orderSync.ts
if (require.main === module) {
  runOrderSync()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
