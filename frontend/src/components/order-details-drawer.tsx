import * as React from "react";
import {
  X,
  FileText,
  Upload,
  PauseCircle,
  Play,
  Download,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Tag,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { OrderStatusBadge, ShipmentStatusBadge } from "@/components/status-badge";
import { ChannelBadge } from "@/components/channel-badge";
import {
  useOrder,
  useGeneratePackingSlip,
  useUploadLabel,
  useHoldOrder,
  useReleaseHold,
  useUploadTracking,
} from "@/hooks/use-api";
import { documents as docsApi } from "@/lib/api";
import { formatDate, formatDateTime, cn } from "@/lib/utils";

interface OrderDetailsDrawerProps {
  orderId: string | null;
  open: boolean;
  onClose: () => void;
}

export function OrderDetailsDrawer({
  orderId,
  open,
  onClose,
}: OrderDetailsDrawerProps) {
  const { data: order, isLoading } = useOrder(orderId || "");
  const generateSlip = useGeneratePackingSlip();
  const uploadLabel = useUploadLabel();
  const holdOrder = useHoldOrder();
  const releaseHold = useReleaseHold();
  const uploadTracking = useUploadTracking();

  const [holdDialog, setHoldDialog] = React.useState(false);
  const [holdReason, setHoldReason] = React.useState("");
  const [uploadDialog, setUploadDialog] = React.useState(false);
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);

  // Close on escape
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open && !holdDialog && !uploadDialog) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose, holdDialog, uploadDialog]);

  const totalSerials =
    order?.items?.reduce(
      (acc, item) => acc + (item.serialRequired ? item.quantity : 0),
      0,
    ) ?? 0;
  const capturedSerials =
    order?.items?.reduce(
      (acc, item) => acc + (item.serialCaptures?.length ?? 0),
      0,
    ) ?? 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/30 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-full max-w-lg flex flex-col bg-card border-l shadow-2xl transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {isLoading || !order ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between border-b px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-semibold">
                    {order.externalOrderId}
                  </h2>
                  <ChannelBadge channel={order.channel} />
                  <OrderStatusBadge status={order.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {order.id.slice(0, 8)} &middot; {formatDate(order.orderDate)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 -mr-1"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Actions bar */}
            <div className="flex items-center gap-2 border-b px-5 py-2.5 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => generateSlip.mutate(order.id)}
                disabled={generateSlip.isPending}
              >
                {generateSlip.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <FileText className="h-3 w-3" />
                )}
                Packing Slip
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setUploadDialog(true)}
              >
                <Upload className="h-3 w-3" />
                Upload Label
              </Button>
              {order.channelAccountId && order.shipment?.trackingNumber && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => uploadTracking.mutate({ orderId: order.id })}
                  disabled={uploadTracking.isPending}
                >
                  {uploadTracking.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Truck className="h-3 w-3" />}
                  Sync Tracking
                </Button>
              )}
              {order.status === "HOLD" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs text-green-600 border-green-200 hover:bg-green-50"
                  onClick={() => releaseHold.mutate(order.id)}
                >
                  <Play className="h-3 w-3" />
                  Release
                </Button>
              ) : order.status !== "SHIPPED" && order.status !== "CANCELED" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setHoldDialog(true)}
                >
                  <PauseCircle className="h-3 w-3" />
                  Hold
                </Button>
              ) : null}
              <div className="flex-1" />
              <a href={`/orders/${order.id}`} target="_blank" rel="noreferrer">
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  <ExternalLink className="h-3 w-3" />
                  Full Page
                </Button>
              </a>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-auto">
              <div className="p-5 space-y-5">
                {/* Hold warning */}
                {order.holdReason && (
                  <div className="flex items-start gap-2.5 rounded-md border border-warning/30 bg-warning/5 p-3">
                    <PauseCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-warning">
                        On Hold
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {order.holdReason}
                      </p>
                    </div>
                  </div>
                )}

                {/* Shipping Address */}
                <section>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Ship To
                  </h3>
                  <div className="text-sm space-y-0.5">
                    <p className="font-medium">{order.shipToName}</p>
                    <p className="text-muted-foreground">
                      {order.shipToAddress1}
                    </p>
                    {order.shipToAddress2 && (
                      <p className="text-muted-foreground">
                        {order.shipToAddress2}
                      </p>
                    )}
                    <p className="text-muted-foreground">
                      {order.shipToCity}, {order.shipToState} {order.shipToZip}
                    </p>
                    <p className="text-muted-foreground">
                      {order.shipToCountry}
                    </p>
                  </div>
                </section>

                <Separator />

                {/* Shipment */}
                <section>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Shipment
                  </h3>
                  {order.shipment ? (
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Status</span>
                        <ShipmentStatusBadge status={order.shipment.status} />
                      </div>
                      {order.shipment.carrierCode && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Carrier</span>
                          <span className="font-medium">
                            {order.shipment.carrierCode}
                          </span>
                        </div>
                      )}
                      {order.shipment.trackingNumber && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Tracking
                          </span>
                          <span className="font-mono text-xs">
                            {order.shipment.trackingNumber}
                          </span>
                        </div>
                      )}
                      {order.shipment.shipDate && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Ship Date
                          </span>
                          <span>
                            {formatDate(order.shipment.shipDate)}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No shipment yet
                    </p>
                  )}
                </section>

                <Separator />

                {/* Serial Progress */}
                {totalSerials > 0 && (
                  <>
                    <section>
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        Serial Capture
                      </h3>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>
                            {capturedSerials} / {totalSerials} captured
                          </span>
                          <span className="font-medium">
                            {Math.round(
                              (capturedSerials / totalSerials) * 100,
                            )}
                            %
                          </span>
                        </div>
                        <Progress
                          value={(capturedSerials / totalSerials) * 100}
                          className="h-1.5"
                        />
                        {capturedSerials === totalSerials && (
                          <div className="flex items-center gap-1.5 text-xs text-green-600">
                            <CheckCircle className="h-3.5 w-3.5" />
                            All serials captured
                          </div>
                        )}
                      </div>
                    </section>
                    <Separator />
                  </>
                )}

                {/* Items */}
                <section>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Items ({order.items?.length || 0})
                  </h3>
                  <div className="space-y-2">
                    {order.items?.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 rounded-md border p-2.5"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {item.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-mono text-muted-foreground">
                              {item.sku}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              &times; {item.quantity}
                            </span>
                            {item.binLocation && (
                              <span className="text-xs text-muted-foreground">
                                Bin: {item.binLocation}
                              </span>
                            )}
                          </div>
                          {item.serialCaptures &&
                            item.serialCaptures.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {item.serialCaptures.map((s) => (
                                  <Badge
                                    key={s.id}
                                    variant="outline"
                                    className="font-mono text-[10px] px-1.5 py-0"
                                  >
                                    {s.serialCode}
                                  </Badge>
                                ))}
                              </div>
                            )}
                        </div>
                        {item.serialRequired &&
                          !item.serialCaptures?.length && (
                            <Badge
                              variant="warning"
                              className="text-[10px] shrink-0"
                            >
                              Serial needed
                            </Badge>
                          )}
                      </div>
                    ))}
                  </div>
                </section>

                {/* Documents */}
                {order.documents && order.documents.length > 0 && (
                  <>
                    <Separator />
                    <section>
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        Documents
                      </h3>
                      <div className="space-y-1.5">
                        {order.documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between rounded-md border px-3 py-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate">
                                  {doc.fileName}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {doc.type} &middot;{" "}
                                  {formatDateTime(doc.createdAt)}
                                </p>
                              </div>
                            </div>
                            <a
                              href={docsApi.downloadUrl(doc.id)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                              >
                                <Download className="h-3 w-3" />
                              </Button>
                            </a>
                          </div>
                        ))}
                      </div>
                    </section>
                  </>
                )}

                {/* Exceptions */}
                {order.exceptions && order.exceptions.length > 0 && (
                  <>
                    <Separator />
                    <section>
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        Exceptions
                      </h3>
                      <div className="space-y-1.5">
                        {order.exceptions.map((exc) => (
                          <div
                            key={exc.id}
                            className="flex items-start gap-2 rounded-md border p-2.5"
                          >
                            <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <Badge
                                  variant="destructive"
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {exc.type}
                                </Badge>
                                {exc.resolved && (
                                  <Badge
                                    variant="success"
                                    className="text-[10px] px-1.5 py-0"
                                  >
                                    Resolved
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {exc.message}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Hold Dialog */}
      <Dialog
        open={holdDialog}
        onOpenChange={() => {
          setHoldDialog(false);
          setHoldReason("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Put Order on Hold</DialogTitle>
            <DialogDescription>
              Provide a reason for holding this order.
            </DialogDescription>
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
            <Button
              variant="outline"
              onClick={() => {
                setHoldDialog(false);
                setHoldReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (order) {
                  holdOrder.mutate({
                    orderId: order.id,
                    reason: holdReason || "Manual hold",
                  });
                  setHoldDialog(false);
                  setHoldReason("");
                }
              }}
            >
              Confirm Hold
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog
        open={uploadDialog}
        onOpenChange={() => {
          setUploadDialog(false);
          setUploadFile(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Shipping Label</DialogTitle>
            <DialogDescription>
              Upload a PDF or PNG label file.
            </DialogDescription>
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
            <Button
              variant="outline"
              onClick={() => {
                setUploadDialog(false);
                setUploadFile(null);
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!uploadFile || uploadLabel.isPending}
              onClick={() => {
                if (order && uploadFile) {
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
    </>
  );
}
