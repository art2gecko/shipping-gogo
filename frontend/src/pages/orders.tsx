import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { Package, Layers, Truck, Loader2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CommandBar } from "@/components/command-bar";
import { DataTable, type Column } from "@/components/data-table";
import { OrderStatusBadge, ShipmentStatusBadge } from "@/components/status-badge";
import { ChannelBadge } from "@/components/channel-badge";
import { TableSkeleton } from "@/components/loading";
import { EmptyState } from "@/components/empty-state";
import { OrderDetailsDrawer } from "@/components/order-details-drawer";
import { useOrders, useCreateBatch, useBulkUploadTracking } from "@/hooks/use-api";
import { formatDate } from "@/lib/utils";
import type { Order, ChannelType, OrderStatus } from "@/types";

export default function OrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // State from URL
  const [search, setSearch] = React.useState(
    searchParams.get("search") || "",
  );
  const [channelFilter, setChannelFilter] = React.useState(
    searchParams.get("channel") || "all",
  );
  const [statusFilter, setStatusFilter] = React.useState(
    searchParams.get("status") || "all",
  );

  // Selection
  const [selectedKeys, setSelectedKeys] = React.useState<Set<string>>(
    new Set(),
  );

  // Drawer
  const [drawerOrderId, setDrawerOrderId] = React.useState<string | null>(
    null,
  );

  const params: Record<string, string> = {};
  if (search) params.search = search;
  if (channelFilter !== "all") params.channel = channelFilter;
  if (statusFilter !== "all") params.status = statusFilter;

  const { data: orders, isLoading } = useOrders(
    Object.keys(params).length ? params : undefined,
  );
  const createBatch = useCreateBatch();
  const bulkTracking = useBulkUploadTracking();

  // Client-side filtering
  const filtered = React.useMemo(() => {
    if (!orders) return [];
    let list = orders;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.externalOrderId.toLowerCase().includes(q) ||
          o.buyerName.toLowerCase().includes(q) ||
          o.shipToName.toLowerCase().includes(q) ||
          o.items?.some((i) => i.sku.toLowerCase().includes(q)),
      );
    }
    if (channelFilter !== "all") {
      list = list.filter((o) => o.channel === channelFilter);
    }
    if (statusFilter !== "all") {
      list = list.filter((o) => o.status === statusFilter);
    }
    return list;
  }, [orders, search, channelFilter, statusFilter]);

  // URL persistence
  const updateSearch = (value: string) => {
    setSearch(value);
    const sp = new URLSearchParams(searchParams);
    if (value) sp.set("search", value);
    else sp.delete("search");
    setSearchParams(sp, { replace: true });
  };

  const updateChannel = (value: string) => {
    setChannelFilter(value);
    const sp = new URLSearchParams(searchParams);
    if (value !== "all") sp.set("channel", value);
    else sp.delete("channel");
    setSearchParams(sp, { replace: true });
  };

  const updateStatus = (value: string) => {
    setStatusFilter(value);
    const sp = new URLSearchParams(searchParams);
    if (value !== "all") sp.set("status", value);
    else sp.delete("status");
    setSearchParams(sp, { replace: true });
  };

  // Filter chips
  const filterChips = React.useMemo(() => {
    const chips = [];
    if (channelFilter !== "all") {
      chips.push({
        key: "channel",
        label: `Channel: ${channelFilter}`,
        onRemove: () => updateChannel("all"),
      });
    }
    if (statusFilter !== "all") {
      chips.push({
        key: "status",
        label: `Status: ${statusFilter}`,
        onRemove: () => updateStatus("all"),
      });
    }
    return chips;
  }, [channelFilter, statusFilter]);

  const columns: Column<Order>[] = React.useMemo(
    () => [
      {
        key: "externalOrderId",
        header: "Order",
        sortable: true,
        render: (o) => (
          <div className="min-w-0">
            <p className="font-medium text-sm">{o.externalOrderId}</p>
            <p className="text-[11px] text-muted-foreground font-mono">
              {o.id.slice(0, 8)}
            </p>
          </div>
        ),
      },
      {
        key: "channel",
        header: "Channel",
        render: (o) => <ChannelBadge channel={o.channel} />,
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        render: (o) => <OrderStatusBadge status={o.status} />,
      },
      {
        key: "buyer",
        header: "Customer",
        sortable: true,
        render: (o) => (
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{o.shipToName}</p>
            <p className="text-[11px] text-muted-foreground">
              {o.shipToCity}, {o.shipToState}
            </p>
          </div>
        ),
      },
      {
        key: "items",
        header: "Items",
        className: "w-16",
        render: (o) => (
          <span className="text-sm text-muted-foreground">
            {o.items?.length || 0}
          </span>
        ),
      },
      {
        key: "shipment",
        header: "Shipment",
        render: (o) => {
          if (!o.shipment) {
            return <span className="text-xs text-muted-foreground">--</span>;
          }
          return (
            <div className="min-w-0">
              <ShipmentStatusBadge status={o.shipment.status} />
              {o.shipment.trackingNumber && (
                <p className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate max-w-[120px]">
                  {o.shipment.trackingNumber}
                </p>
              )}
            </div>
          );
        },
      },
      {
        key: "date",
        header: "Date",
        sortable: true,
        className: "w-28",
        render: (o) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(o.orderDate)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="p-4 lg:p-6 space-y-3">
      <CommandBar
        search={search}
        onSearchChange={updateSearch}
        placeholder="Search orders, customers, SKUs..."
        filterChips={filterChips}
        selectedCount={selectedKeys.size}
        bulkActions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                createBatch.mutate({ orderIds: Array.from(selectedKeys) });
                setSelectedKeys(new Set());
              }}
              disabled={createBatch.isPending}
            >
              {createBatch.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Layers className="h-3 w-3" />}
              Create Batch
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                bulkTracking.mutate(Array.from(selectedKeys));
                setSelectedKeys(new Set());
              }}
              disabled={bulkTracking.isPending}
            >
              {bulkTracking.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Truck className="h-3 w-3" />}
              Upload Tracking
            </Button>
          </>
        }
        filters={
          <>
            <Select value={channelFilter} onValueChange={updateChannel}>
              <SelectTrigger className="h-9 w-[130px] text-sm">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                {(
                  ["AMAZON", "EBAY", "WALMART", "TEMU", "OTHER"] as ChannelType[]
                ).map((ch) => (
                  <SelectItem key={ch} value={ch}>
                    {ch}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={updateStatus}>
              <SelectTrigger className="h-9 w-[120px] text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {(
                  ["NEW", "READY", "HOLD", "SHIPPED", "CANCELED"] as OrderStatus[]
                ).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      {isLoading ? (
        <TableSkeleton rows={10} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No orders found"
          description={
            search || channelFilter !== "all" || statusFilter !== "all"
              ? "Try adjusting your filters."
              : "Sync orders from your channels to get started."
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={(o) => o.id}
          selectable
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          onRowClick={(o) => setDrawerOrderId(o.id)}
          pageSize={25}
        />
      )}

      {/* Order Details Drawer */}
      <OrderDetailsDrawer
        orderId={drawerOrderId}
        open={!!drawerOrderId}
        onClose={() => setDrawerOrderId(null)}
      />
    </div>
  );
}
