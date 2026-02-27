import * as React from "react";
import {
  Package,
  CheckCircle,
  PauseCircle,
  AlertTriangle,
  Tag,
  Layers,
  Play,
  RefreshCw,
  Loader2,
  ArrowRight,
  TrendingUp,
  Truck,
  Clock,
  Activity,
  ScanBarcode,
  Plug,
  Calendar,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useDashboardStats,
  useDailyRun,
  useSyncOrders,
  useAuditLogs,
} from "@/hooks/use-api";
import { formatDateTime } from "@/lib/utils";
import type { AuditAction } from "@/types";

const auditActionLabels: Record<AuditAction, string> = {
  ORDER_IMPORTED: "Order Imported",
  ORDER_UPDATED: "Order Updated",
  BATCH_CREATED: "Batch Created",
  LABEL_PURCHASED: "Label Purchased",
  LABEL_REPRINTED: "Label Reprinted",
  SERIAL_SCANNED: "Serial Scanned",
  DOCUMENT_CREATED: "Document Created",
  TRACKING_UPLOADED: "Tracking Uploaded",
  EXCEPTION_CREATED: "Exception Created",
  EXCEPTION_RESOLVED: "Exception Resolved",
  SETTINGS_UPDATED: "Settings Updated",
  INTEGRATION_CONNECT: "Integration Connected",
  INTEGRATION_TEST: "Integration Tested",
  INTEGRATION_DISCONNECT: "Integration Disconnected",
  INTEGRATION_CREDENTIALS: "Credentials Updated",
};

const auditActionIcons: Record<AuditAction, typeof Package> = {
  ORDER_IMPORTED: Package,
  ORDER_UPDATED: Package,
  BATCH_CREATED: Layers,
  LABEL_PURCHASED: Tag,
  LABEL_REPRINTED: Tag,
  SERIAL_SCANNED: CheckCircle,
  DOCUMENT_CREATED: Activity,
  TRACKING_UPLOADED: Truck,
  EXCEPTION_CREATED: AlertTriangle,
  EXCEPTION_RESOLVED: CheckCircle,
  SETTINGS_UPDATED: Activity,
  INTEGRATION_CONNECT: Plug,
  INTEGRATION_TEST: Activity,
  INTEGRATION_DISCONNECT: Activity,
  INTEGRATION_CREDENTIALS: Activity,
};

const auditActionColors: Record<AuditAction, string> = {
  ORDER_IMPORTED: "text-audit-import",
  ORDER_UPDATED: "text-audit-import",
  BATCH_CREATED: "text-audit-batch",
  LABEL_PURCHASED: "text-audit-label",
  LABEL_REPRINTED: "text-audit-label",
  SERIAL_SCANNED: "text-audit-serial",
  DOCUMENT_CREATED: "text-audit-neutral",
  TRACKING_UPLOADED: "text-audit-tracking",
  EXCEPTION_CREATED: "text-audit-exception",
  EXCEPTION_RESOLVED: "text-audit-resolved",
  SETTINGS_UPDATED: "text-audit-neutral",
  INTEGRATION_CONNECT: "text-audit-integration",
  INTEGRATION_TEST: "text-audit-integration",
  INTEGRATION_DISCONNECT: "text-audit-neutral",
  INTEGRATION_CREDENTIALS: "text-audit-integration",
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const stats = useDashboardStats();
  const auditLogs = useAuditLogs({ limit: "30" });
  const dailyRun = useDailyRun();
  const syncOrders = useSyncOrders();

  const unshipped = stats.data?.unshipped ?? 0;
  const ready = stats.data?.ready ?? 0;
  const onHold = stats.data?.onHold ?? 0;
  const exceptions = stats.data?.exceptions ?? 0;
  const labelsToday = stats.data?.labelsPurchasedToday ?? 0;
  const batchesToday = stats.data?.batchesToday ?? 0;
  const total = unshipped + ready + onHold;
  const shippedPercent = total > 0 ? Math.round((ready / total) * 100) : 0;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* ── Today header + actions ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-0.5">
            <Calendar className="h-3.5 w-3.5" />
            <span>{today}</span>
          </div>
          <h1 className="text-lg font-semibold text-foreground">
            Fulfillment Overview
          </h1>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => syncOrders.mutate()}
            disabled={syncOrders.isPending}
            variant="outline"
            size="sm"
          >
            {syncOrders.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Sync Orders
          </Button>
          <Button
            onClick={() => dailyRun.mutate()}
            disabled={dailyRun.isPending}
            size="sm"
          >
            {dailyRun.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Run Daily Automation
          </Button>
        </div>
      </div>

      {/* ── Queue cards row (task-first: what needs attention) ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <QueueCard
          label="Ready to Ship"
          count={ready}
          icon={CheckCircle}
          color="text-status-ready"
          bgColor="bg-status-ready/10"
          loading={stats.isLoading}
          onClick={() => navigate("/orders?status=READY")}
        />
        <QueueCard
          label="Unshipped"
          count={unshipped}
          icon={Package}
          color="text-kpi-unshipped"
          bgColor="bg-kpi-unshipped-bg"
          loading={stats.isLoading}
          onClick={() => navigate("/orders?status=NEW")}
        />
        <QueueCard
          label="On Hold"
          count={onHold}
          icon={PauseCircle}
          color="text-status-hold"
          bgColor="bg-status-hold/10"
          loading={stats.isLoading}
          onClick={() => navigate("/orders?status=HOLD")}
          alert={onHold > 0}
        />
        <QueueCard
          label="Exceptions"
          count={exceptions}
          icon={AlertTriangle}
          color="text-destructive"
          bgColor="bg-destructive/8"
          loading={stats.isLoading}
          onClick={() => navigate("/exceptions")}
          alert={exceptions > 0}
        />
      </div>

      {/* ── Pipeline progress ── */}
      <Card>
        <CardContent className="p-4">
          {stats.isLoading ? (
            <Skeleton className="h-12" />
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Pipeline</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{total} active orders</span>
                  <span className="font-semibold text-foreground">
                    {shippedPercent}% ready
                  </span>
                </div>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden flex">
                {total > 0 && (
                  <>
                    <div
                      className="bg-status-ready transition-all duration-500"
                      style={{ width: `${(ready / total) * 100}%` }}
                    />
                    <div
                      className="bg-status-new transition-all duration-500"
                      style={{ width: `${(unshipped / total) * 100}%` }}
                    />
                    <div
                      className="bg-status-hold transition-all duration-500"
                      style={{ width: `${(onHold / total) * 100}%` }}
                    />
                  </>
                )}
              </div>
              <div className="flex gap-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-status-ready" />
                  Ready
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-status-new" />
                  Unshipped
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-status-hold" />
                  On Hold
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Today's stats row ── */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/batches")}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-kpi-labels-bg">
              <Tag className="h-4 w-4 text-kpi-labels" />
            </div>
            <div>
              {stats.isLoading ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                <p className="text-xl font-bold tabular-nums">{labelsToday}</p>
              )}
              <p className="text-xs text-muted-foreground">Labels Today</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/batches")}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-kpi-batches-bg">
              <Layers className="h-4 w-4 text-kpi-batches" />
            </div>
            <div>
              {stats.isLoading ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                <p className="text-xl font-bold tabular-nums">{batchesToday}</p>
              )}
              <p className="text-xs text-muted-foreground">Batches Today</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Two-column: Quick Actions + Activity Feed ── */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Quick Actions */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <QuickAction
                label="Create Batch"
                description="Group ready orders for picking"
                icon={Layers}
                onClick={() => navigate("/batches")}
              />
              <QuickAction
                label="Scan Serials"
                description="Warehouse barcode scanning"
                icon={ScanBarcode}
                onClick={() => navigate("/serial-capture")}
              />
              <QuickAction
                label="View Exceptions"
                description={`${exceptions} unresolved exception${exceptions !== 1 ? "s" : ""}`}
                icon={AlertTriangle}
                onClick={() => navigate("/exceptions")}
                alert={exceptions > 0}
              />
              <QuickAction
                label="Manage Integrations"
                description="Amazon, eBay, Temu accounts"
                icon={Plug}
                onClick={() => navigate("/settings/integrations")}
              />
            </CardContent>
          </Card>

          {/* Exception alert */}
          {exceptions > 0 && (
            <Card className="border-destructive/20">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {exceptions} unresolved exception{exceptions !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Address issues or failed labels need attention
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => navigate("/exceptions")}
                >
                  Review
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Activity Feed */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Activity Feed
            </CardTitle>
          </CardHeader>
          <CardContent>
            {auditLogs.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : !auditLogs.data || auditLogs.data.length === 0 ? (
              <div className="py-12 text-center">
                <Activity className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  No recent activity. Sync orders or run automation to get started.
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-0.5">
                  {auditLogs.data.map((log) => {
                    const Icon = auditActionIcons[log.action] || Activity;
                    const color = auditActionColors[log.action] || "text-muted-foreground";

                    return (
                      <div
                        key={log.id}
                        className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/50 transition-colors"
                      >
                        <div className="mt-0.5 shrink-0">
                          <Icon className={`h-3.5 w-3.5 ${color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium">
                            {auditActionLabels[log.action] || log.action}
                          </span>
                          {log.detail && (
                            <p className="text-xs text-muted-foreground truncate">
                              {log.detail}
                            </p>
                          )}
                        </div>
                        <time className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
                          {formatDateTime(log.createdAt)}
                        </time>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function QueueCard({
  label,
  count,
  icon: Icon,
  color,
  bgColor,
  loading,
  onClick,
  alert,
}: {
  label: string;
  count: number;
  icon: typeof Package;
  color: string;
  bgColor: string;
  loading?: boolean;
  onClick?: () => void;
  alert?: boolean;
}) {
  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow ${alert ? "ring-1 ring-destructive/20" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {loading ? (
          <Skeleton className="h-16" />
        ) : (
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${bgColor}`}>
              <Icon className={`h-5 w-5 ${color} ${alert ? "animate-pulse" : ""}`} />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold tabular-nums">{count}</p>
              <p className="text-xs text-muted-foreground truncate">{label}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuickAction({
  label,
  description,
  icon: Icon,
  onClick,
  alert,
}: {
  label: string;
  description: string;
  icon: typeof Package;
  onClick: () => void;
  alert?: boolean;
}) {
  return (
    <button
      className="flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
      onClick={onClick}
    >
      <Icon className={`h-4 w-4 shrink-0 ${alert ? "text-destructive" : "text-muted-foreground"}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[11px] text-muted-foreground truncate">{description}</p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
    </button>
  );
}
