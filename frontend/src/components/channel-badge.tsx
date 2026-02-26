import { Badge } from "@/components/ui/badge";
import type { ChannelType } from "@/types";

const channelConfig: Record<ChannelType, { label: string; variant: "amazon" | "ebay" | "walmart" | "temu" | "secondary" }> = {
  AMAZON: { label: "Amazon", variant: "amazon" },
  EBAY: { label: "eBay", variant: "ebay" },
  WALMART: { label: "Walmart", variant: "walmart" },
  TEMU: { label: "Temu", variant: "temu" },
  OTHER: { label: "Other", variant: "secondary" },
};

export function ChannelBadge({ channel }: { channel: ChannelType }) {
  const config = channelConfig[channel] || { label: channel, variant: "secondary" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
