import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardList, FileText, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/data-table";
import { OrderStatusBadge } from "@/components/status-badge";
import { ChannelBadge } from "@/components/channel-badge";
import { PageSkeleton } from "@/components/loading";
import { useBatch, useGeneratePickList, useGenerateManifest } from "@/hooks/use-api";
import { documents as docsApi } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type { BatchOrderWithOrder } from "@/types";

export default function BatchDetailPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const { data: batch, isLoading } = useBatch(batchId!);
  const generatePickList = useGeneratePickList();
  const generateManifest = useGenerateManifest();

  if (isLoading) return <PageSkeleton />;
  if (!batch) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Batch not found.</p>
        <Link to="/batches" className="text-primary hover:underline">Back to batches</Link>
      </div>
    );
  }

  const orderColumns: Column<BatchOrderWithOrder>[] = [
    {
      key: "position",
      header: "#",
      render: (bo) => <span className="text-muted-foreground">{bo.position}</span>,
    },
    {
      key: "externalOrderId",
      header: "Order ID",
      sortable: true,
      render: (bo) => (
        <span className="font-mono font-medium">{bo.order.externalOrderId}</span>
      ),
    },
    {
      key: "channel",
      header: "Channel",
      render: (bo) => <ChannelBadge channel={bo.order.channel} />,
    },
    {
      key: "status",
      header: "Status",
      render: (bo) => <OrderStatusBadge status={bo.order.status} />,
    },
    {
      key: "customer",
      header: "Customer",
      render: (bo) => <span className="text-sm">{bo.order.shipToName}</span>,
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link to="/batches">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{batch.name}</h1>
            <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
              <Badge variant="outline">{batch.strategy || "Default"}</Badge>
              <span>{batch.orders?.length ?? 0} orders</span>
              <span>Created {formatDateTime(batch.createdAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => generatePickList.mutate(batch.id)}
            disabled={generatePickList.isPending}
          >
            {generatePickList.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ClipboardList className="h-4 w-4" />
            )}
            Pick List
          </Button>
          <Button
            variant="outline"
            onClick={() => generateManifest.mutate(batch.id)}
            disabled={generateManifest.isPending}
          >
            {generateManifest.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Manifest
          </Button>
        </div>
      </div>

      {/* Orders in batch */}
      {batch.orders && batch.orders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Orders in Batch</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={orderColumns}
              data={batch.orders}
              keyExtractor={(bo) => bo.id}
              onRowClick={(bo) => navigate(`/orders/${bo.orderId}`)}
            />
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      {batch.documents && batch.documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {batch.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{doc.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.type} &middot; {formatDateTime(doc.createdAt)}
                      </p>
                    </div>
                  </div>
                  <a href={docsApi.downloadUrl(doc.id)} target="_blank" rel="noreferrer">
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
