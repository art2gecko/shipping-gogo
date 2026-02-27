import type {
  ChannelProvider,
  TokenResult,
  RefreshResult,
  SellerIdentity,
  TestResult,
  FetchOrdersParams,
  FetchOrdersResult,
  NormalizedOrder,
  PurchaseLabelParams,
  PurchaseLabelResult,
  UploadTrackingParams,
  UploadTrackingResult,
} from "./types";

// ─── eBay OAuth endpoints (Production) ──────────────────────────────────────
const EBAY_AUTH_URL = "https://auth.ebay.com/oauth2/authorize";
const EBAY_TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const EBAY_IDENTITY_URL = "https://apiz.ebay.com/commerce/identity/v1/user/";
const EBAY_FULFILLMENT_URL = "https://api.ebay.com/sell/fulfillment/v1";
const EBAY_LOGISTICS_URL = "https://api.ebay.com/sell/logistics/v1_beta";

// Default scopes needed for order sync + label purchasing
const DEFAULT_SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
].join(" ");

function getConfig() {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  const redirectUri = process.env.EBAY_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing eBay environment variables (EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, EBAY_REDIRECT_URI)");
  }

  return { clientId, clientSecret, redirectUri };
}

function basicAuth(): string {
  const { clientId, clientSecret } = getConfig();
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

export const ebayProvider: ChannelProvider = {
  getAuthUrl(state: string): string {
    const { clientId, redirectUri } = getConfig();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: DEFAULT_SCOPES,
      state,
    });
    return `${EBAY_AUTH_URL}?${params.toString()}`;
  },

  async exchangeCode(code: string): Promise<TokenResult> {
    const { redirectUri } = getConfig();

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    });

    const res = await fetch(EBAY_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth()}`,
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`eBay token exchange failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as Record<string, any>;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      scopes: DEFAULT_SCOPES,
    };
  },

  async fetchSellerIdentity(accessToken: string): Promise<SellerIdentity> {
    const res = await fetch(EBAY_IDENTITY_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`eBay identity fetch failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as Record<string, any>;
    return {
      externalSellerId: data.userId || data.username,
      accountName: data.username,
    };
  },

  async refreshAccessToken(refreshToken: string): Promise<RefreshResult> {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: DEFAULT_SCOPES,
    });

    const res = await fetch(EBAY_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth()}`,
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`eBay token refresh failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as Record<string, any>;
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  },

  async testConnection(accessToken: string): Promise<TestResult> {
    try {
      const res = await fetch(EBAY_IDENTITY_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        const data = (await res.json()) as Record<string, any>;
        return { ok: true, message: `Connected as ${data.username}` };
      }

      return { ok: false, message: `eBay API returned ${res.status}` };
    } catch (err) {
      return { ok: false, message: `eBay connection test failed: ${(err as Error).message}` };
    }
  },

  // ─── Order Sync ──────────────────────────────────────────────────────────

  async fetchOrders(accessToken: string, params: FetchOrdersParams): Promise<FetchOrdersResult> {
    const queryParts: string[] = [];

    // Build filter string for eBay's fulfillment API
    const filters: string[] = [];
    if (params.createdAfter) {
      filters.push(`creationdate:[${params.createdAfter}..${new Date().toISOString()}]`);
    }
    if (params.updatedAfter) {
      filters.push(`lastmodifieddate:[${params.updatedAfter}..${new Date().toISOString()}]`);
    }
    if (filters.length > 0) {
      queryParts.push(`filter=${encodeURIComponent(filters.join(","))}`);
    }

    if (params.pageSize) {
      queryParts.push(`limit=${params.pageSize}`);
    }
    if (params.nextToken) {
      queryParts.push(`offset=${params.nextToken}`);
    }

    const qs = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
    const url = `${EBAY_FULFILLMENT_URL}/order${qs}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`eBay fetchOrders failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as Record<string, any>;
    const ebayOrders: any[] = data.orders || [];

    const orders: NormalizedOrder[] = ebayOrders.map((o: any) => {
      const shipping = o.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo || {};
      const contact = shipping.contactAddress || shipping;
      const address = contact.addressLine1 ? contact : shipping;

      return {
        externalOrderId: o.orderId,
        buyerName: o.buyer?.username || shipping.fullName || "Unknown",
        shipToName: shipping.fullName || o.buyer?.username || "Unknown",
        shipToAddress1: address.addressLine1 || "",
        shipToAddress2: address.addressLine2 || undefined,
        shipToCity: address.city || "",
        shipToState: address.stateOrProvince || "",
        shipToZip: address.postalCode || "",
        shipToCountry: address.countryCode || "US",
        orderDate: new Date(o.creationDate || o.lastModifiedDate),
        items: (o.lineItems || []).map((li: any) => ({
          sku: li.sku || li.legacyItemId || li.lineItemId,
          title: li.title || "Unknown Item",
          quantity: li.quantity || 1,
          unitPrice: parseFloat(li.lineItemCost?.value || "0"),
        })),
      };
    });

    const total = data.total || 0;
    const offset = parseInt(params.nextToken || "0", 10);
    const limit = params.pageSize || 50;
    const hasMore = offset + limit < total;

    return {
      orders,
      nextToken: hasMore ? String(offset + limit) : undefined,
      hasMore,
    };
  },

  // ─── Label Purchase ──────────────────────────────────────────────────────

  async purchaseLabel(accessToken: string, params: PurchaseLabelParams): Promise<PurchaseLabelResult> {
    // Step 1: Create a shipping fulfillment to get available rates
    // eBay uses the logistics API for label creation
    const createShipmentBody = {
      orders: [{ orderId: params.externalOrderId }],
      shipFrom: {
        fullName: params.shipFromAddress.name,
        addressLine1: params.shipFromAddress.address1,
        addressLine2: params.shipFromAddress.address2 || undefined,
        city: params.shipFromAddress.city,
        stateOrProvince: params.shipFromAddress.state,
        postalCode: params.shipFromAddress.zip,
        countryCode: params.shipFromAddress.country,
      },
      packageSpecification: {
        weight: {
          value: params.packageDetails.weightOz,
          unit: "OUNCE",
        },
        dimensions: params.packageDetails.lengthIn ? {
          length: { value: params.packageDetails.lengthIn, unit: "INCH" },
          width: { value: params.packageDetails.widthIn || 1, unit: "INCH" },
          height: { value: params.packageDetails.heightIn || 1, unit: "INCH" },
        } : undefined,
      },
    };

    // Create shipment via logistics API
    const shipmentRes = await fetch(`${EBAY_LOGISTICS_URL}/shipping_quote`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createShipmentBody),
    });

    if (!shipmentRes.ok) {
      const err = await shipmentRes.text();
      throw new Error(`eBay create shipping quote failed (${shipmentRes.status}): ${err}`);
    }

    const quoteData = (await shipmentRes.json()) as Record<string, any>;
    const rates = quoteData.shippingQuotes || [];

    // Pick matching rate or first available
    let selectedRate = rates[0];
    if (params.carrierCode) {
      const matching = rates.find((r: any) =>
        r.shippingCarrierCode?.toUpperCase() === params.carrierCode?.toUpperCase()
      );
      if (matching) selectedRate = matching;
    }

    if (!selectedRate) {
      throw new Error("No shipping rates returned from eBay");
    }

    // Purchase the label using the selected rate
    const purchaseRes = await fetch(`${EBAY_LOGISTICS_URL}/shipping_quote/${quoteData.shippingQuoteId}/shipment`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rateId: selectedRate.rateId,
      }),
    });

    if (!purchaseRes.ok) {
      const err = await purchaseRes.text();
      throw new Error(`eBay label purchase failed (${purchaseRes.status}): ${err}`);
    }

    const labelData = (await purchaseRes.json()) as Record<string, any>;

    // Download label PDF if URL is provided
    let labelBuffer: Buffer | undefined;
    if (labelData.downloadLabelUrl) {
      const dlRes = await fetch(labelData.downloadLabelUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (dlRes.ok) {
        labelBuffer = Buffer.from(await dlRes.arrayBuffer());
      }
    }

    return {
      trackingNumber: labelData.trackingNumber || labelData.shipmentTrackingNumber || "",
      carrierCode: labelData.shippingCarrierCode || selectedRate.shippingCarrierCode || "",
      labelData: labelBuffer,
      labelUrl: labelData.downloadLabelUrl,
      cost: parseFloat(labelData.totalShippingCost?.value || selectedRate.rate?.value || "0"),
    };
  },

  // ─── Tracking Upload ─────────────────────────────────────────────────────

  async uploadTracking(accessToken: string, params: UploadTrackingParams): Promise<UploadTrackingResult> {
    // eBay: Create a shipping fulfillment on the order
    const body = {
      trackingNumber: params.trackingNumber,
      shippingCarrierCode: params.carrierCode,
      shippedDate: params.shipDate || new Date().toISOString(),
      lineItems: [], // Empty array means all line items in the order
    };

    // First, fetch order to get line item IDs
    const orderRes = await fetch(`${EBAY_FULFILLMENT_URL}/order/${params.externalOrderId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (orderRes.ok) {
      const orderData = (await orderRes.json()) as Record<string, any>;
      const lineItems = (orderData.lineItems || []).map((li: any) => ({
        lineItemId: li.lineItemId,
        quantity: li.quantity,
      }));
      body.lineItems = lineItems;
    }

    const res = await fetch(
      `${EBAY_FULFILLMENT_URL}/order/${params.externalOrderId}/shipping_fulfillment`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`eBay tracking upload failed (${res.status}): ${err}`);
    }

    return {
      ok: true,
      message: `Tracking ${params.trackingNumber} uploaded to eBay order ${params.externalOrderId}`,
    };
  },
};
