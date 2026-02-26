import { Badge } from "@/components/ui/badge";
import type { OrderStatus, ShipmentStatus, ExceptionType } from "@/types";
import { cn } from "@/lib/utils";

const orderStatusConfig: Record<
  OrderStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "success" | "warning" | "outline"; dotColor: string }
> = {
  NEW: { label: "New", variant: "secondary", dotColor: "bg-blue-500" },
  READY: { label: "Ready", variant: "success", dotColor: "bg-green-500" },
  HOLD: { label: "Hold", variant: "warning", dotColor: "bg-amber-500" },
  SHIPPED: { label: "Shipped", variant: "default", dotColor: "bg-primary" },
  CANCELED: { label: "Canceled", variant: "outline", dotColor: "bg-gray-400" },
};

const shipmentStatusConfig: Record<
  ShipmentStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "success" | "warning" | "outline"; dotColor: string }
> = {
  PENDING: { label: "Pending", variant: "secondary", dotColor: "bg-gray-400" },
  LABEL_PURCHASED: { label: "Label Purchased", variant: "default", dotColor: "bg-blue-500" },
  PACKED: { label: "Packed", variant: "success", dotColor: "bg-green-500" },
  SHIPPED: { label: "Shipped", variant: "success", dotColor: "bg-green-500" },
  ERROR: { label: "Error", variant: "destructive", dotColor: "bg-red-500" },
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

export function OrderStatusBadge({
  status,
  dot,
}: {
  status: OrderStatus;
  dot?: boolean;
}) {
  const config = orderStatusConfig[status] || {
    label: status,
    variant: "outline" as const,
    dotColor: "bg-gray-400",
  };

  if (dot) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
        <span className={cn("h-1.5 w-1.5 rounded-full", config.dotColor)} />
        {config.label}
      </span>
    );
  }

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function ShipmentStatusBadge({
  status,
  dot,
}: {
  status: ShipmentStatus;
  dot?: boolean;
}) {
  const config = shipmentStatusConfig[status] || {
    label: status,
    variant: "outline" as const,
    dotColor: "bg-gray-400",
  };

  if (dot) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
        <span className={cn("h-1.5 w-1.5 rounded-full", config.dotColor)} />
        {config.label}
      </span>
    );
  }

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function ExceptionTypeBadge({ type }: { type: ExceptionType }) {
  return (
    <Badge variant="destructive">{exceptionTypeLabels[type] || type}</Badge>
  );
}
