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
  INTEGRATION_CONNECT: Activity,
  INTEGRATION_TEST: Activity,
  INTEGRATION_DISCONNECT: Activity,
};

const auditActionColors: Record<AuditAction, string> = {
  ORDER_IMPORTED: "text-blue-500",
  ORDER_UPDATED: "text-blue-500",
  BATCH_CREATED: "text-indigo-500",
  LABEL_PURCHASED: "text-purple-500",
  LABEL_REPRINTED: "text-purple-500",
  SERIAL_SCANNED: "text-green-500",
  DOCUMENT_CREATED: "text-muted-foreground",
  TRACKING_UPLOADED: "text-green-600",
  EXCEPTION_CREATED: "text-red-500",
  EXCEPTION_RESOLVED: "text-green-500",
  SETTINGS_UPDATED: "text-muted-foreground",
  INTEGRATION_CONNECT: "text-blue-500",
  INTEGRATION_TEST: "text-blue-500",
  INTEGRATION_DISCONNECT: "text-muted-foreground",
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

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Today's fulfillment overview
          </p>
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

      {/* Shipping Pipeline */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Shipping Pipeline
            </CardTitle>
            {stats.isLoading ? (
              <Skeleton className="h-5 w-16" />
            ) : (
              <Badge variant="outline" className="text-xs font-mono">
                {total} active
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {stats.isLoading ? (
            <Skeleton className="h-24" />
          ) : (
            <>
              {/* Pipeline stages */}
              <div className="flex items-center gap-1 mb-4">
                <PipelineStage
                  label="Unshipped"
                  count={unshipped}
                  color="bg-blue-500"
                  total={total}
                  onClick={() => navigate("/orders?status=NEW")}
                />
                <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                <PipelineStage
                  label="Ready"
                  count={ready}
                  color="bg-green-500"
                  total={total}
                  onClick={() => navigate("/orders?status=READY")}
                />
                <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                <PipelineStage
                  label="On Hold"
                  count={onHold}
                  color="bg-amber-500"
                  total={total}
                  onClick={() => navigate("/orders?status=HOLD")}
                />
                <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                <PipelineStage
                  label="Exceptions"
                  count={exceptions}
                  color="bg-red-500"
                  total={total}
                  onClick={() => navigate("/exceptions")}
                  isAlert={exceptions > 0}
                />
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Pipeline progress</span>
                  <span className="font-medium">{shippedPercent}% ready to ship</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                  {total > 0 && (
                    <>
                      <div
                        className="bg-green-500 transition-all duration-500"
                        style={{ width: `${(ready / total) * 100}%` }}
                      />
                      <div
                        className="bg-blue-500 transition-all duration-500"
                        style={{ width: `${(unshipped / total) * 100}%` }}
                      />
                      <div
                        className="bg-amber-500 transition-all duration-500"
                        style={{ width: `${(onHold / total) * 100}%` }}
                      />
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard
          label="Unshipped Orders"
          value={unshipped}
          icon={Package}
          color="text-blue-600"
          bgColor="bg-blue-500/10"
          loading={stats.isLoading}
          onClick={() => navigate("/orders?status=NEW")}
        />
        <KPICard
          label="Ready to Ship"
          value={ready}
          icon={CheckCircle}
          color="text-green-600"
          bgColor="bg-green-500/10"
          loading={stats.isLoading}
          onClick={() => navigate("/orders?status=READY")}
        />
        <KPICard
          label="Labels Today"
          value={labelsToday}
          icon={Tag}
          color="text-purple-600"
          bgColor="bg-purple-500/10"
          loading={stats.isLoading}
        />
        <KPICard
          label="Batches Today"
          value={batchesToday}
          icon={Layers}
          color="text-indigo-600"
          bgColor="bg-indigo-500/10"
          loading={stats.isLoading}
          onClick={() => navigate("/batches")}
        />
      </div>

      {/* Two-column layout: Quick Actions + Activity Feed */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Quick Actions */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <QuickAction
                label="Create Batch"
                description="Group ready orders for picking"
                icon={Layers}
                onClick={() => navigate("/batches")}
              />
              <QuickAction
                label="Scan Serials"
                description="Warehouse barcode scanning"
                icon={CheckCircle}
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
                icon={Activity}
                onClick={() => navigate("/settings/integrations")}
              />
            </CardContent>
          </Card>

          {/* Alert Card for exceptions */}
          {exceptions > 0 && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {exceptions} unresolved exception{exceptions !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Address issues, failed labels, or auth problems need attention
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
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Activity Feed
            </CardTitle>
          </CardHeader>
          <CardContent>
            {auditLogs.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
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
              <ScrollArea className="h-[420px]">
                <div className="space-y-1">
                  {auditLogs.data.map((log) => {
                    const Icon = auditActionIcons[log.action] || Activity;
                    const color = auditActionColors[log.action] || "text-muted-foreground";

                    return (
                      <div
                        key={log.id}
                        className="flex items-start gap-3 rounded-md px-2 py-2.5 hover:bg-muted/40 transition-colors"
                      >
                        <div className="mt-0.5 shrink-0">
                          <Icon className={`h-4 w-4 ${color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">
                              {auditActionLabels[log.action] || log.action}
                            </span>
                          </div>
                          {log.detail && (
                            <p className="mt-0.5 text-xs text-muted-foreground truncate">
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

function PipelineStage({
  label,
  count,
  color,
  total,
  onClick,
  isAlert,
}: {
  label: string;
  count: number;
  color: string;
  total: number;
  onClick?: () => void;
  isAlert?: boolean;
}) {
  return (
    <button
      className="flex-1 rounded-lg border p-3 text-center hover:bg-muted/50 transition-colors cursor-pointer min-w-0"
      onClick={onClick}
    >
      <div className="flex items-center justify-center gap-1.5 mb-1">
        <div className={`h-2 w-2 rounded-full ${color} ${isAlert ? "animate-pulse" : ""}`} />
        <span className="text-2xl font-bold tabular-nums">{count}</span>
      </div>
      <p className="text-[11px] text-muted-foreground font-medium truncate">{label}</p>
    </button>
  );
}

function KPICard({
  label,
  value,
  icon: Icon,
  color,
  bgColor,
  loading,
  onClick,
}: {
  label: string;
  value: number;
  icon: typeof Package;
  color: string;
  bgColor: string;
  loading?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      className={onClick ? "cursor-pointer hover:bg-muted/40 transition-colors" : ""}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {loading ? (
          <Skeleton className="h-16" />
        ) : (
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${bgColor}`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold tabular-nums">{value}</p>
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
