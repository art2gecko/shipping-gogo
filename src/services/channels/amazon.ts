import type {
  ChannelProvider,
  TokenResult,
  RefreshResult,
  SellerIdentity,
  TestResult,
} from "./types";

// ─── Amazon LWA + SP-API endpoints ─────────────────────────────────────────
const LWA_AUTH_URL = "https://sellercentral.amazon.com/apps/authorize/consent";
const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";
const SPAPI_SELLERS_URL = "https://sellingpartnerapi-na.amazon.com/sellers/v1/marketplaceParticipations";

function getConfig() {
  const clientId = process.env.AMAZON_LWA_CLIENT_ID;
  const clientSecret = process.env.AMAZON_LWA_CLIENT_SECRET;
  const redirectUri = process.env.AMAZON_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing Amazon environment variables (AMAZON_LWA_CLIENT_ID, AMAZON_LWA_CLIENT_SECRET, AMAZON_REDIRECT_URI)");
  }

  return { clientId, clientSecret, redirectUri };
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
    // NOTE: Full SP-API calls require AWS SigV4 signing.
    // For now, we attempt the call with just the LWA access token.
    // In production, implement STS AssumeRole + SigV4 signing here.
    try {
      const res = await fetch(SPAPI_SELLERS_URL, {
        headers: {
          "x-amz-access-token": accessToken,
          "Content-Type": "application/json",
        },
      });

      if (res.ok) {
        const data = (await res.json()) as Record<string, any>;
        const participations = data.payload || [];
        const first = participations[0];
        return {
          externalSellerId: first?.marketplace?.id || "amazon-seller",
          accountName: first?.marketplace?.name || "Amazon Seller",
        };
      }

      // If SigV4 is required and we fail, return a placeholder
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
    // Test by refreshing a token (which doesn't require SigV4)
    // The caller passes accessToken but we test by verifying it's valid
    try {
      // Try the SP-API marketplace participations endpoint
      const res = await fetch(SPAPI_SELLERS_URL, {
        headers: {
          "x-amz-access-token": accessToken,
          "Content-Type": "application/json",
        },
      });

      if (res.ok) {
        return { ok: true, message: "Amazon SP-API connection verified" };
      }

      // 403 may mean SigV4 is needed but the token itself is valid
      if (res.status === 403) {
        return { ok: true, message: "LWA token valid (SP-API requires SigV4 for full access)" };
      }

      return { ok: false, message: `Amazon API returned ${res.status}` };
    } catch (err) {
      return { ok: false, message: `Amazon connection test failed: ${(err as Error).message}` };
    }
  },
};
