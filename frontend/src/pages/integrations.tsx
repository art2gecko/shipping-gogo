import * as React from "react";
import { useSearchParams } from "react-router-dom";
import {
  Loader2,
  Link2,
  Plus,
  Unplug,
  TestTube2,
  Key,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import {
  useChannelAccounts,
  useStartIntegration,
  useTestConnection,
  useDisconnectAccount,
  useTemuManualConnect,
} from "@/hooks/use-api";
import type { ChannelAccount } from "@/types";

// ─── Channel definitions ────────────────────────────────────────────────────

interface ChannelDef {
  key: string;
  name: string;
  description: string;
  color: string;
  supportsManualToken: boolean;
}

const CHANNELS: ChannelDef[] = [
  {
    key: "amazon",
    name: "Amazon",
    description: "Connect one or more Amazon Seller Central accounts via SP-API",
    color: "bg-channel-amazon",
    supportsManualToken: false,
  },
  {
    key: "ebay",
    name: "eBay",
    description: "Connect one or more eBay seller accounts via OAuth",
    color: "bg-channel-ebay",
    supportsManualToken: false,
  },
  {
    key: "temu",
    name: "Temu",
    description: "Connect one or more Temu seller accounts via OAuth or API token",
    color: "bg-channel-temu",
    supportsManualToken: true,
  },
];

// ─── Status badge helper ────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "OK":
      return (
        <Badge variant="success" className="gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Connected
        </Badge>
      );
    case "ERROR":
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          Error
        </Badge>
      );
    case "NEEDS_REAUTH":
      return (
        <Badge variant="warning" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Needs Reauth
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// ─── Account row ────────────────────────────────────────────────────────────

function AccountRow({
  account,
  channelKey,
}: {
  account: ChannelAccount;
  channelKey: string;
}) {
  const testConnection = useTestConnection();
  const disconnectAccount = useDisconnectAccount();

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{account.accountName}</span>
          <StatusBadge status={account.status} />
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground">
          {account.externalSellerId && (
            <span>Seller ID: {account.externalSellerId}</span>
          )}
          {account.lastSyncedAt && (
            <span>Last sync: {new Date(account.lastSyncedAt).toLocaleString()}</span>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={testConnection.isPending}
          onClick={() =>
            testConnection.mutate({ channel: channelKey, accountId: account.id })
          }
        >
          {testConnection.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <TestTube2 className="h-4 w-4" />
          )}
          Test
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={disconnectAccount.isPending}
          onClick={() => {
            if (window.confirm(`Disconnect ${account.accountName}?`)) {
              disconnectAccount.mutate(account.id);
            }
          }}
        >
          {disconnectAccount.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Unplug className="h-4 w-4" />
          )}
          Disconnect
        </Button>
      </div>
    </div>
  );
}

// ─── Channel card ───────────────────────────────────────────────────────────

function ChannelCard({ channel }: { channel: ChannelDef }) {
  const { data: accounts, isLoading } = useChannelAccounts(channel.key);
  const startIntegration = useStartIntegration();
  const [showTokenDialog, setShowTokenDialog] = React.useState(false);

  const accountCount = accounts?.length ?? 0;
  const hasAccounts = accountCount > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg ${channel.color} flex items-center justify-center text-white font-bold text-sm`}>
              {channel.name[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{channel.name}</CardTitle>
                {hasAccounts && (
                  <Badge variant="secondary" className="text-xs">
                    {accountCount} {accountCount === 1 ? "store" : "stores"}
                  </Badge>
                )}
              </div>
              <CardDescription>{channel.description}</CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={startIntegration.isPending}
              onClick={() => startIntegration.mutate(channel.key)}
            >
              {startIntegration.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : hasAccounts ? (
                <Plus className="h-4 w-4" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              {hasAccounts ? "Add Store" : "Connect"}
            </Button>
            {channel.supportsManualToken && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowTokenDialog(true)}
              >
                <Key className="h-4 w-4" />
                {hasAccounts ? "Add via Token" : "Connect via Token"}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16" />
          </div>
        ) : !hasAccounts ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No stores connected. Click Connect to add your first store.
          </p>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                channelKey={channel.key}
              />
            ))}
          </div>
        )}
      </CardContent>

      {channel.supportsManualToken && (
        <TemuTokenDialog
          open={showTokenDialog}
          onOpenChange={setShowTokenDialog}
        />
      )}
    </Card>
  );
}

// ─── Temu manual token dialog ───────────────────────────────────────────────

function TemuTokenDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const temuManual = useTemuManualConnect();
  const [accountName, setAccountName] = React.useState("");
  const [accessToken, setAccessToken] = React.useState("");
  const [refreshToken, setRefreshToken] = React.useState("");
  const [sellerId, setSellerId] = React.useState("");

  const handleSubmit = () => {
    if (!accountName || !accessToken) return;
    temuManual.mutate(
      {
        accountName,
        accessToken,
        refreshToken: refreshToken || undefined,
        externalSellerId: sellerId || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setAccountName("");
          setAccessToken("");
          setRefreshToken("");
          setSellerId("");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect Temu via API Token</DialogTitle>
          <DialogDescription>
            Paste your Temu API credentials to connect your seller account.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Account Name *</Label>
            <Input
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="My Temu Store"
            />
          </div>
          <div className="space-y-2">
            <Label>Access Token *</Label>
            <Input
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Paste your access token"
              type="password"
            />
          </div>
          <div className="space-y-2">
            <Label>Refresh Token (optional)</Label>
            <Input
              value={refreshToken}
              onChange={(e) => setRefreshToken(e.target.value)}
              placeholder="Paste your refresh token"
              type="password"
            />
          </div>
          <div className="space-y-2">
            <Label>Seller ID (optional)</Label>
            <Input
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
              placeholder="Your Temu seller/shop ID"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!accountName || !accessToken || temuManual.isPending}
          >
            {temuManual.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main integrations page ─────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [searchParams] = useSearchParams();

  // Show toast on redirect from OAuth callback
  React.useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");

    if (connected) {
      toast({ title: `${connected} account connected successfully` });
    }
    if (error) {
      toast({ title: "Connection failed", description: error, variant: "destructive" });
    }
  }, [searchParams]);

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-muted-foreground">
          Connect your marketplace seller accounts to sync orders and purchase labels
        </p>
      </div>

      {CHANNELS.map((channel) => (
        <ChannelCard key={channel.key} channel={channel} />
      ))}
    </div>
  );
}
