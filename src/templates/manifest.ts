export interface ManifestRow {
  orderId: string;
  channel: string;
  externalOrderId: string;
  shipToName: string;
  shipToAddress1: string;
  shipToCity: string;
  shipToState: string;
  shipToZip: string;
  skuSummary: string;  // e.g. "WDG-1001 x2, CABLE-3001 x1"
  qtyTotal: number;
}

export const MANIFEST_HEADER =
  "order_id,channel,external_order_id,name,address1,city,state,zip,sku_summary,qty_total";

export function manifestRowToCSV(row: ManifestRow): string {
  return [
    csvField(row.orderId),
    csvField(row.channel),
    csvField(row.externalOrderId),
    csvField(row.shipToName),
    csvField(row.shipToAddress1),
    csvField(row.shipToCity),
    csvField(row.shipToState),
    csvField(row.shipToZip),
    csvField(row.skuSummary),
    String(row.qtyTotal),
  ].join(",");
}

function csvField(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}
