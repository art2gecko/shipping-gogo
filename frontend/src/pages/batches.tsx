import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  FileText,
  Download,
  Loader2,
  Layers,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DataTable, type Column } from "@/components/data-table";
import { OrderStatusBadge } from "@/components/status-badge";
import { ChannelBadge } from "@/components/channel-badge";
import { TableSkeleton } from "@/components/loading";
import { EmptyState } from "@/components/empty-state";
import {
  useBatches,
  useOrders,
  useCreateBatch,
  useGeneratePickList,
  useGenerateManifest,
} from "@/hooks/use-api";
import { documents as docsApi } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type { Batch, Order } from "@/types";

export default function BatchesPage() {
  const navigate = useNavigate();
  const { data: batches, isLoading } = useBatches();
  const generatePickList = useGeneratePickList();
  const generateManifest = useGenerateManifest();

  // Batch wizard state
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [strategy, setStrategy] = React.useState("GROUP_BY_SKU");
  const [selectedOrders, setSelectedOrders] = React.useState<Set<string>>(new Set());
  const [wizardStep, setWizardStep] = React.useState<"select" | "preview">("select");

  const { data: readyOrders } = useOrders({ status: "READY" });
  const createBatch = useCreateBatch();

  const batchColumns: Column<Batch>[] = [
    {
      key: "name",
      header: "Batch Name",
      sortable: true,
      render: (b) => <span className="font-medium">{b.name}</span>,
    },
    {
      key: "strategy",
      header: "Strategy",
      render: (b) => (
        <Badge variant="outline">{b.strategy || "Default"}</Badge>
      ),
    },
    {
      key: "orders",
      header: "Orders",
      render: (b) => (
        <span>{b._count?.orders ?? b.orders?.length ?? 0} orders</span>
      ),
    },
    {
      key: "created",
      header: "Created",
      sortable: true,
      render: (b) => <span className="text-sm">{formatDateTime(b.createdAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      className: "w-48",
      render: (b) => (
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => generatePickList.mutate(b.id)}
            disabled={generatePickList.isPending}
            title="Generate Pick List"
          >
            <ClipboardList className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => generateManifest.mutate(b.id)}
            disabled={generateManifest.isPending}
            title="Generate Manifest"
          >
            <FileText className="h-4 w-4" />
          </Button>
          {b.documents && b.documents.length > 0 && (
            <a
              href={docsApi.downloadUrl(b.documents[b.documents.length - 1].id)}
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="ghost" size="sm" title="Download Latest">
                <Download className="h-4 w-4" />
              </Button>
            </a>
          )}
        </div>
      ),
    },
  ];

  const orderColumns: Column<Order>[] = [
    {
      key: "externalOrderId",
      header: "Order ID",
      sortable: true,
      render: (o) => <span className="font-mono text-sm">{o.externalOrderId}</span>,
    },
    {
      key: "channel",
      header: "Channel",
      render: (o) => <ChannelBadge channel={o.channel} />,
    },
    {
      key: "status",
      header: "Status",
      render: (o) => <OrderStatusBadge status={o.status} />,
    },
    {
      key: "customer",
      header: "Customer",
      render: (o) => <span className="text-sm">{o.shipToName}</span>,
    },
    {
      key: "items",
      header: "Items",
      render: (o) => <span className="text-sm">{o.items?.length ?? 0}</span>,
    },
  ];

  // Group selected orders by strategy for preview
  const previewGroups = React.useMemo(() => {
    if (!readyOrders) return [];
    const selected = readyOrders.filter((o) => selectedOrders.has(o.id));
    const groups = new Map<string, Order[]>();

    selected.forEach((order) => {
      let key: string;
      switch (strategy) {
        case "GROUP_BY_CARRIER":
          key = order.shipment?.carrierCode || "Unknown Carrier";
          break;
        case "GROUP_BY_BIN":
          key = order.items?.[0]?.binLocation || "No Bin";
          break;
        default:
          key = order.items?.map((i) => i.sku).sort().join(", ") || "No SKU";
      }
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(order);
    });

    return Array.from(groups.entries()).map(([key, orders]) => ({
      key,
      count: orders.length,
    }));
  }, [readyOrders, selectedOrders, strategy]);

  const handleCreate = () => {
    createBatch.mutate(
      { orderIds: Array.from(selectedOrders), strategy },
      {
        onSuccess: () => {
          setWizardOpen(false);
          setSelectedOrders(new Set());
          setWizardStep("select");
        },
      },
    );
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Batches</h1>
          <p className="text-muted-foreground">Manage pick/pack waves</p>
        </div>
        <Button onClick={() => setWizardOpen(true)}>
          <Plus className="h-4 w-4" />
          Create Batch
        </Button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : !batches || batches.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No batches yet"
          description="Create a batch to group orders for efficient picking and packing."
          action={
            <Button onClick={() => setWizardOpen(true)}>
              <Plus className="h-4 w-4" />
              Create First Batch
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={batchColumns}
          data={batches}
          keyExtractor={(b) => b.id}
          onRowClick={(b) => navigate(`/batches/${b.id}`)}
        />
      )}

      {/* Create Batch Wizard */}
      <Dialog
        open={wizardOpen}
        onOpenChange={() => {
          setWizardOpen(false);
          setWizardStep("select");
          setSelectedOrders(new Set());
        }}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {wizardStep === "select" ? "Create Batch - Select Orders" : "Create Batch - Preview"}
            </DialogTitle>
            <DialogDescription>
              {wizardStep === "select"
                ? "Choose a strategy and select orders to include."
                : "Review batch grouping before creating."}
            </DialogDescription>
          </DialogHeader>

          {wizardStep === "select" ? (
            <div className="space-y-4">
              <div className="flex items-end gap-4">
                <div className="space-y-2 w-64">
                  <Label>Strategy</Label>
                  <Select value={strategy} onValueChange={setStrategy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GROUP_BY_SKU">Group by SKU</SelectItem>
                      <SelectItem value="GROUP_BY_CARRIER">Group by Carrier</SelectItem>
                      <SelectItem value="GROUP_BY_BIN">Group by Bin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedOrders.size} order{selectedOrders.size !== 1 ? "s" : ""} selected
                </div>
              </div>

              {readyOrders && readyOrders.length > 0 ? (
                <DataTable
                  columns={orderColumns}
                  data={readyOrders}
                  keyExtractor={(o) => o.id}
                  selectable
                  selectedKeys={selectedOrders}
                  onSelectionChange={setSelectedOrders}
                  pageSize={10}
                />
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No READY orders available for batching.
                </p>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setWizardOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => setWizardStep("preview")}
                  disabled={selectedOrders.size === 0}
                >
                  Preview ({selectedOrders.size})
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Strategy: <Badge variant="outline">{strategy.replace(/_/g, " ")}</Badge>
              </div>

              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">Group</th>
                      <th className="px-4 py-3 text-right font-medium">Orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewGroups.map((g) => (
                      <tr key={g.key} className="border-b">
                        <td className="px-4 py-3 font-medium">{g.key}</td>
                        <td className="px-4 py-3 text-right">{g.count}</td>
                      </tr>
                    ))}
                    <tr className="bg-muted/30 font-medium">
                      <td className="px-4 py-3">Total</td>
                      <td className="px-4 py-3 text-right">{selectedOrders.size}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setWizardStep("select")}>
                  Back
                </Button>
                <Button onClick={handleCreate} disabled={createBatch.isPending}>
                  {createBatch.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Batch"
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
