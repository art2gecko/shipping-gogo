import type {
  ChannelProvider,
  TokenResult,
  RefreshResult,
  SellerIdentity,
  TestResult,
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
};
