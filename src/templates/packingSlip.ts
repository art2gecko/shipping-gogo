interface PackingSlipItem {
  sku: string;
  title: string;
  quantity: number;
  serialRequired: boolean;
}

export interface PackingSlipData {
  orderId: string;
  externalOrderId: string;
  channel: string;
  shipToName: string;
  shipToAddress1: string;
  shipToAddress2?: string | null;
  shipToCity: string;
  shipToState: string;
  shipToZip: string;
  shipToCountry: string;
  items: PackingSlipItem[];
}

export function renderPackingSlipHTML(data: PackingSlipData): string {
  const itemRows = data.items
    .map(
      (it) => `
      <tr>
        <td>${esc(it.sku)}</td>
        <td>${esc(it.title)}</td>
        <td class="center">${it.quantity}</td>
        <td class="center">${it.serialRequired ? "YES" : ""}</td>
      </tr>`
    )
    .join("\n");

  const addr2 = data.shipToAddress2 ? `<br/>${esc(data.shipToAddress2)}` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Packing Slip – ${esc(data.externalOrderId)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; padding: 24px; color: #222; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .meta { color: #555; margin-bottom: 16px; font-size: 11px; }
  .section { margin-bottom: 16px; }
  .section-title { font-weight: bold; font-size: 13px; border-bottom: 1px solid #ccc; padding-bottom: 2px; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 5px 8px; text-align: left; font-size: 11px; }
  th { background: #f4f4f4; }
  .center { text-align: center; }
  .barcode { font-family: monospace; font-size: 14px; letter-spacing: 2px; margin-top: 12px; }
</style>
</head>
<body>
  <h1>PACKING SLIP</h1>
  <p class="meta">Internal Order: ${esc(data.orderId)} &nbsp;|&nbsp; Channel: ${esc(data.channel)} &nbsp;|&nbsp; External: ${esc(data.externalOrderId)}</p>

  <div class="section">
    <div class="section-title">Ship To</div>
    <p>
      ${esc(data.shipToName)}<br/>
      ${esc(data.shipToAddress1)}${addr2}<br/>
      ${esc(data.shipToCity)}, ${esc(data.shipToState)} ${esc(data.shipToZip)}<br/>
      ${esc(data.shipToCountry)}
    </p>
  </div>

  <div class="section">
    <div class="section-title">Items</div>
    <table>
      <thead>
        <tr><th>SKU</th><th>Title</th><th class="center">Qty</th><th class="center">Serial Req.</th></tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>
  </div>

  <div class="barcode">* ${esc(data.orderId)} *</div>
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
