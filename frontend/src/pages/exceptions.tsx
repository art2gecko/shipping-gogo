import * as React from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ExceptionTypeBadge } from "@/components/status-badge";
import { ChannelBadge } from "@/components/channel-badge";
import { TableSkeleton } from "@/components/loading";
import { EmptyState } from "@/components/empty-state";
import { useExceptions, useResolveException } from "@/hooks/use-api";
import { formatDateTime } from "@/lib/utils";
import type { Exception, ExceptionType } from "@/types";

const EXCEPTION_TYPES: ExceptionType[] = [
  "ADDRESS_INVALID",
  "SERIAL_MISSING",
  "SERIAL_INVALID",
  "LABEL_PURCHASE_FAILED",
  "TRACKING_UPLOAD_FAILED",
  "API_AUTH_FAILED",
  "UNKNOWN",
];

export default function ExceptionsPage() {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [showResolved, setShowResolved] = React.useState(false);
  const [resolveDialog, setResolveDialog] = React.useState<string | null>(null);
  const [resolveNote, setResolveNote] = React.useState("");

  const params: Record<string, string> = {};
  if (typeFilter !== "all") params.type = typeFilter;
  if (!showResolved) params.resolved = "false";

  const { data: exceptions, isLoading } = useExceptions(
    Object.keys(params).length ? params : undefined,
  );
  const resolveException = useResolveException();

  const filtered = React.useMemo(() => {
    if (!exceptions) return [];
    let list = exceptions;
    if (typeFilter !== "all") list = list.filter((e) => e.type === typeFilter);
    if (!showResolved) list = list.filter((e) => !e.resolved);
    return list;
  }, [exceptions, typeFilter, showResolved]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Exceptions</h1>
          <p className="text-muted-foreground">
            {filtered.length} exception{filtered.length !== 1 ? "s" : ""} in queue
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {EXCEPTION_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={showResolved ? "default" : "outline"}
          size="sm"
          onClick={() => setShowResolved(!showResolved)}
        >
          {showResolved ? "Showing All" : "Show Resolved"}
        </Button>
      </div>

      {/* Exception list */}
      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CheckCircle}
          title="No exceptions"
          description={
            showResolved
              ? "No exceptions match your filters."
              : "All exceptions have been resolved. Great work!"
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((exc) => (
            <Card key={exc.id} className={exc.resolved ? "opacity-60" : ""}>
              <CardContent className="flex items-start gap-4 p-4">
                <div className="mt-0.5 shrink-0">
                  {exc.resolved ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <ExceptionTypeBadge type={exc.type} />
                    {exc.order && <ChannelBadge channel={exc.order.channel} />}
                    {exc.resolved && (
                      <Badge variant="success">Resolved</Badge>
                    )}
                  </div>
                  <p className="text-sm">{exc.message}</p>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span>{formatDateTime(exc.createdAt)}</span>
                    {exc.orderId && (
                      <button
                        className="flex items-center gap-1 text-primary hover:underline"
                        onClick={() => navigate(`/orders/${exc.orderId}`)}
                      >
                        <ExternalLink className="h-3 w-3" />
                        View Order
                      </button>
                    )}
                    {exc.resolvedAt && (
                      <span>Resolved {formatDateTime(exc.resolvedAt)}</span>
                    )}
                  </div>
                </div>
                {!exc.resolved && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setResolveDialog(exc.id)}
                  >
                    Resolve
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Resolve Dialog */}
      <Dialog
        open={!!resolveDialog}
        onOpenChange={() => {
          setResolveDialog(null);
          setResolveNote("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Exception</DialogTitle>
            <DialogDescription>Optionally add a note explaining the resolution.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Textarea
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              placeholder="Resolution notes..."
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResolveDialog(null);
                setResolveNote("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (resolveDialog) {
                  resolveException.mutate({ id: resolveDialog, note: resolveNote || undefined });
                  setResolveDialog(null);
                  setResolveNote("");
                }
              }}
              disabled={resolveException.isPending}
            >
              {resolveException.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Resolve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
