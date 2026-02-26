import * as React from "react";
import { Save, Loader2, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings, useUpdateSetting, useUsers, useCreateUser } from "@/hooks/use-api";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const updateSetting = useUpdateSetting();
  const { data: users, isLoading: usersLoading } = useUsers();
  const createUser = useCreateUser();

  const [shipmentRoot, setShipmentRoot] = React.useState("");
  const [safeMode, setSafeMode] = React.useState(false);
  const [createDialog, setCreateDialog] = React.useState(false);
  const [newUsername, setNewUsername] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [newRole, setNewRole] = React.useState("WAREHOUSE");

  // Init settings from API
  React.useEffect(() => {
    if (settings) {
      const root = settings.find((s) => s.key === "shipment_root");
      if (root) setShipmentRoot(root.value);
      const safe = settings.find((s) => s.key === "safe_mode");
      if (safe) setSafeMode(safe.value === "true");
    }
  }, [settings]);

  const handleSaveRoot = () => {
    updateSetting.mutate({ key: "shipment_root", value: shipmentRoot });
  };

  const handleToggleSafeMode = (checked: boolean) => {
    setSafeMode(checked);
    updateSetting.mutate({ key: "safe_mode", value: String(checked) });
  };

  const handleCreateUser = () => {
    if (!newUsername || !newPassword) return;
    createUser.mutate(
      { username: newUsername, password: newPassword, role: newRole },
      {
        onSuccess: () => {
          setCreateDialog(false);
          setNewUsername("");
          setNewPassword("");
          setNewRole("WAREHOUSE");
        },
      },
    );
  };

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure your fulfillment system</p>
      </div>

      {/* Shipment Root */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Shipment Root Folder</CardTitle>
          <CardDescription>
            Base directory for daily shipment folders (pick lists, labels, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settingsLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <div className="flex gap-2">
              <Input
                value={shipmentRoot}
                onChange={(e) => setShipmentRoot(e.target.value)}
                placeholder="./Shipments"
                className="flex-1"
              />
              <Button
                onClick={handleSaveRoot}
                disabled={updateSetting.isPending}
              >
                {updateSetting.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Safe Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Safe Mode</CardTitle>
          <CardDescription>
            When enabled, label purchases are simulated (not actually charged)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settingsLoading ? (
            <Skeleton className="h-6 w-12" />
          ) : (
            <div className="flex items-center gap-3">
              <Switch
                checked={safeMode}
                onCheckedChange={handleToggleSafeMode}
              />
              <span className="text-sm">
                {safeMode ? (
                  <Badge variant="warning">Simulation Mode Active</Badge>
                ) : (
                  <span className="text-muted-foreground">Live mode</span>
                )}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Channel Rules Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Channel Rules</CardTitle>
          <CardDescription>
            Label source rules and thresholds per marketplace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-muted/50 p-8 text-center">
            <p className="text-muted-foreground">
              Channel rules configuration coming soon. This will allow you to set label source
              preferences, auto-purchase thresholds, and marketplace-specific settings.
            </p>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* User Management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">User Management</CardTitle>
            <CardDescription>Manage dashboard users and roles</CardDescription>
          </div>
          <Button size="sm" onClick={() => setCreateDialog(true)}>
            <UserPlus className="h-4 w-4" />
            Add User
          </Button>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : !users || users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users found.</p>
          ) : (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Username</th>
                    <th className="px-4 py-3 text-left font-medium">Role</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b">
                      <td className="px-4 py-3 font-medium">{user.username}</td>
                      <td className="px-4 py-3">
                        <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                          {user.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={user.active ? "success" : "outline"}>
                          {user.active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog
        open={createDialog}
        onOpenChange={() => {
          setCreateDialog(false);
          setNewUsername("");
          setNewPassword("");
          setNewRole("WAREHOUSE");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>Add a new dashboard user.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Enter username"
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter password"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="WAREHOUSE">Warehouse</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={!newUsername || !newPassword || createUser.isPending}
            >
              {createUser.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
