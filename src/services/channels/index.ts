import type { ChannelProvider } from "./types";
import { ebayProvider } from "./ebay";
import { amazonProvider } from "./amazon";
import { temuProvider } from "./temu";

const providers: Record<string, ChannelProvider> = {
  ebay: ebayProvider,
  amazon: amazonProvider,
  temu: temuProvider,
};

export function getProvider(channel: string): ChannelProvider {
  const provider = providers[channel.toLowerCase()];
  if (!provider) {
    throw new Error(`Unknown channel: ${channel}`);
  }
  return provider;
}

export { ebayProvider, amazonProvider, temuProvider };
export type { ChannelProvider, TokenResult, RefreshResult, SellerIdentity, TestResult } from "./types";
