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

// ─── Temu endpoints (configurable via env) ──────────────────────────────────
// Temu's API varies by region; endpoints are configurable.
const TEMU_AUTH_URL = process.env.TEMU_AUTH_URL || "https://openapi.temuplatform.com/oauth/authorize";
const TEMU_TOKEN_URL = process.env.TEMU_TOKEN_URL || "https://openapi.temuplatform.com/oauth/token";
const TEMU_API_BASE = process.env.TEMU_API_BASE_URL || "https://openapi.temuplatform.com";

function getConfig() {
  const appKey = process.env.TEMU_APP_KEY;
  const appSecret = process.env.TEMU_APP_SECRET;
  const redirectUri = process.env.TEMU_REDIRECT_URI;

  if (!appKey || !appSecret) {
    throw new Error("Missing Temu environment variables (TEMU_APP_KEY, TEMU_APP_SECRET)");
  }

  return { appKey, appSecret, redirectUri: redirectUri || "" };
}

export const temuProvider: ChannelProvider = {
  getAuthUrl(state: string): string {
    const { appKey, redirectUri } = getConfig();
    const params = new URLSearchParams({
      app_key: appKey,
      redirect_uri: redirectUri,
      response_type: "code",
      state,
    });
    return `${TEMU_AUTH_URL}?${params.toString()}`;
  },

  async exchangeCode(code: string): Promise<TokenResult> {
    const { appKey, appSecret } = getConfig();

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      app_key: appKey,
      app_secret: appSecret,
    });

    const res = await fetch(TEMU_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Temu token exchange failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as Record<string, any>;
    const result = data.result || data;
    return {
      accessToken: result.access_token,
      refreshToken: result.refresh_token || "",
      expiresIn: result.expires_in || 3600,
    };
  },

  async fetchSellerIdentity(accessToken: string): Promise<SellerIdentity> {
    try {
      const res = await fetch(`${TEMU_API_BASE}/api/seller/info`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (res.ok) {
        const data = (await res.json()) as Record<string, any>;
        const info = data.result || data;
        return {
          externalSellerId: info.seller_id || info.shop_id || "temu-seller",
          accountName: info.shop_name || info.seller_name || "Temu Seller",
        };
      }

      return {
        externalSellerId: "temu-seller",
        accountName: "Temu Seller",
      };
    } catch {
      return {
        externalSellerId: "temu-seller",
        accountName: "Temu Seller",
      };
    }
  },

  async refreshAccessToken(refreshToken: string): Promise<RefreshResult> {
    const { appKey, appSecret } = getConfig();

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      app_key: appKey,
      app_secret: appSecret,
    });

    const res = await fetch(TEMU_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Temu token refresh failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as Record<string, any>;
    const result = data.result || data;
    return {
      accessToken: result.access_token,
      expiresIn: result.expires_in || 3600,
    };
  },

  async testConnection(accessToken: string): Promise<TestResult> {
    try {
      const res = await fetch(`${TEMU_API_BASE}/api/seller/info`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (res.ok) {
        return { ok: true, message: "Temu connection verified" };
      }

      return { ok: false, message: `Temu API returned ${res.status}` };
    } catch (err) {
      return { ok: false, message: `Temu connection test failed: ${(err as Error).message}` };
    }
  },

  // ─── Order Sync ──────────────────────────────────────────────────────────

  async fetchOrders(accessToken: string, params: FetchOrdersParams): Promise<FetchOrdersResult> {
    const body: Record<string, any> = {};

    if (params.createdAfter) {
      body.create_time_start = new Date(params.createdAfter).getTime();
    }
    if (params.updatedAfter) {
      body.update_time_start = new Date(params.updatedAfter).getTime();
    }
    if (params.pageSize) {
      body.page_size = params.pageSize;
    }
    if (params.nextToken) {
      body.page = parseInt(params.nextToken, 10);
    } else {
      body.page = 1;
    }

    const res = await fetch(`${TEMU_API_BASE}/api/order/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Temu fetchOrders failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as Record<string, any>;
    const result = data.result || data;
    const temuOrders: any[] = result.order_list || result.orders || [];

    const orders: NormalizedOrder[] = [];

    for (const o of temuOrders) {
      // Fetch order detail for full shipping info
      let detail = o;
      try {
        const detailRes = await fetch(`${TEMU_API_BASE}/api/order/detail`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ order_sn: o.order_sn || o.order_id }),
        });
        if (detailRes.ok) {
          const detailData = (await detailRes.json()) as Record<string, any>;
          detail = detailData.result || detailData || o;
        }
      } catch {
        // Use summary data if detail fetch fails
      }

      const shipping = detail.shipping_address || detail.address || {};

      orders.push({
        externalOrderId: String(detail.order_sn || detail.order_id),
        buyerName: shipping.buyer_name || shipping.name || "Temu Buyer",
        shipToName: shipping.receiver_name || shipping.name || "Temu Buyer",
        shipToAddress1: shipping.address_line1 || shipping.street || "",
        shipToAddress2: shipping.address_line2 || undefined,
        shipToCity: shipping.city || "",
        shipToState: shipping.state || shipping.province || "",
        shipToZip: shipping.zip_code || shipping.postal_code || "",
        shipToCountry: shipping.country_code || shipping.country || "US",
        orderDate: new Date(detail.create_time || detail.order_time || Date.now()),
        items: (detail.order_items || detail.items || []).map((item: any) => ({
          sku: item.sku || item.product_sku || item.goods_id || "UNKNOWN",
          title: item.product_name || item.goods_name || "Unknown Item",
          quantity: item.quantity || item.goods_count || 1,
          unitPrice: parseFloat(item.price || item.goods_price || "0"),
        })),
      });
    }

    const totalPages = result.total_pages || result.page_count || 1;
    const currentPage = body.page;
    const hasMore = currentPage < totalPages;

    return {
      orders,
      nextToken: hasMore ? String(currentPage + 1) : undefined,
      hasMore,
    };
  },

  // ─── Label Purchase ──────────────────────────────────────────────────────

  async purchaseLabel(accessToken: string, params: PurchaseLabelParams): Promise<PurchaseLabelResult> {
    const body = {
      order_sn: params.externalOrderId,
      ship_from: {
        name: params.shipFromAddress.name,
        address_line1: params.shipFromAddress.address1,
        address_line2: params.shipFromAddress.address2 || "",
        city: params.shipFromAddress.city,
        state: params.shipFromAddress.state,
        zip_code: params.shipFromAddress.zip,
        country_code: params.shipFromAddress.country,
      },
      package_info: {
        weight: params.packageDetails.weightOz,
        weight_unit: "oz",
        length: params.packageDetails.lengthIn || 1,
        width: params.packageDetails.widthIn || 1,
        height: params.packageDetails.heightIn || 1,
        dimension_unit: "in",
      },
      carrier_code: params.carrierCode,
      service_code: params.serviceCode,
    };

    const res = await fetch(`${TEMU_API_BASE}/api/shipping/label/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Temu label purchase failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as Record<string, any>;
    const result = data.result || data;

    // Download label if URL is provided
    let labelBuffer: Buffer | undefined;
    if (result.label_url) {
      try {
        const dlRes = await fetch(result.label_url);
        if (dlRes.ok) {
          labelBuffer = Buffer.from(await dlRes.arrayBuffer());
        }
      } catch {
        // Label download optional
      }
    }

    return {
      trackingNumber: result.tracking_number || result.tracking_no || "",
      carrierCode: result.carrier_code || params.carrierCode || "",
      labelData: labelBuffer,
      labelUrl: result.label_url,
      cost: parseFloat(result.shipping_fee || result.cost || "0"),
    };
  },

  // ─── Tracking Upload ─────────────────────────────────────────────────────

  async uploadTracking(accessToken: string, params: UploadTrackingParams): Promise<UploadTrackingResult> {
    const body = {
      order_sn: params.externalOrderId,
      tracking_number: params.trackingNumber,
      carrier_code: params.carrierCode,
      ship_date: params.shipDate || new Date().toISOString().slice(0, 10),
    };

    const res = await fetch(`${TEMU_API_BASE}/api/order/shipping`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Temu tracking upload failed (${res.status}): ${err}`);
    }

    return {
      ok: true,
      message: `Tracking ${params.trackingNumber} uploaded to Temu order ${params.externalOrderId}`,
    };
  },
};
