import * as React from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  Upload,
  Download,
  PauseCircle,
  Play,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { OrderStatusBadge, ShipmentStatusBadge } from "@/components/status-badge";
import { ChannelBadge } from "@/components/channel-badge";
import { PageSkeleton } from "@/components/loading";
import { useOrder, useGeneratePackingSlip, useUploadLabel, useHoldOrder, useReleaseHold } from "@/hooks/use-api";
import { documents as docsApi } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/utils";

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { data: order, isLoading } = useOrder(orderId!);
  const generateSlip = useGeneratePackingSlip();
  const uploadLabel = useUploadLabel();
  const holdOrder = useHoldOrder();
  const releaseHold = useReleaseHold();

  const [holdDialog, setHoldDialog] = React.useState(false);
  const [holdReason, setHoldReason] = React.useState("");
  const [uploadDialog, setUploadDialog] = React.useState(false);
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);

  if (isLoading) return <PageSkeleton />;
  if (!order) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Order not found.</p>
        <Link to="/orders" className="text-primary hover:underline">Back to orders</Link>
      </div>
    );
  }

  const totalSerials = order.items?.reduce(
    (acc, item) => acc + (item.serialRequired ? item.quantity : 0),
    0,
  ) ?? 0;
  const capturedSerials = order.items?.reduce(
    (acc, item) => acc + (item.serialCaptures?.length ?? 0),
    0,
  ) ?? 0;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link to="/orders">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{order.externalOrderId}</h1>
              <ChannelBadge channel={order.channel} />
              <OrderStatusBadge status={order.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Internal: {order.id} &middot; Ordered {formatDate(order.orderDate)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => generateSlip.mutate(order.id)}
            disabled={generateSlip.isPending}
          >
            {generateSlip.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Packing Slip
          </Button>
          <Button variant="outline" onClick={() => setUploadDialog(true)}>
            <Upload className="h-4 w-4" />
            Upload Label
          </Button>
          {order.status === "HOLD" ? (
            <Button variant="success" onClick={() => releaseHold.mutate(order.id)}>
              <Play className="h-4 w-4" />
              Release Hold
            </Button>
          ) : order.status !== "SHIPPED" && order.status !== "CANCELED" ? (
            <Button variant="outline" onClick={() => setHoldDialog(true)}>
              <PauseCircle className="h-4 w-4" />
              Hold
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Shipping Address */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Shipping Address</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-medium">{order.shipToName}</p>
            <p>{order.shipToAddress1}</p>
            {order.shipToAddress2 && <p>{order.shipToAddress2}</p>}
            <p>{order.shipToCity}, {order.shipToState} {order.shipToZip}</p>
            <p>{order.shipToCountry}</p>
          </CardContent>
        </Card>

        {/* Shipment */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Shipment</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {order.shipment ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <ShipmentStatusBadge status={order.shipment.status} />
                </div>
                {order.shipment.carrierCode && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Carrier</span>
                    <span>{order.shipment.carrierCode}</span>
                  </div>
                )}
                {order.shipment.trackingNumber && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tracking</span>
                    <span className="font-mono text-xs">{order.shipment.trackingNumber}</span>
                  </div>
                )}
                {order.shipment.shipDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ship Date</span>
                    <span>{formatDate(order.shipment.shipDate)}</span>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">No shipment yet</p>
            )}
          </CardContent>
        </Card>

        {/* Serial Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Serial Capture</CardTitle>
          </CardHeader>
          <CardContent>
            {totalSerials === 0 ? (
              <p className="text-sm text-muted-foreground">No serials required</p>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{capturedSerials} / {totalSerials} captured</span>
                  <span className="font-medium">
                    {Math.round((capturedSerials / totalSerials) * 100)}%
                  </span>
                </div>
                <Progress value={(capturedSerials / totalSerials) * 100} />
                {capturedSerials === totalSerials && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    All serials captured
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Order Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">SKU</th>
                  <th className="px-4 py-3 text-left font-medium">Title</th>
                  <th className="px-4 py-3 text-center font-medium">Qty</th>
                  <th className="px-4 py-3 text-center font-medium">Serial Required</th>
                  <th className="px-4 py-3 text-left font-medium">Bin</th>
                  <th className="px-4 py-3 text-left font-medium">Serials</th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="px-4 py-3 font-mono font-medium">{item.sku}</td>
                    <td className="px-4 py-3">{item.title}</td>
                    <td className="px-4 py-3 text-center">{item.quantity}</td>
                    <td className="px-4 py-3 text-center">
                      {item.serialRequired ? (
                        <Badge variant="warning">Yes</Badge>
                      ) : (
                        <span className="text-muted-foreground">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{item.binLocation || "-"}</td>
                    <td className="px-4 py-3">
                      {item.serialCaptures && item.serialCaptures.length > 0 ? (
                        <div className="space-y-1">
                          {item.serialCaptures.map((s) => (
                            <Badge key={s.id} variant="outline" className="mr-1 font-mono text-xs">
                              {s.serialCode}
                            </Badge>
                          ))}
                        </div>
                      ) : item.serialRequired ? (
                        <span className="text-muted-foreground text-xs">Pending</span>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documents</CardTitle>
          </CardHeader>
          <CardContent>
            {!order.documents || order.documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents yet</p>
            ) : (
              <div className="space-y-2">
                {order.documents.map((doc) => (
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
            )}
          </CardContent>
        </Card>

        {/* Exceptions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Exceptions</CardTitle>
          </CardHeader>
          <CardContent>
            {!order.exceptions || order.exceptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No exceptions</p>
            ) : (
              <div className="space-y-2">
                {order.exceptions.map((exc) => (
                  <div
                    key={exc.id}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="text-xs">{exc.type}</Badge>
                        {exc.resolved && (
                          <Badge variant="success" className="text-xs">Resolved</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{exc.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDateTime(exc.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {order.holdReason && (
        <Card className="border-yellow-500/50">
          <CardContent className="flex items-center gap-3 p-4">
            <PauseCircle className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-700 dark:text-yellow-400">Order on Hold</p>
              <p className="text-sm text-muted-foreground">{order.holdReason}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hold Dialog */}
      <Dialog open={holdDialog} onOpenChange={() => { setHoldDialog(false); setHoldReason(""); }}>
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
            <Button variant="outline" onClick={() => setHoldDialog(false)}>Cancel</Button>
            <Button onClick={() => {
              holdOrder.mutate({ orderId: order.id, reason: holdReason || "Manual hold" });
              setHoldDialog(false);
              setHoldReason("");
            }}>
              Confirm Hold
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Label Dialog */}
      <Dialog open={uploadDialog} onOpenChange={() => { setUploadDialog(false); setUploadFile(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Shipping Label</DialogTitle>
            <DialogDescription>Upload a PDF or PNG label file.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Label File</Label>
            <Input
              type="file"
              accept=".pdf,.png,application/pdf,image/png"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadDialog(false); setUploadFile(null); }}>Cancel</Button>
            <Button
              disabled={!uploadFile || uploadLabel.isPending}
              onClick={() => {
                if (uploadFile) {
                  uploadLabel.mutate({ orderId: order.id, file: uploadFile });
                  setUploadDialog(false);
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
