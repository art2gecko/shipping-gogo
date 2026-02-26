// ── Enums matching Prisma schema ──

export type ChannelType = "AMAZON" | "EBAY" | "WALMART" | "TEMU" | "OTHER";
export type OrderStatus = "NEW" | "READY" | "HOLD" | "SHIPPED" | "CANCELED";
export type ShipmentStatus = "PENDING" | "LABEL_PURCHASED" | "PACKED" | "SHIPPED" | "ERROR";
export type LabelSource = "AMAZON_BUY_SHIPPING" | "WALMART_SWW" | "EBAY_LABELS" | "TEMU_LABELS" | "CARRIER_API" | "MANUAL";
export type DocumentType = "PICK_LIST" | "PACKING_SLIP" | "LABEL" | "MANIFEST" | "EXPORT";
export type ExceptionType = "ADDRESS_INVALID" | "SERIAL_MISSING" | "SERIAL_INVALID" | "LABEL_PURCHASE_FAILED" | "TRACKING_UPLOAD_FAILED" | "API_AUTH_FAILED" | "UNKNOWN";
export type UserRole = "ADMIN" | "WAREHOUSE";
export type AuditAction = "ORDER_IMPORTED" | "ORDER_UPDATED" | "BATCH_CREATED" | "LABEL_PURCHASED" | "LABEL_REPRINTED" | "SERIAL_SCANNED" | "DOCUMENT_CREATED" | "TRACKING_UPLOADED" | "EXCEPTION_CREATED" | "EXCEPTION_RESOLVED" | "SETTINGS_UPDATED";

// ── Models ──

export interface User {
  id: string;
  username: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  channel: ChannelType;
  externalOrderId: string;
  status: OrderStatus;
  buyerName: string;
  shipToName: string;
  shipToAddress1: string;
  shipToAddress2: string | null;
  shipToCity: string;
  shipToState: string;
  shipToZip: string;
  shipToCountry: string;
  holdReason: string | null;
  notes: string | null;
  orderDate: string;
  importedAt: string;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
  shipment?: Shipment | null;
  documents?: Document[];
  exceptions?: Exception[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  sku: string;
  title: string;
  quantity: number;
  unitPrice: number | null;
  serialRequired: boolean;
  binLocation: string | null;
  createdAt: string;
  updatedAt: string;
  serialCaptures?: SerialCapture[];
}

export interface Shipment {
  id: string;
  orderId: string;
  status: ShipmentStatus;
  carrierCode: string | null;
  serviceCode: string | null;
  trackingNumber: string | null;
  shipDate: string | null;
  weightOz: number | null;
  lengthIn: number | null;
  widthIn: number | null;
  heightIn: number | null;
  createdAt: string;
  updatedAt: string;
  labels?: Label[];
}

export interface Label {
  id: string;
  shipmentId: string;
  source: LabelSource;
  trackingNumber: string | null;
  carrierCode: string | null;
  cost: number | null;
  filePath: string | null;
  idempotencyKey: string;
  purchasedAt: string;
  createdAt: string;
}

export interface SerialCapture {
  id: string;
  orderItemId: string;
  serialCode: string;
  scannedAt: string;
  scannedBy: string | null;
}

export interface Batch {
  id: string;
  name: string;
  strategy: string | null;
  createdAt: string;
  updatedAt: string;
  orders?: BatchOrderWithOrder[];
  documents?: Document[];
  _count?: { orders: number };
}

export interface BatchOrder {
  id: string;
  batchId: string;
  orderId: string;
  position: number;
}

export interface BatchOrderWithOrder extends BatchOrder {
  order: Order;
}

export interface Document {
  id: string;
  type: DocumentType;
  filePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  orderId: string | null;
  batchId: string | null;
  createdAt: string;
}

export interface Exception {
  id: string;
  type: ExceptionType;
  message: string;
  resolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  orderId: string | null;
  context: Record<string, unknown> | null;
  createdAt: string;
  order?: Order;
}

export interface AuditLog {
  id: string;
  action: AuditAction;
  detail: string | null;
  metadata: Record<string, unknown> | null;
  userId: string | null;
  orderId: string | null;
  batchId: string | null;
  createdAt: string;
}

export interface Setting {
  key: string;
  value: string;
  updatedAt: string;
}

// ── API Payloads ──

export interface LoginPayload {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface DashboardStats {
  unshipped: number;
  ready: number;
  onHold: number;
  exceptions: number;
  labelsPurchasedToday: number;
  batchesToday: number;
}

export interface CreateBatchPayload {
  orderIds: string[];
  strategy?: string;
}

export interface ResolveExceptionPayload {
  note?: string;
}

export interface CaptureSerialPayload {
  orderItemId: string;
  serialCode: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
