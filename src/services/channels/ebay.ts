import type {
  ChannelProvider,
  TokenResult,
  RefreshResult,
  SellerIdentity,
  TestResult,
} from "./types";

// ─── eBay OAuth endpoints (Production) ──────────────────────────────────────
const EBAY_AUTH_URL = "https://auth.ebay.com/oauth2/authorize";
const EBAY_TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const EBAY_IDENTITY_URL = "https://apiz.ebay.com/commerce/identity/v1/user/";

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
};
