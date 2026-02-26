interface PickLineItem {
  sku: string;
  title: string;
  binLocation: string;
  totalQty: number;
  orders: { orderId: string; externalOrderId: string; qty: number }[];
}

export interface PickListData {
  batchId: string;
  batchName: string;
  date: string;
  lines: PickLineItem[];
}

export function renderPickListHTML(data: PickListData): string {
  // Group by bin then by SKU (already grouped by caller)
  const sorted = [...data.lines].sort((a, b) => {
    const binCmp = a.binLocation.localeCompare(b.binLocation);
    return binCmp !== 0 ? binCmp : a.sku.localeCompare(b.sku);
  });

  const rows = sorted
    .map((line) => {
      const orderList = line.orders
        .map((o) => `${esc(o.externalOrderId)} (×${o.qty})`)
        .join(", ");

      return `
      <tr>
        <td>${esc(line.binLocation)}</td>
        <td><strong>${esc(line.sku)}</strong><br/><span class="small">${esc(line.title)}</span></td>
        <td class="center">${line.totalQty}</td>
        <td class="small">${orderList}</td>
      </tr>`;
    })
    .join("\n");

  const grandTotal = sorted.reduce((s, l) => s + l.totalQty, 0);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Pick List – ${esc(data.batchName)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; padding: 24px; color: #222; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .meta { color: #555; margin-bottom: 16px; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #ccc; padding: 5px 8px; text-align: left; font-size: 11px; }
  th { background: #f4f4f4; }
  .center { text-align: center; }
  .small { font-size: 10px; color: #555; }
  .total { font-weight: bold; font-size: 13px; margin-top: 12px; }
</style>
</head>
<body>
  <h1>PICK LIST</h1>
  <p class="meta">Batch: ${esc(data.batchName)} &nbsp;|&nbsp; ID: ${esc(data.batchId)} &nbsp;|&nbsp; Date: ${esc(data.date)}</p>

  <table>
    <thead>
      <tr><th>Bin</th><th>SKU / Title</th><th class="center">Total Qty</th><th>Orders</th></tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <p class="total">Grand Total: ${grandTotal} units</p>
</body>
</html>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
