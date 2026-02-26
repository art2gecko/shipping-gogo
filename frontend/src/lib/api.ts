import type {
  LoginPayload,
  LoginResponse,
  Order,
  Batch,
  Exception,
  Document as DocType,
  AuditLog,
  DashboardStats,
  CreateBatchPayload,
  ResolveExceptionPayload,
  CaptureSerialPayload,
  SerialCapture,
  Setting,
  User,
} from "@/types";

const BASE_URL = import.meta.env.VITE_API_URL || "";

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (
    !(options.body instanceof FormData) &&
    !(options.body instanceof Blob) &&
    !(options.body instanceof ArrayBuffer) &&
    !headers["Content-Type"]
  ) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    window.location.href = "/login";
    throw new ApiError(401, "Unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error || res.statusText);
  }

  if (res.headers.get("content-type")?.includes("application/json")) {
    return res.json();
  }

  return res as unknown as T;
}

// ── Auth ──

export const auth = {
  login: (data: LoginPayload) =>
    request<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  me: () => request<User>("/api/auth/me"),
};

// ── Dashboard ──

export const dashboard = {
  stats: () => request<DashboardStats>("/api/dashboard/stats"),
  dailyRun: () =>
    request<{ message: string }>("/api/jobs/daily-run", { method: "POST" }),
  syncOrders: () =>
    request<{ message: string }>("/api/jobs/sync-orders", { method: "POST" }),
};

// ── Orders ──

export const orders = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<Order[]>(`/api/orders${qs}`);
  },
  get: (id: string) => request<Order>(`/api/orders/${id}`),
  hold: (id: string, reason: string) =>
    request<Order>(`/api/orders/${id}/hold`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  releaseHold: (id: string) =>
    request<Order>(`/api/orders/${id}/release-hold`, { method: "POST" }),
  generatePackingSlip: (id: string) =>
    request<DocType>(`/api/documents/orders/${id}/packing-slip`, {
      method: "POST",
    }),
  uploadLabel: (id: string, file: File) =>
    request<DocType>(`/api/labels/orders/${id}/upload-manual`, {
      method: "POST",
      headers: { "Content-Type": file.type } as Record<string, string>,
      body: file,
    }),
};

// ── Batches ──

export const batches = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<Batch[]>(`/api/batches${qs}`);
  },
  get: (id: string) => request<Batch>(`/api/batches/${id}`),
  create: (data: CreateBatchPayload) =>
    request<Batch>("/api/batches", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  generatePickList: (id: string) =>
    request<DocType>(`/api/documents/batches/${id}/pick-list`, {
      method: "POST",
    }),
  generateManifest: (id: string) =>
    request<DocType>(`/api/documents/batches/${id}/manifest`, {
      method: "POST",
    }),
};

// ── Exceptions ──

export const exceptions = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<Exception[]>(`/api/exceptions${qs}`);
  },
  resolve: (id: string, data?: ResolveExceptionPayload) =>
    request<Exception>(`/api/exceptions/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify(data || {}),
    }),
};

// ── Documents ──

export const documents = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<DocType[]>(`/api/documents${qs}`);
  },
  downloadUrl: (id: string) => `${BASE_URL}/api/documents/${id}/download`,
};

// ── Serials ──

export const serials = {
  capture: (data: CaptureSerialPayload) =>
    request<SerialCapture>("/api/serials/capture", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ── Audit Logs ──

export const auditLogs = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<AuditLog[]>(`/api/audit-logs${qs}`);
  },
};

// ── Settings ──

export const settings = {
  list: () => request<Setting[]>("/api/settings"),
  update: (key: string, value: string) =>
    request<Setting>(`/api/settings/${key}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    }),
};

// ── Users ──

export const users = {
  list: () => request<User[]>("/api/users"),
  create: (data: { username: string; password: string; role: string }) =>
    request<User>("/api/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export { ApiError };

const api = {
  auth,
  dashboard,
  orders,
  batches,
  exceptions,
  documents,
  serials,
  auditLogs,
  settings,
  users,
};

export default api;
