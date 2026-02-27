import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Layers,
  AlertTriangle,
  ScanBarcode,
  FileText,
  Settings,
  Plug,
  LogOut,
  Menu,
  X,
  Moon,
  Sun,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Command,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, shortcut: "G D" },
  { name: "Orders", href: "/orders", icon: Package, shortcut: "G O" },
  { name: "Batches", href: "/batches", icon: Layers, shortcut: "G B" },
  { name: "Exceptions", href: "/exceptions", icon: AlertTriangle, shortcut: "G E" },
  { name: "Serial Capture", href: "/serial-capture", icon: ScanBarcode, shortcut: "G S" },
  { name: "Documents", href: "/documents", icon: FileText },
  { name: "Integrations", href: "/settings/integrations", icon: Plug, shortcut: "G I" },
  { name: "Settings", href: "/settings", icon: Settings },
];

const routeTitles: Record<string, string> = {
  "/": "Dashboard",
  "/orders": "Orders",
  "/batches": "Batches",
  "/exceptions": "Exceptions",
  "/serial-capture": "Serial Capture",
  "/documents": "Documents",
  "/settings": "Settings",
  "/settings/integrations": "Integrations",
};

function getPageTitle(pathname: string): string {
  if (routeTitles[pathname]) return routeTitles[pathname];
  if (pathname.startsWith("/orders/")) return "Order Details";
  if (pathname.startsWith("/batches/")) return "Batch Details";
  return "";
}

function isNavActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/settings") return pathname === "/settings";
  return pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const {
    sidebarOpen,
    toggleSidebar,
    sidebarCollapsed,
    toggleSidebarCollapsed,
    darkMode,
    toggleDarkMode,
  } = useUIStore();

  const [cmdOpen, setCmdOpen] = React.useState(false);
  const [cmdSearch, setCmdSearch] = React.useState("");

  const pageTitle = getPageTitle(location.pathname);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Global keyboard shortcuts
  React.useEffect(() => {
    let gPressed = false;
    let gTimer: ReturnType<typeof setTimeout>;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      // Cmd+K or Ctrl+K → command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(true);
        return;
      }

      // Don't process other shortcuts when in an input
      if (isInput) return;

      // "/" → focus search / open command palette
      if (e.key === "/") {
        e.preventDefault();
        setCmdOpen(true);
        return;
      }

      // Escape → close command palette
      if (e.key === "Escape" && cmdOpen) {
        setCmdOpen(false);
        return;
      }

      // G + <key> navigation sequences
      if (e.key === "g" && !gPressed) {
        gPressed = true;
        clearTimeout(gTimer);
        gTimer = setTimeout(() => {
          gPressed = false;
        }, 500);
        return;
      }

      if (gPressed) {
        gPressed = false;
        clearTimeout(gTimer);
        switch (e.key) {
          case "d":
            navigate("/");
            break;
          case "o":
            navigate("/orders");
            break;
          case "b":
            navigate("/batches");
            break;
          case "e":
            navigate("/exceptions");
            break;
          case "s":
            navigate("/serial-capture");
            break;
          case "i":
            navigate("/settings/integrations");
            break;
        }
      }
    };

    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      clearTimeout(gTimer);
    };
  }, [navigate, cmdOpen]);

  // Filtered command palette items
  const cmdItems = React.useMemo(() => {
    const q = cmdSearch.toLowerCase();
    const allItems = [
      ...navigation.map((n) => ({ ...n, type: "navigate" as const })),
      { name: "New Batch", href: "/batches", icon: Layers, type: "action" as const },
      { name: "Sync Orders", href: "/", icon: Package, type: "action" as const },
    ];
    if (!q) return allItems;
    return allItems.filter((item) => item.name.toLowerCase().includes(q));
  }, [cmdSearch]);

  return (
    <TooltipProvider delayDuration={0}>
      <div className={cn("flex h-screen overflow-hidden", darkMode && "dark")}>
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={toggleSidebar}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-card transition-all duration-200 lg:static",
            sidebarCollapsed ? "lg:w-[3.5rem]" : "lg:w-56",
            sidebarOpen
              ? "w-56 translate-x-0"
              : "-translate-x-full lg:translate-x-0",
          )}
        >
          {/* Logo */}
          <div className="flex h-14 shrink-0 items-center border-b px-3">
            <Link to="/" className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Package className="h-4 w-4" />
              </div>
              {!sidebarCollapsed && (
                <span className="text-base font-bold tracking-tight truncate">
                  ShipGo
                </span>
              )}
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto lg:hidden h-8 w-8"
              onClick={toggleSidebar}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Nav links */}
          <ScrollArea className="flex-1 py-3">
            <nav
              className={cn(
                "space-y-0.5",
                sidebarCollapsed ? "px-1.5" : "px-2",
              )}
            >
              {navigation.map((item) => {
                const active = isNavActive(item.href, location.pathname);
                const linkEl = (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "flex items-center rounded-md text-[13px] font-medium transition-colors",
                      sidebarCollapsed
                        ? "h-9 w-9 justify-center mx-auto"
                        : "gap-2.5 px-2.5 py-2",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                    onClick={() => {
                      if (window.innerWidth < 1024) toggleSidebar();
                    }}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!sidebarCollapsed && (
                      <>
                        <span className="truncate flex-1">{item.name}</span>
                        {item.shortcut && (
                          <span className="text-[10px] text-muted-foreground/60 font-mono">
                            {item.shortcut}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );

                if (sidebarCollapsed) {
                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                      <TooltipContent side="right" className="text-xs">
                        {item.name}
                        {item.shortcut && (
                          <span className="ml-2 font-mono text-muted-foreground">
                            {item.shortcut}
                          </span>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return linkEl;
              })}
            </nav>
          </ScrollArea>

          {/* Footer */}
          <div className="border-t p-2 space-y-1">
            {/* Collapse toggle - desktop only */}
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "hidden lg:flex w-full text-muted-foreground hover:text-foreground h-8",
                sidebarCollapsed
                  ? "justify-center px-0"
                  : "justify-start gap-2 px-2",
              )}
              onClick={toggleSidebarCollapsed}
            >
              {sidebarCollapsed ? (
                <ChevronsRight className="h-4 w-4" />
              ) : (
                <>
                  <ChevronsLeft className="h-4 w-4" />
                  <span className="text-xs">Collapse</span>
                </>
              )}
            </Button>

            {/* User section */}
            {sidebarCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="flex h-9 w-full items-center justify-center rounded-md hover:bg-accent transition-colors"
                    onClick={handleLogout}
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {user?.username?.charAt(0).toUpperCase() || "U"}
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {user?.username || "User"} &middot; Logout
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                  {user?.username?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {user?.username || "User"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {user?.role || "Admin"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={handleLogout}
                  title="Logout"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top bar */}
          <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4 lg:px-6">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden h-8 w-8"
                onClick={toggleSidebar}
              >
                <Menu className="h-4 w-4" />
              </Button>
              <h1 className="text-base font-semibold">{pageTitle}</h1>
            </div>
            <div className="flex items-center gap-1">
              {/* Command palette trigger */}
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:flex h-8 gap-2 text-xs text-muted-foreground px-3"
                onClick={() => setCmdOpen(true)}
              >
                <Search className="h-3 w-3" />
                <span>Search...</span>
                <kbd className="ml-1 pointer-events-none inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                  <Command className="h-2.5 w-2.5" />K
                </kbd>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="sm:hidden h-8 w-8"
                onClick={() => setCmdOpen(true)}
              >
                <Search className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={toggleDarkMode}
                title="Toggle theme"
              >
                {darkMode ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-auto bg-muted/30">{children}</main>
        </div>

        {/* Command Palette */}
        <Dialog open={cmdOpen} onOpenChange={setCmdOpen}>
          <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
            <div className="flex items-center border-b px-3">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                value={cmdSearch}
                onChange={(e) => setCmdSearch(e.target.value)}
                placeholder="Search pages, actions..."
                className="border-0 shadow-none focus-visible:ring-0 h-11 text-sm"
                autoFocus
              />
              <kbd className="shrink-0 pointer-events-none inline-flex h-5 items-center rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
                ESC
              </kbd>
            </div>
            <ScrollArea className="max-h-[300px]">
              <div className="p-1">
                {cmdItems.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No results found.
                  </p>
                ) : (
                  cmdItems.map((item) => (
                    <button
                      key={item.name + item.href}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
                      onClick={() => {
                        navigate(item.href);
                        setCmdOpen(false);
                        setCmdSearch("");
                      }}
                    >
                      <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="flex-1">{item.name}</span>
                      {"shortcut" in item && item.shortcut && (
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {item.shortcut}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
