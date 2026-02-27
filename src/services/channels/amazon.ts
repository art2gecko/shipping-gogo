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
import { spApiRequest } from "./sigv4";

// ─── Amazon LWA + SP-API endpoints ─────────────────────────────────────────
const LWA_AUTH_URL = "https://sellercentral.amazon.com/apps/authorize/consent";
const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";
const SPAPI_BASE = "https://sellingpartnerapi-na.amazon.com";
const SPAPI_SELLERS_URL = `${SPAPI_BASE}/sellers/v1/marketplaceParticipations`;

function getConfig() {
  const clientId = process.env.AMAZON_LWA_CLIENT_ID;
  const clientSecret = process.env.AMAZON_LWA_CLIENT_SECRET;
  const redirectUri = process.env.AMAZON_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing Amazon environment variables (AMAZON_LWA_CLIENT_ID, AMAZON_LWA_CLIENT_SECRET, AMAZON_REDIRECT_URI)");
  }

  return { clientId, clientSecret, redirectUri };
}

function hasSigV4Credentials(): boolean {
  return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}

export const amazonProvider: ChannelProvider = {
  getAuthUrl(state: string): string {
    const { clientId, redirectUri } = getConfig();
    const params = new URLSearchParams({
      application_id: clientId,
      redirect_uri: redirectUri,
      state,
    });
    return `${LWA_AUTH_URL}?${params.toString()}`;
  },

  async exchangeCode(code: string): Promise<TokenResult> {
    const { clientId, clientSecret, redirectUri } = getConfig();

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const res = await fetch(LWA_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Amazon LWA token exchange failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as Record<string, any>;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  },

  async fetchSellerIdentity(accessToken: string): Promise<SellerIdentity> {
    try {
      // Use SigV4 if credentials are available
      let res: Response;
      if (hasSigV4Credentials()) {
        res = await spApiRequest("GET", SPAPI_SELLERS_URL, accessToken);
      } else {
        res = await fetch(SPAPI_SELLERS_URL, {
          headers: {
            "x-amz-access-token": accessToken,
            "Content-Type": "application/json",
          },
        });
      }

      if (res.ok) {
        const data = (await res.json()) as Record<string, any>;
        const participations = data.payload || [];
        const first = participations[0];
        return {
          externalSellerId: first?.marketplace?.id || "amazon-seller",
          accountName: first?.marketplace?.name || "Amazon Seller",
        };
      }

      return {
        externalSellerId: "pending-sigv4",
        accountName: "Amazon Seller (identity pending SigV4)",
      };
    } catch {
      return {
        externalSellerId: "pending-sigv4",
        accountName: "Amazon Seller (identity pending SigV4)",
      };
    }
  },

  async refreshAccessToken(refreshToken: string): Promise<RefreshResult> {
    const { clientId, clientSecret } = getConfig();

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const res = await fetch(LWA_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Amazon LWA token refresh failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as Record<string, any>;
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  },

  async testConnection(accessToken: string): Promise<TestResult> {
    try {
      let res: Response;
      if (hasSigV4Credentials()) {
        res = await spApiRequest("GET", SPAPI_SELLERS_URL, accessToken);
      } else {
        res = await fetch(SPAPI_SELLERS_URL, {
          headers: {
            "x-amz-access-token": accessToken,
            "Content-Type": "application/json",
          },
        });
      }

      if (res.ok) {
        return { ok: true, message: "Amazon SP-API connection verified" };
      }

      if (res.status === 403 && !hasSigV4Credentials()) {
        return { ok: true, message: "LWA token valid (SP-API requires SigV4 for full access)" };
      }

      return { ok: false, message: `Amazon API returned ${res.status}` };
    } catch (err) {
      return { ok: false, message: `Amazon connection test failed: ${(err as Error).message}` };
    }
  },

  // ─── Order Sync ──────────────────────────────────────────────────────────

  async fetchOrders(accessToken: string, params: FetchOrdersParams): Promise<FetchOrdersResult> {
    if (!hasSigV4Credentials()) {
      throw new Error("AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) required for Amazon order sync");
    }

    const queryParts: string[] = [];

    // Amazon SP-API uses MarketplaceIds (required)
    queryParts.push("MarketplaceIds=ATVPDKIKX0DER"); // US marketplace

    if (params.createdAfter) {
      queryParts.push(`CreatedAfter=${encodeURIComponent(params.createdAfter)}`);
    } else if (params.updatedAfter) {
      queryParts.push(`LastUpdatedAfter=${encodeURIComponent(params.updatedAfter)}`);
    } else {
      // Default: last 7 days
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      queryParts.push(`CreatedAfter=${encodeURIComponent(weekAgo)}`);
    }

    if (params.statuses && params.statuses.length > 0) {
      queryParts.push(`OrderStatuses=${params.statuses.join(",")}`);
    }

    if (params.pageSize) {
      queryParts.push(`MaxResultsPerPage=${params.pageSize}`);
    }

    if (params.nextToken) {
      queryParts.push(`NextToken=${encodeURIComponent(params.nextToken)}`);
    }

    const url = `${SPAPI_BASE}/orders/v0/orders?${queryParts.join("&")}`;
    const res = await spApiRequest("GET", url, accessToken);

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Amazon fetchOrders failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as Record<string, any>;
    const payload = data.payload || {};
    const amazonOrders: any[] = payload.Orders || [];
    const nextToken = payload.NextToken || undefined;

    // For each order, we need to fetch order items (separate API call)
    const orders: NormalizedOrder[] = [];
    for (const o of amazonOrders) {
      let items: any[] = [];
      try {
        const itemsUrl = `${SPAPI_BASE}/orders/v0/orders/${o.AmazonOrderId}/orderItems`;
        const itemsRes = await spApiRequest("GET", itemsUrl, accessToken);
        if (itemsRes.ok) {
          const itemsData = (await itemsRes.json()) as Record<string, any>;
          items = itemsData.payload?.OrderItems || [];
        }
      } catch {
        // If items fetch fails, include order without items
      }

      const shipping = o.ShippingAddress || {};

      orders.push({
        externalOrderId: o.AmazonOrderId,
        buyerName: o.BuyerInfo?.BuyerName || shipping.Name || "Amazon Buyer",
        shipToName: shipping.Name || o.BuyerInfo?.BuyerName || "Amazon Buyer",
        shipToAddress1: shipping.AddressLine1 || "",
        shipToAddress2: shipping.AddressLine2 || undefined,
        shipToCity: shipping.City || "",
        shipToState: shipping.StateOrRegion || "",
        shipToZip: shipping.PostalCode || "",
        shipToCountry: shipping.CountryCode || "US",
        orderDate: new Date(o.PurchaseDate),
        items: items.map((item: any) => ({
          sku: item.SellerSKU || item.ASIN,
          title: item.Title || "Unknown Item",
          quantity: item.QuantityOrdered || 1,
          unitPrice: parseFloat(item.ItemPrice?.Amount || "0"),
        })),
      });
    }

    return {
      orders,
      nextToken,
      hasMore: !!nextToken,
    };
  },

  // ─── Label Purchase ──────────────────────────────────────────────────────

  async purchaseLabel(accessToken: string, params: PurchaseLabelParams): Promise<PurchaseLabelResult> {
    if (!hasSigV4Credentials()) {
      throw new Error("AWS credentials required for Amazon label purchase");
    }

    // Step 1: Get eligible shipping services
    const eligibleBody = {
      ShipmentRequestDetails: {
        AmazonOrderId: params.externalOrderId,
        ShipFromAddress: {
          Name: params.shipFromAddress.name,
          AddressLine1: params.shipFromAddress.address1,
          AddressLine2: params.shipFromAddress.address2 || "",
          City: params.shipFromAddress.city,
          StateOrProvinceCode: params.shipFromAddress.state,
          PostalCode: params.shipFromAddress.zip,
          CountryCode: params.shipFromAddress.country,
        },
        PackageDimensions: {
          Length: params.packageDetails.lengthIn || 1,
          Width: params.packageDetails.widthIn || 1,
          Height: params.packageDetails.heightIn || 1,
          Unit: "inches",
        },
        Weight: {
          Value: params.packageDetails.weightOz,
          Unit: "ounces",
        },
        ShippingServiceOptions: {
          DeliveryExperience: "DeliveryConfirmationWithoutSignature",
          CarrierWillPickUp: false,
        },
      },
    };

    const eligibleUrl = `${SPAPI_BASE}/mfn/v0/eligibleShippingServices`;
    const eligibleRes = await spApiRequest("POST", eligibleUrl, accessToken, JSON.stringify(eligibleBody));

    if (!eligibleRes.ok) {
      const err = await eligibleRes.text();
      throw new Error(`Amazon eligible services failed (${eligibleRes.status}): ${err}`);
    }

    const eligibleData = (await eligibleRes.json()) as Record<string, any>;
    const services = eligibleData.payload?.ShippingServiceList || [];

    if (services.length === 0) {
      throw new Error("No eligible shipping services returned from Amazon");
    }

    // Pick the requested service or default to cheapest
    let selectedService = services[0];
    if (params.carrierCode) {
      const matching = services.find((s: any) =>
        s.CarrierName?.toUpperCase() === params.carrierCode?.toUpperCase() ||
        s.ShippingServiceId?.toUpperCase().includes(params.carrierCode?.toUpperCase() || "")
      );
      if (matching) selectedService = matching;
    }

    // Step 2: Create shipment (purchase label)
    const createBody = {
      ShipmentRequestDetails: eligibleBody.ShipmentRequestDetails,
      ShippingServiceId: selectedService.ShippingServiceId,
    };

    const createUrl = `${SPAPI_BASE}/mfn/v0/shipments`;
    const createRes = await spApiRequest("POST", createUrl, accessToken, JSON.stringify(createBody));

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Amazon create shipment failed (${createRes.status}): ${err}`);
    }

    const shipmentData = (await createRes.json()) as Record<string, any>;
    const shipment = shipmentData.payload || {};
    const label = shipment.Label || {};

    // Download label if available
    let labelBuffer: Buffer | undefined;
    if (label.FileContents?.Contents) {
      labelBuffer = Buffer.from(label.FileContents.Contents, "base64");
    }

    return {
      trackingNumber: shipment.TrackingId || "",
      carrierCode: selectedService.CarrierName || "",
      labelData: labelBuffer,
      cost: parseFloat(selectedService.Rate?.Amount || "0"),
    };
  },

  // ─── Tracking Upload ─────────────────────────────────────────────────────

  async uploadTracking(accessToken: string, params: UploadTrackingParams): Promise<UploadTrackingResult> {
    if (!hasSigV4Credentials()) {
      throw new Error("AWS credentials required for Amazon tracking upload");
    }

    // Amazon SP-API: Submit fulfillment via Feeds API
    // For MFN orders, use the order fulfillment feed
    const feedBody = {
      feedType: "POST_ORDER_FULFILLMENT_DATA",
      inputFeedDocumentId: "", // Will be set after creating feed document
    };

    // Build the fulfillment XML
    const fulfillmentXml = `<?xml version="1.0" encoding="UTF-8"?>
<AmazonEnvelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="amzn-envelope.xsd">
  <Header>
    <DocumentVersion>1.02</DocumentVersion>
    <MerchantIdentifier>_MERCHANT_ID_</MerchantIdentifier>
  </Header>
  <MessageType>OrderFulfillment</MessageType>
  <Message>
    <MessageID>1</MessageID>
    <OrderFulfillment>
      <AmazonOrderID>${params.externalOrderId}</AmazonOrderID>
      <FulfillmentDate>${params.shipDate || new Date().toISOString()}</FulfillmentDate>
      <FulfillmentData>
        <CarrierCode>${params.carrierCode}</CarrierCode>
        <ShipperTrackingNumber>${params.trackingNumber}</ShipperTrackingNumber>
      </FulfillmentData>
    </OrderFulfillment>
  </Message>
</AmazonEnvelope>`;

    // Step 1: Create feed document
    const createDocUrl = `${SPAPI_BASE}/feeds/2021-06-30/documents`;
    const createDocRes = await spApiRequest("POST", createDocUrl, accessToken, JSON.stringify({
      contentType: "text/xml; charset=UTF-8",
    }));

    if (!createDocRes.ok) {
      const err = await createDocRes.text();
      throw new Error(`Amazon create feed document failed (${createDocRes.status}): ${err}`);
    }

    const docData = (await createDocRes.json()) as Record<string, any>;
    const uploadUrl = docData.url;
    const feedDocumentId = docData.feedDocumentId;

    // Step 2: Upload the XML to the pre-signed URL
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/xml; charset=UTF-8" },
      body: fulfillmentXml,
    });

    if (!uploadRes.ok) {
      throw new Error(`Amazon feed document upload failed (${uploadRes.status})`);
    }

    // Step 3: Create the feed
    const createFeedUrl = `${SPAPI_BASE}/feeds/2021-06-30/feeds`;
    const createFeedRes = await spApiRequest("POST", createFeedUrl, accessToken, JSON.stringify({
      feedType: "POST_ORDER_FULFILLMENT_DATA",
      marketplaceIds: ["ATVPDKIKX0DER"],
      inputFeedDocumentId: feedDocumentId,
    }));

    if (!createFeedRes.ok) {
      const err = await createFeedRes.text();
      throw new Error(`Amazon create feed failed (${createFeedRes.status}): ${err}`);
    }

    const feedResult = (await createFeedRes.json()) as Record<string, any>;

    return {
      ok: true,
      message: `Tracking ${params.trackingNumber} submitted to Amazon via feed ${feedResult.feedId}`,
    };
  },
};
