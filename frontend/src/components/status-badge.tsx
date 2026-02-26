import { Badge } from "@/components/ui/badge";
import type { OrderStatus, ShipmentStatus, ExceptionType } from "@/types";

const orderStatusConfig: Record<OrderStatus, { label: string; variant: "default" | "secondary" | "destructive" | "success" | "warning" | "outline" }> = {
  NEW: { label: "New", variant: "secondary" },
  READY: { label: "Ready", variant: "success" },
  HOLD: { label: "Hold", variant: "warning" },
  SHIPPED: { label: "Shipped", variant: "default" },
  CANCELED: { label: "Canceled", variant: "outline" },
};

const shipmentStatusConfig: Record<ShipmentStatus, { label: string; variant: "default" | "secondary" | "destructive" | "success" | "warning" | "outline" }> = {
  PENDING: { label: "Pending", variant: "secondary" },
  LABEL_PURCHASED: { label: "Label Purchased", variant: "default" },
  PACKED: { label: "Packed", variant: "success" },
  SHIPPED: { label: "Shipped", variant: "success" },
  ERROR: { label: "Error", variant: "destructive" },
};

const exceptionTypeLabels: Record<ExceptionType, string> = {
  ADDRESS_INVALID: "Address Invalid",
  SERIAL_MISSING: "Serial Missing",
  SERIAL_INVALID: "Serial Invalid",
  LABEL_PURCHASE_FAILED: "Label Failed",
  TRACKING_UPLOAD_FAILED: "Tracking Failed",
  API_AUTH_FAILED: "Auth Failed",
  UNKNOWN: "Unknown",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config = orderStatusConfig[status] || { label: status, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  const config = shipmentStatusConfig[status] || { label: status, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function ExceptionTypeBadge({ type }: { type: ExceptionType }) {
  return <Badge variant="destructive">{exceptionTypeLabels[type] || type}</Badge>;
}
