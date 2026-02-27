import crypto from "crypto";

/**
 * AWS Signature Version 4 request signing for Amazon SP-API.
 * Implements the signing process without external AWS SDK dependencies.
 */

interface SigV4Options {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  service: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data).digest();
}

function sha256(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function getSignatureKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Buffer {
  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

/**
 * Sign an HTTP request using AWS SigV4.
 * Returns the headers dict with Authorization and other required headers added.
 */
export function signRequest(options: SigV4Options): Record<string, string> {
  const { method, url: urlString, body, service, region, accessKeyId, secretAccessKey, sessionToken } = options;

  const url = new URL(urlString);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const dateStamp = amzDate.slice(0, 8);

  // Build canonical URI and query string
  const canonicalUri = url.pathname || "/";
  const params = Array.from(url.searchParams.entries()).sort(([a], [b]) => a.localeCompare(b));
  const canonicalQuerystring = params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");

  // Build headers to sign
  const headers: Record<string, string> = {
    ...options.headers,
    host: url.host,
    "x-amz-date": amzDate,
  };

  if (sessionToken) {
    headers["x-amz-security-token"] = sessionToken;
  }

  const payloadHash = sha256(body || "");
  headers["x-amz-content-sha256"] = payloadHash;

  // Sort headers and build canonical headers string
  const signedHeaderKeys = Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort();
  const canonicalHeaders = signedHeaderKeys.map((k) => `${k}:${headers[Object.keys(headers).find((h) => h.toLowerCase() === k)!].trim()}\n`).join("");
  const signedHeaders = signedHeaderKeys.join(";");

  // Canonical request
  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  // String to sign
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");

  // Signing key and signature
  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = hmac(signingKey, stringToSign).toString("hex");

  // Authorization header
  headers["Authorization"] = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  // Remove host header (fetch will add it)
  delete headers["host"];

  return headers;
}

/**
 * Assume an IAM role via STS and return temporary credentials.
 * Used when SP-API requires role-based access.
 */
export async function assumeRole(
  roleArn: string,
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
  sessionName = "sp-api-session",
): Promise<{ accessKeyId: string; secretAccessKey: string; sessionToken: string }> {
  const url = "https://sts.amazonaws.com/";
  const body = new URLSearchParams({
    Action: "AssumeRole",
    Version: "2011-06-15",
    RoleArn: roleArn,
    RoleSessionName: sessionName,
    DurationSeconds: "3600",
  }).toString();

  const headers = signRequest({
    method: "POST",
    url,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    service: "sts",
    region,
    accessKeyId,
    secretAccessKey,
  });

  const res = await fetch(url, {
    method: "POST",
    headers,
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`STS AssumeRole failed (${res.status}): ${err}`);
  }

  const xml = await res.text();

  // Parse XML response (simple regex extraction — no XML parser needed)
  const extract = (tag: string) => {
    const match = xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`));
    if (!match) throw new Error(`Missing ${tag} in STS response`);
    return match[1];
  };

  return {
    accessKeyId: extract("AccessKeyId"),
    secretAccessKey: extract("SecretAccessKey"),
    sessionToken: extract("SessionToken"),
  };
}

/**
 * Make a signed SP-API request. Handles STS role assumption if SPAPI_ROLE_ARN is set.
 */
export async function spApiRequest(
  method: string,
  url: string,
  accessToken: string,
  body?: string,
): Promise<Response> {
  const region = process.env.AWS_REGION || "us-east-1";
  let akid = process.env.AWS_ACCESS_KEY_ID;
  let secret = process.env.AWS_SECRET_ACCESS_KEY;
  let sessionToken: string | undefined;

  if (!akid || !secret) {
    throw new Error("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required for SP-API");
  }

  // If a role ARN is configured, assume it first
  const roleArn = process.env.SPAPI_ROLE_ARN;
  if (roleArn) {
    const creds = await assumeRole(roleArn, akid, secret, region);
    akid = creds.accessKeyId;
    secret = creds.secretAccessKey;
    sessionToken = creds.sessionToken;
  }

  const baseHeaders: Record<string, string> = {
    "x-amz-access-token": accessToken,
    "Content-Type": "application/json",
  };

  const signed = signRequest({
    method,
    url,
    headers: baseHeaders,
    body,
    service: "execute-api",
    region,
    accessKeyId: akid,
    secretAccessKey: secret,
    sessionToken,
  });

  return fetch(url, {
    method,
    headers: signed,
    body: method !== "GET" ? body : undefined,
  });
}
