import * as React from "react";
import {
  ScanBarcode,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useOrders, useBatches, useOrder, useCaptureSerial } from "@/hooks/use-api";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { OrderItem } from "@/types";

export default function SerialCapturePage() {
  const [mode, setMode] = React.useState<"order" | "batch">("order");
  const [selectedId, setSelectedId] = React.useState("");
  const [scanInput, setScanInput] = React.useState("");
  const [scannedSerials, setScannedSerials] = React.useState<Map<string, string[]>>(new Map());
  const [lastError, setLastError] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const { data: orders } = useOrders({ status: "READY" });
  const { data: batchesList } = useBatches();
  const { data: orderDetail, refetch: refetchOrder } = useOrder(selectedId && mode === "order" ? selectedId : "");
  const captureSerial = useCaptureSerial();

  // Gather items that need serials
  const serialItems = React.useMemo<OrderItem[]>(() => {
    if (!orderDetail?.items) return [];
    return orderDetail.items.filter((i) => i.serialRequired);
  }, [orderDetail]);

  // Current item needing a scan
  const currentItem = React.useMemo(() => {
    for (const item of serialItems) {
      const captured = (item.serialCaptures?.length ?? 0) + (scannedSerials.get(item.id)?.length ?? 0);
      if (captured < item.quantity) return item;
    }
    return null;
  }, [serialItems, scannedSerials]);

  // Stats
  const totalRequired = serialItems.reduce((acc, i) => acc + i.quantity, 0);
  const totalCaptured = serialItems.reduce(
    (acc, i) => acc + (i.serialCaptures?.length ?? 0) + (scannedSerials.get(i.id)?.length ?? 0),
    0,
  );
  const allDone = totalRequired > 0 && totalCaptured >= totalRequired;
  const progressPct = totalRequired > 0 ? (totalCaptured / totalRequired) * 100 : 0;

  React.useEffect(() => {
    if (selectedId) inputRef.current?.focus();
  }, [selectedId, currentItem]);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const serial = scanInput.trim();
    if (!serial || !currentItem) return;

    setLastError("");

    // Check for duplicates
    const allScanned = Array.from(scannedSerials.values()).flat();
    const allExisting = serialItems.flatMap((i) => i.serialCaptures?.map((s) => s.serialCode) ?? []);
    if (allScanned.includes(serial) || allExisting.includes(serial)) {
      setLastError(`Duplicate serial: ${serial}`);
      toast({ title: "Duplicate Serial", description: serial, variant: "destructive" });
      setScanInput("");
      inputRef.current?.focus();
      return;
    }

    try {
      await captureSerial.mutateAsync({
        orderItemId: currentItem.id,
        serialCode: serial,
      });

      // Track locally
      setScannedSerials((prev) => {
        const next = new Map(prev);
        const existing = next.get(currentItem.id) ?? [];
        next.set(currentItem.id, [...existing, serial]);
        return next;
      });

      toast({ title: "Serial Captured", description: serial, variant: "default" });
    } catch {
      // Error toast handled by hook
    }

    setScanInput("");
    inputRef.current?.focus();
  };

  const handleReset = () => {
    setSelectedId("");
    setScannedSerials(new Map());
    setLastError("");
    setScanInput("");
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Serial Capture</h1>
        <p className="text-muted-foreground">Warehouse barcode scanning mode</p>
      </div>

      {/* Selector */}
      {!selectedId ? (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="text-base">Select Order or Batch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={mode === "order" ? "default" : "outline"}
                onClick={() => setMode("order")}
              >
                By Order
              </Button>
              <Button
                variant={mode === "batch" ? "default" : "outline"}
                onClick={() => setMode("batch")}
              >
                By Batch
              </Button>
            </div>
            <div className="space-y-2">
              <Label>{mode === "order" ? "Order" : "Batch"}</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${mode}...`} />
                </SelectTrigger>
                <SelectContent>
                  {mode === "order"
                    ? orders?.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.externalOrderId} - {o.shipToName}
                        </SelectItem>
                      ))
                    : batchesList?.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Progress overview */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-lg">
                    {orderDetail?.externalOrderId || selectedId}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {totalCaptured} / {totalRequired} serials captured
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Change Order
                </Button>
              </div>
              <Progress value={progressPct} className="h-3" />
            </CardContent>
          </Card>

          {/* Scan input */}
          {allDone ? (
            <Card className="border-green-500/50">
              <CardContent className="flex flex-col items-center gap-4 p-8">
                <CheckCircle className="h-16 w-16 text-green-600" />
                <h2 className="text-2xl font-bold text-green-700 dark:text-green-400">
                  All Serials Captured!
                </h2>
                <p className="text-muted-foreground">
                  {totalCaptured} serial{totalCaptured !== 1 ? "s" : ""} scanned successfully.
                </p>
                <Button onClick={handleReset}>
                  <ChevronRight className="h-4 w-4" />
                  Next Order
                </Button>
              </CardContent>
            </Card>
          ) : currentItem ? (
            <Card className="max-w-2xl">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <ScanBarcode className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-lg font-bold">Scan: {currentItem.sku}</p>
                    <p className="text-sm text-muted-foreground">{currentItem.title}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-base px-3 py-1">
                    {(currentItem.serialCaptures?.length ?? 0) + (scannedSerials.get(currentItem.id)?.length ?? 0)}{" "}
                    / {currentItem.quantity}
                  </Badge>
                  <span className="text-sm text-muted-foreground">for this SKU</span>
                </div>

                <form onSubmit={handleScan} className="flex gap-3">
                  <Input
                    ref={inputRef}
                    value={scanInput}
                    onChange={(e) => {
                      setScanInput(e.target.value);
                      setLastError("");
                    }}
                    placeholder="Scan barcode here..."
                    className="h-14 text-xl font-mono"
                    autoFocus
                    autoComplete="off"
                  />
                  <Button type="submit" size="xl" disabled={!scanInput.trim() || captureSerial.isPending}>
                    {captureSerial.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      "Submit"
                    )}
                  </Button>
                </form>

                {lastError && (
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">{lastError}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <p className="text-muted-foreground">No items requiring serial capture in this order.</p>
          )}

          {/* Per-item progress */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {serialItems.map((item) => {
              const captured =
                (item.serialCaptures?.length ?? 0) + (scannedSerials.get(item.id)?.length ?? 0);
              const done = captured >= item.quantity;
              const isCurrent = currentItem?.id === item.id;
              return (
                <Card
                  key={item.id}
                  className={cn(
                    "transition-colors",
                    isCurrent && "ring-2 ring-primary",
                    done && "border-green-500/50",
                  )}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-mono font-bold">{item.sku}</p>
                      {done ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : isCurrent ? (
                        <ScanBarcode className="h-5 w-5 text-primary animate-pulse" />
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{item.title}</p>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={(captured / item.quantity) * 100}
                        className="h-2 flex-1"
                      />
                      <span className="text-xs font-medium">
                        {captured}/{item.quantity}
                      </span>
                    </div>
                    {/* Show scanned serials */}
                    {(item.serialCaptures?.length ?? 0) + (scannedSerials.get(item.id)?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.serialCaptures?.map((s) => (
                          <Badge key={s.id} variant="outline" className="text-xs font-mono">
                            {s.serialCode}
                          </Badge>
                        ))}
                        {scannedSerials.get(item.id)?.map((s, i) => (
                          <Badge key={`new-${i}`} variant="default" className="text-xs font-mono">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
