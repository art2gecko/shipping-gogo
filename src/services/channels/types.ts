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
