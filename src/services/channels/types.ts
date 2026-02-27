/**
 * Shared interface that each channel provider implements.
 */
export interface ChannelProvider {
  /** Build the OAuth authorize URL; returns the URL to redirect the user to. */
  getAuthUrl(state: string): string;

  /** Exchange the authorization code from callback for tokens. */
  exchangeCode(code: string): Promise<TokenResult>;

  /** Fetch the seller identity from the marketplace. */
  fetchSellerIdentity(accessToken: string): Promise<SellerIdentity>;

  /** Refresh an access token using a refresh token. */
  refreshAccessToken(refreshToken: string): Promise<RefreshResult>;

  /** Test the connection by calling a lightweight endpoint. */
  testConnection(accessToken: string): Promise<TestResult>;

  /** Fetch orders from the marketplace. Returns normalized order data. */
  fetchOrders(accessToken: string, params: FetchOrdersParams): Promise<FetchOrdersResult>;

  /** Purchase a shipping label through the marketplace's label service. */
  purchaseLabel(accessToken: string, params: PurchaseLabelParams): Promise<PurchaseLabelResult>;

  /** Upload tracking information back to the marketplace to confirm fulfillment. */
  uploadTracking(accessToken: string, params: UploadTrackingParams): Promise<UploadTrackingResult>;
}

export interface TokenResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
  scopes?: string;
}

export interface RefreshResult {
  accessToken: string;
  expiresIn: number;
}

export interface SellerIdentity {
  externalSellerId: string;
  accountName?: string;
}

export interface TestResult {
  ok: boolean;
  message: string;
}

// ─── Order Sync Types ────────────────────────────────────────────────────────

export interface FetchOrdersParams {
  /** Only fetch orders created/updated after this date */
  createdAfter?: string;
  /** Only fetch orders updated after this date */
  updatedAfter?: string;
  /** Pagination cursor / next token */
  nextToken?: string;
  /** Max results per page */
  pageSize?: number;
  /** Order statuses to filter by (marketplace-specific) */
  statuses?: string[];
}

export interface NormalizedOrder {
  externalOrderId: string;
  buyerName: string;
  shipToName: string;
  shipToAddress1: string;
  shipToAddress2?: string;
  shipToCity: string;
  shipToState: string;
  shipToZip: string;
  shipToCountry: string;
  orderDate: Date;
  items: NormalizedOrderItem[];
}

export interface NormalizedOrderItem {
  sku: string;
  title: string;
  quantity: number;
  unitPrice: number;
}

export interface FetchOrdersResult {
  orders: NormalizedOrder[];
  nextToken?: string;
  hasMore: boolean;
}

// ─── Label Purchase Types ────────────────────────────────────────────────────

export interface PurchaseLabelParams {
  externalOrderId: string;
  shipFromAddress: ShipAddress;
  shipToAddress: ShipAddress;
  packageDetails: PackageDetails;
  carrierCode?: string;
  serviceCode?: string;
}

export interface ShipAddress {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface PackageDetails {
  weightOz: number;
  lengthIn?: number;
  widthIn?: number;
  heightIn?: number;
}

export interface PurchaseLabelResult {
  trackingNumber: string;
  carrierCode: string;
  labelData?: Buffer;
  labelUrl?: string;
  cost?: number;
}

// ─── Tracking Upload Types ───────────────────────────────────────────────────

export interface UploadTrackingParams {
  externalOrderId: string;
  trackingNumber: string;
  carrierCode: string;
  shipDate?: string;
}

export interface UploadTrackingResult {
  ok: boolean;
  message: string;
}
