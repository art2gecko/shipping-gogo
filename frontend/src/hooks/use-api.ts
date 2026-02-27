import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { ApiError } from "@/lib/api";
import type { PurchaseLabelPayload, UploadTrackingPayload } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import type { CreateBatchPayload, CaptureSerialPayload, TemuManualConnectPayload } from "@/types";

// ── Dashboard ──

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: api.dashboard.stats,
    refetchInterval: 30_000,
  });
}

export function useDailyRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.dashboard.dailyRun,
    onSuccess: (data) => {
      toast({ title: "Daily Run Started", description: data.message });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: ApiError) => {
      toast({ title: "Daily Run Failed", description: err.message, variant: "destructive" });
    },
  });
}

export function useSyncOrders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.dashboard.syncOrders,
    onSuccess: (data) => {
      toast({ title: "Sync Started", description: data.message });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: ApiError) => {
      toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
    },
  });
}

// ── Orders ──

export function useOrders(params?: Record<string, string>) {
  return useQuery({
    queryKey: ["orders", params],
    queryFn: () => api.orders.list(params),
    staleTime: 10_000,
  });
}

export function useOrder(orderId: string) {
  return useQuery({
    queryKey: ["orders", orderId],
    queryFn: () => api.orders.get(orderId),
    enabled: !!orderId,
  });
}

export function useGeneratePackingSlip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => api.orders.generatePackingSlip(orderId),
    onSuccess: () => {
      toast({ title: "Packing Slip Generated" });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (err: ApiError) => {
      toast({ title: "Failed to generate packing slip", description: err.message, variant: "destructive" });
    },
  });
}

export function useUploadLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, file }: { orderId: string; file: File }) =>
      api.orders.uploadLabel(orderId, file),
    onSuccess: () => {
      toast({ title: "Label Uploaded" });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (err: ApiError) => {
      toast({ title: "Failed to upload label", description: err.message, variant: "destructive" });
    },
  });
}

export function useHoldOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
      api.orders.hold(orderId, reason),
    onSuccess: () => {
      toast({ title: "Order put on hold" });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: ApiError) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });
}

export function useReleaseHold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => api.orders.releaseHold(orderId),
    onSuccess: () => {
      toast({ title: "Hold Released" });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: ApiError) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });
}

// ── Batches ──

export function useBatches(params?: Record<string, string>) {
  return useQuery({
    queryKey: ["batches", params],
    queryFn: () => api.batches.list(params),
    staleTime: 10_000,
  });
}

export function useBatch(batchId: string) {
  return useQuery({
    queryKey: ["batches", batchId],
    queryFn: () => api.batches.get(batchId),
    enabled: !!batchId,
  });
}

export function useCreateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBatchPayload) => api.batches.create(data),
    onSuccess: () => {
      toast({ title: "Batch Created" });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: ApiError) => {
      toast({ title: "Failed to create batch", description: err.message, variant: "destructive" });
    },
  });
}

export function useGeneratePickList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (batchId: string) => api.batches.generatePickList(batchId),
    onSuccess: () => {
      toast({ title: "Pick List Generated" });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (err: ApiError) => {
      toast({ title: "Failed to generate pick list", description: err.message, variant: "destructive" });
    },
  });
}

export function useGenerateManifest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (batchId: string) => api.batches.generateManifest(batchId),
    onSuccess: () => {
      toast({ title: "Manifest Generated" });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (err: ApiError) => {
      toast({ title: "Failed to generate manifest", description: err.message, variant: "destructive" });
    },
  });
}

// ── Exceptions ──

export function useExceptions(params?: Record<string, string>) {
  return useQuery({
    queryKey: ["exceptions", params],
    queryFn: () => api.exceptions.list(params),
    staleTime: 10_000,
  });
}

export function useResolveException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      api.exceptions.resolve(id, { note }),
    onSuccess: () => {
      toast({ title: "Exception Resolved" });
      qc.invalidateQueries({ queryKey: ["exceptions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: ApiError) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });
}

// ── Documents ──

export function useDocuments(params?: Record<string, string>) {
  return useQuery({
    queryKey: ["documents", params],
    queryFn: () => api.documents.list(params),
    staleTime: 10_000,
  });
}

// ── Serials ──

export function useCaptureSerial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CaptureSerialPayload) => api.serials.capture(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err: ApiError) => {
      toast({ title: "Scan Error", description: err.message, variant: "destructive" });
    },
  });
}

// ── Audit Logs ──

export function useAuditLogs(params?: Record<string, string>) {
  return useQuery({
    queryKey: ["audit-logs", params],
    queryFn: () => api.auditLogs.list(params),
    staleTime: 10_000,
  });
}

// ── Settings ──

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: api.settings.list,
  });
}

export function useUpdateSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      api.settings.update(key, value),
    onSuccess: () => {
      toast({ title: "Setting Updated" });
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (err: ApiError) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });
}

// ── Users ──

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: api.users.list,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.users.create,
    onSuccess: () => {
      toast({ title: "User Created" });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: ApiError) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });
}

// ── Integrations ──

export function useChannelAccounts(channel: string) {
  return useQuery({
    queryKey: ["integrations", channel, "accounts"],
    queryFn: () => api.integrations.accounts(channel),
    enabled: !!channel,
  });
}

export function useStartIntegration() {
  return useMutation({
    mutationFn: (channel: string) => api.integrations.start(channel),
    onSuccess: (data) => {
      // Redirect user to the marketplace OAuth page
      window.location.href = data.authUrl;
    },
    onError: (err: ApiError) => {
      toast({ title: "Connect Failed", description: err.message, variant: "destructive" });
    },
  });
}

export function useTestConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ channel, accountId }: { channel: string; accountId: string }) =>
      api.integrations.test(channel, accountId),
    onSuccess: (data, variables) => {
      toast({
        title: data.ok ? "Connection OK" : "Connection Failed",
        description: data.message,
        variant: data.ok ? "default" : "destructive",
      });
      qc.invalidateQueries({ queryKey: ["integrations", variables.channel, "accounts"] });
    },
    onError: (err: ApiError) => {
      toast({ title: "Test Failed", description: err.message, variant: "destructive" });
    },
  });
}

export function useDisconnectAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => api.integrations.disconnect(accountId),
    onSuccess: () => {
      toast({ title: "Account Disconnected" });
      qc.invalidateQueries({ queryKey: ["integrations"] });
    },
    onError: (err: ApiError) => {
      toast({ title: "Disconnect Failed", description: err.message, variant: "destructive" });
    },
  });
}

export function useTemuManualConnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TemuManualConnectPayload) => api.integrations.temuManual(data),
    onSuccess: () => {
      toast({ title: "Temu Account Connected" });
      qc.invalidateQueries({ queryKey: ["integrations", "temu", "accounts"] });
    },
    onError: (err: ApiError) => {
      toast({ title: "Connect Failed", description: err.message, variant: "destructive" });
    },
  });
}

export function useChannelCredentials(channel: string) {
  return useQuery({
    queryKey: ["integrations", channel, "credentials"],
    queryFn: () => api.integrations.credentials(channel),
    enabled: !!channel,
  });
}

export function useSaveCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ channel, data }: { channel: string; data: Record<string, string> }) =>
      api.integrations.saveCredentials(channel, data),
    onSuccess: (result, variables) => {
      toast({ title: "Credentials Saved", description: result.message });
      qc.invalidateQueries({ queryKey: ["integrations", variables.channel, "credentials"] });
    },
    onError: (err: ApiError) => {
      toast({ title: "Save Failed", description: err.message, variant: "destructive" });
    },
  });
}

// ── Marketplace (Label Purchase + Tracking Upload) ──

export function usePurchaseLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, data }: { orderId: string; data: PurchaseLabelPayload }) =>
      api.marketplace.purchaseLabel(orderId, data),
    onSuccess: (data) => {
      toast({
        title: "Label Purchased",
        description: `Tracking: ${data.trackingNumber} via ${data.carrierCode}${data.cost ? ` ($${data.cost.toFixed(2)})` : ""}`,
      });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: ApiError) => {
      toast({ title: "Label Purchase Failed", description: err.message, variant: "destructive" });
    },
  });
}

export function useUploadTracking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, data }: { orderId: string; data?: UploadTrackingPayload }) =>
      api.marketplace.uploadTracking(orderId, data),
    onSuccess: (data) => {
      toast({
        title: "Tracking Uploaded",
        description: data.message,
      });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: ApiError) => {
      toast({ title: "Tracking Upload Failed", description: err.message, variant: "destructive" });
    },
  });
}

export function useBulkUploadTracking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderIds: string[]) => api.marketplace.bulkUploadTracking(orderIds),
    onSuccess: (data) => {
      toast({ title: "Bulk Tracking Upload", description: data.message });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: ApiError) => {
      toast({ title: "Bulk Tracking Failed", description: err.message, variant: "destructive" });
    },
  });
}

export function useSyncAccountOrders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => api.sync.account(accountId),
    onSuccess: (data) => {
      toast({ title: "Account Sync", description: data.message });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["integrations"] });
    },
    onError: (err: ApiError) => {
      toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
    },
  });
}
