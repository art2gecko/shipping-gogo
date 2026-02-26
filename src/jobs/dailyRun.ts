import { OrderStatus, ExceptionType, AuditAction } from "@prisma/client";
import { prisma } from "../db/client";
import { recordAudit, recordException } from "../db/operations";
import { ensureDailyFolders } from "../services/filesystem";
import {
  generatePackingSlip,
  generatePickList,
  generateBatchManifest,
  closeBrowser,
} from "../services/documentService";

/**
 * Daily run: ensures folders exist, generates packing slips for READY orders,
 * and pick lists + manifests for active batches.
 * Idempotent – skips documents that already exist for today.
 */
export async function dailyRun(dateISO?: string) {
  const date = dateISO ?? new Date().toISOString().slice(0, 10);
  console.log(`\n=== Daily Run for ${date} ===\n`);

  // 1. Ensure folder structure
  const setting = await prisma.setting.findUnique({ where: { key: "shipment_root" } });
  const root = setting?.value ?? process.env.SHIPMENT_ROOT ?? "./Shipments";
  const { resolve } = await import("path");
  ensureDailyFolders(date, resolve(root));
  console.log("Folders ready.");

  // 2. Packing slips for all READY orders
  const readyOrders = await prisma.order.findMany({
    where: { status: OrderStatus.READY },
    orderBy: { createdAt: "asc" },
  });

  console.log(`READY orders: ${readyOrders.length}`);
  let slipOk = 0;
  let slipFail = 0;

  for (const order of readyOrders) {
    try {
      await generatePackingSlip(order.id, date);
      slipOk++;
    } catch (err: any) {
      slipFail++;
      console.error(`  Packing slip FAILED for order ${order.externalOrderId}: ${err.message}`);
      await recordException({
        type: ExceptionType.UNKNOWN,
        message: `Packing slip generation failed: ${err.message}`,
        orderId: order.id,
        holdOrder: true,
      });
    }
  }
  console.log(`  Packing slips: ${slipOk} ok, ${slipFail} failed`);

  // 3. Pick lists + manifests for active batches
  const batches = await prisma.batch.findMany({
    where: {
      batchOrders: { some: { order: { status: OrderStatus.READY } } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Active batches: ${batches.length}`);
  let batchOk = 0;
  let batchFail = 0;

  for (const batch of batches) {
    try {
      await generatePickList(batch.id, date);
      await generateBatchManifest(batch.id, date);
      batchOk++;
    } catch (err: any) {
      batchFail++;
      console.error(`  Batch docs FAILED for ${batch.name}: ${err.message}`);
      await recordException({
        type: ExceptionType.UNKNOWN,
        message: `Batch document generation failed for ${batch.name}: ${err.message}`,
      });
    }
  }
  console.log(`  Batch docs: ${batchOk} ok, ${batchFail} failed`);

  // 4. Audit summary
  await recordAudit({
    action: AuditAction.DOCUMENT_CREATED,
    detail: `Daily run ${date}: ${slipOk} packing slips, ${batchOk} batch docs generated. Failures: ${slipFail + batchFail}`,
  });

  // Clean up Playwright browser
  await closeBrowser();

  console.log(`\n=== Daily Run complete ===\n`);
}

// Allow running directly: npx ts-node src/jobs/dailyRun.ts [YYYY-MM-DD]
if (require.main === module) {
  const dateArg = process.argv[2];
  dailyRun(dateArg)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
