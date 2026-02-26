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
} from "lucide-react";
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

export default function DashboardPage() {
  const stats = useDashboardStats();
  const auditLogs = useAuditLogs({ limit: "20" });
  const dailyRun = useDailyRun();
  const syncOrders = useSyncOrders();

  const kpis = [
    { label: "Unshipped", value: stats.data?.unshipped ?? 0, icon: Package, color: "text-blue-600" },
    { label: "Ready", value: stats.data?.ready ?? 0, icon: CheckCircle, color: "text-green-600" },
    { label: "On Hold", value: stats.data?.onHold ?? 0, icon: PauseCircle, color: "text-yellow-600" },
    { label: "Exceptions", value: stats.data?.exceptions ?? 0, icon: AlertTriangle, color: "text-red-600" },
    { label: "Labels Today", value: stats.data?.labelsPurchasedToday ?? 0, icon: Tag, color: "text-purple-600" },
    { label: "Batches Today", value: stats.data?.batchesToday ?? 0, icon: Layers, color: "text-indigo-600" },
  ];

  return (
    <div className="space-y-4 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Today's fulfillment overview</p>
        <div className="flex gap-2">
          <Button
            onClick={() => syncOrders.mutate()}
            disabled={syncOrders.isPending}
            variant="outline"
          >
            {syncOrders.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sync Orders
          </Button>
          <Button
            onClick={() => dailyRun.mutate()}
            disabled={dailyRun.isPending}
          >
            {dailyRun.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Run Daily Automation
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              {stats.isLoading ? (
                <Skeleton className="h-16" />
              ) : (
                <div className="flex flex-col items-center text-center gap-1">
                  <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
                  <p className="text-3xl font-bold">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {auditLogs.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : !auditLogs.data || auditLogs.data.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No recent activity. Run a daily automation or sync orders to get started.
            </p>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {auditLogs.data.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start justify-between gap-4 rounded-lg border p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {auditActionLabels[log.action] || log.action}
                        </Badge>
                      </div>
                      {log.detail && (
                        <p className="mt-1 text-sm text-muted-foreground truncate">
                          {log.detail}
                        </p>
                      )}
                    </div>
                    <time className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </time>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
