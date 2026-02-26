import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, FileText, Upload, PauseCircle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/data-table";
import { OrderStatusBadge } from "@/components/status-badge";
import { ChannelBadge } from "@/components/channel-badge";
import { TableSkeleton } from "@/components/loading";
import { EmptyState } from "@/components/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useOrders, useGeneratePackingSlip, useUploadLabel, useHoldOrder, useReleaseHold } from "@/hooks/use-api";
import { formatDate } from "@/lib/utils";
import type { Order, ChannelType, OrderStatus } from "@/types";
import { Package, MoreHorizontal } from "lucide-react";

export default function OrdersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = React.useState(searchParams.get("search") || "");
  const [channelFilter, setChannelFilter] = React.useState(searchParams.get("channel") || "all");
  const [statusFilter, setStatusFilter] = React.useState(searchParams.get("status") || "all");

  // Dialogs
  const [holdDialog, setHoldDialog] = React.useState<string | null>(null);
  const [holdReason, setHoldReason] = React.useState("");
  const [uploadDialog, setUploadDialog] = React.useState<string | null>(null);
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);

  const params: Record<string, string> = {};
  if (search) params.search = search;
  if (channelFilter !== "all") params.channel = channelFilter;
  if (statusFilter !== "all") params.status = statusFilter;

  const { data: orders, isLoading } = useOrders(Object.keys(params).length ? params : undefined);
  const generateSlip = useGeneratePackingSlip();
  const uploadLabel = useUploadLabel();
  const holdOrder = useHoldOrder();
  const releaseHold = useReleaseHold();

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

  const handleSearch = (value: string) => {
    setSearch(value);
    const sp = new URLSearchParams(searchParams);
    if (value) sp.set("search", value);
    else sp.delete("search");
    setSearchParams(sp, { replace: true });
  };

  const columns: Column<Order>[] = [
    {
      key: "externalOrderId",
      header: "Order ID",
      sortable: true,
      render: (o) => (
        <div>
          <p className="font-medium">{o.externalOrderId}</p>
          <p className="text-xs text-muted-foreground">{o.id.slice(0, 8)}</p>
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
        <div>
          <p className="font-medium">{o.shipToName}</p>
          <p className="text-xs text-muted-foreground">
            {o.shipToCity}, {o.shipToState}
          </p>
        </div>
      ),
    },
    {
      key: "items",
      header: "Items",
      render: (o) => (
        <span className="text-sm">
          {o.items ? `${o.items.length} item${o.items.length !== 1 ? "s" : ""}` : "-"}
        </span>
      ),
    },
    {
      key: "date",
      header: "Order Date",
      sortable: true,
      render: (o) => <span className="text-sm">{formatDate(o.orderDate)}</span>,
    },
    {
      key: "actions",
      header: "",
      className: "w-12",
      render: (o) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/orders/${o.id}`)}>
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => generateSlip.mutate(o.id)}
                disabled={generateSlip.isPending}
              >
                <FileText className="mr-2 h-4 w-4" />
                Generate Packing Slip
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setUploadDialog(o.id)}>
                <Upload className="mr-2 h-4 w-4" />
                Upload Label
              </DropdownMenuItem>
              {o.status === "HOLD" ? (
                <DropdownMenuItem onClick={() => releaseHold.mutate(o.id)}>
                  <Play className="mr-2 h-4 w-4" />
                  Release Hold
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => setHoldDialog(o.id)}>
                  <PauseCircle className="mr-2 h-4 w-4" />
                  Put on Hold
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Orders</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search orders, customers, SKUs..."
            className="pl-10"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            {(["AMAZON", "EBAY", "WALMART", "TEMU", "OTHER"] as ChannelType[]).map((ch) => (
              <SelectItem key={ch} value={ch}>{ch}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {(["NEW", "READY", "HOLD", "SHIPPED", "CANCELED"] as OrderStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={8} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No orders found"
          description="Try adjusting your filters or sync orders from your channels."
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={(o) => o.id}
          onRowClick={(o) => navigate(`/orders/${o.id}`)}
          pageSize={25}
        />
      )}

      {/* Hold Dialog */}
      <Dialog open={!!holdDialog} onOpenChange={() => { setHoldDialog(null); setHoldReason(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Put Order on Hold</DialogTitle>
            <DialogDescription>Provide a reason for holding this order.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea
              value={holdReason}
              onChange={(e) => setHoldReason(e.target.value)}
              placeholder="Enter hold reason..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setHoldDialog(null); setHoldReason(""); }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (holdDialog) {
                  holdOrder.mutate({ orderId: holdDialog, reason: holdReason || "Manual hold" });
                  setHoldDialog(null);
                  setHoldReason("");
                }
              }}
            >
              Confirm Hold
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Label Dialog */}
      <Dialog open={!!uploadDialog} onOpenChange={() => { setUploadDialog(null); setUploadFile(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Shipping Label</DialogTitle>
            <DialogDescription>Upload a PDF or PNG label file.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Label File (PDF or PNG)</Label>
            <Input
              type="file"
              accept=".pdf,.png,application/pdf,image/png"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadDialog(null); setUploadFile(null); }}>
              Cancel
            </Button>
            <Button
              disabled={!uploadFile || uploadLabel.isPending}
              onClick={() => {
                if (uploadDialog && uploadFile) {
                  uploadLabel.mutate({ orderId: uploadDialog, file: uploadFile });
                  setUploadDialog(null);
                  setUploadFile(null);
                }
              }}
            >
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
