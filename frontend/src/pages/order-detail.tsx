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
  Tag,
  Truck,
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
import { useOrder, useGeneratePackingSlip, useUploadLabel, useHoldOrder, useReleaseHold, usePurchaseLabel, useUploadTracking } from "@/hooks/use-api";
import { documents as docsApi } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/utils";

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { data: order, isLoading } = useOrder(orderId!);
  const generateSlip = useGeneratePackingSlip();
  const uploadLabel = useUploadLabel();
  const holdOrder = useHoldOrder();
  const releaseHold = useReleaseHold();
  const purchaseLabel = usePurchaseLabel();
  const uploadTracking = useUploadTracking();

  const [holdDialog, setHoldDialog] = React.useState(false);
  const [holdReason, setHoldReason] = React.useState("");
  const [uploadDialog, setUploadDialog] = React.useState(false);
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [buyLabelDialog, setBuyLabelDialog] = React.useState(false);
  const [trackingDialog, setTrackingDialog] = React.useState(false);

  // Buy Label form state
  const [labelWeight, setLabelWeight] = React.useState("16");
  const [labelLength, setLabelLength] = React.useState("");
  const [labelWidth, setLabelWidth] = React.useState("");
  const [labelHeight, setLabelHeight] = React.useState("");
  const [labelCarrier, setLabelCarrier] = React.useState("");
  const [shipFromName, setShipFromName] = React.useState("");
  const [shipFromAddr, setShipFromAddr] = React.useState("");
  const [shipFromCity, setShipFromCity] = React.useState("");
  const [shipFromState, setShipFromState] = React.useState("");
  const [shipFromZip, setShipFromZip] = React.useState("");

  // Tracking form state
  const [trackingNum, setTrackingNum] = React.useState("");
  const [trackingCarrier, setTrackingCarrier] = React.useState("");

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
          <Button
            variant="outline"
            onClick={() => setBuyLabelDialog(true)}
            disabled={!order.channelAccountId || order.status === "SHIPPED" || order.status === "CANCELED"}
          >
            <Tag className="h-4 w-4" />
            Buy Label
          </Button>
          <Button variant="outline" onClick={() => setUploadDialog(true)}>
            <Upload className="h-4 w-4" />
            Upload Label
          </Button>
          <Button
            variant="outline"
            onClick={() => setTrackingDialog(true)}
            disabled={!order.channelAccountId || order.status === "CANCELED"}
          >
            <Truck className="h-4 w-4" />
            Upload Tracking
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
                  <div className="flex items-center gap-2 text-sm text-success">
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
          <div className="rounded-xl border border-border bg-card overflow-auto shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">SKU</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Title</th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Qty</th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Serial Required</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Bin</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Serials</th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map((item, idx) => (
                  <tr key={item.id} className={idx < (order.items?.length ?? 0) - 1 ? "border-b border-border/50" : ""}>
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
        <Card className="border-status-hold/30">
          <CardContent className="flex items-center gap-3 p-4">
            <PauseCircle className="h-5 w-5 text-status-hold" />
            <div>
              <p className="font-medium text-status-hold">Order on Hold</p>
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

      {/* Buy Label via Marketplace Dialog */}
      <Dialog open={buyLabelDialog} onOpenChange={() => setBuyLabelDialog(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Buy Shipping Label</DialogTitle>
            <DialogDescription>Purchase a label through {order.channel} marketplace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-auto pr-1">
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Ship To</p>
              <p className="text-sm font-medium">{order.shipToName}</p>
              <p className="text-xs text-muted-foreground">
                {order.shipToAddress1}, {order.shipToCity}, {order.shipToState} {order.shipToZip}
              </p>
            </div>

            <Separator />

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Ship From</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input value={shipFromName} onChange={(e) => setShipFromName(e.target.value)} placeholder="Warehouse Name" className="h-8 text-sm" />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Address</Label>
                  <Input value={shipFromAddr} onChange={(e) => setShipFromAddr(e.target.value)} placeholder="123 Main St" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">City</Label>
                  <Input value={shipFromCity} onChange={(e) => setShipFromCity(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">State</Label>
                    <Input value={shipFromState} onChange={(e) => setShipFromState(e.target.value)} className="h-8 text-sm" maxLength={2} />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">ZIP</Label>
                    <Input value={shipFromZip} onChange={(e) => setShipFromZip(e.target.value)} className="h-8 text-sm" />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Package Details</p>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Weight (oz)</Label>
                  <Input value={labelWeight} onChange={(e) => setLabelWeight(e.target.value)} type="number" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Length</Label>
                  <Input value={labelLength} onChange={(e) => setLabelLength(e.target.value)} type="number" placeholder="in" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Width</Label>
                  <Input value={labelWidth} onChange={(e) => setLabelWidth(e.target.value)} type="number" placeholder="in" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Height</Label>
                  <Input value={labelHeight} onChange={(e) => setLabelHeight(e.target.value)} type="number" placeholder="in" className="h-8 text-sm" />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Carrier Preference (optional)</Label>
              <Input value={labelCarrier} onChange={(e) => setLabelCarrier(e.target.value)} placeholder="e.g., USPS, UPS, FedEx" className="h-8 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuyLabelDialog(false)}>Cancel</Button>
            <Button
              disabled={!shipFromName || !shipFromAddr || !shipFromCity || !shipFromState || !shipFromZip || !labelWeight || purchaseLabel.isPending}
              onClick={() => {
                purchaseLabel.mutate({
                  orderId: order.id,
                  data: {
                    shipFromAddress: {
                      name: shipFromName,
                      address1: shipFromAddr,
                      city: shipFromCity,
                      state: shipFromState,
                      zip: shipFromZip,
                      country: "US",
                    },
                    packageDetails: {
                      weightOz: parseFloat(labelWeight),
                      lengthIn: labelLength ? parseFloat(labelLength) : undefined,
                      widthIn: labelWidth ? parseFloat(labelWidth) : undefined,
                      heightIn: labelHeight ? parseFloat(labelHeight) : undefined,
                    },
                    carrierCode: labelCarrier || undefined,
                  },
                });
                setBuyLabelDialog(false);
              }}
            >
              {purchaseLabel.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
              Purchase Label
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Tracking to Marketplace Dialog */}
      <Dialog open={trackingDialog} onOpenChange={() => setTrackingDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Tracking to {order.channel}</DialogTitle>
            <DialogDescription>
              Confirm shipment by uploading tracking info to the marketplace.
              {order.shipment?.trackingNumber && (
                <span className="block mt-1 text-foreground">
                  Current tracking: <span className="font-mono">{order.shipment.trackingNumber}</span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tracking Number</Label>
              <Input
                value={trackingNum || order.shipment?.trackingNumber || ""}
                onChange={(e) => setTrackingNum(e.target.value)}
                placeholder="Enter tracking number"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Carrier Code</Label>
              <Input
                value={trackingCarrier || order.shipment?.carrierCode || ""}
                onChange={(e) => setTrackingCarrier(e.target.value)}
                placeholder="e.g., USPS, UPS, FedEx"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrackingDialog(false)}>Cancel</Button>
            <Button
              disabled={uploadTracking.isPending}
              onClick={() => {
                uploadTracking.mutate({
                  orderId: order.id,
                  data: {
                    trackingNumber: trackingNum || undefined,
                    carrierCode: trackingCarrier || undefined,
                  },
                });
                setTrackingDialog(false);
                setTrackingNum("");
                setTrackingCarrier("");
              }}
            >
              {uploadTracking.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
              Upload Tracking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
