import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  darkMode: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebarCollapsed: () => void;
  toggleDarkMode: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  sidebarCollapsed: (() => {
    const stored = localStorage.getItem("sidebar_collapsed");
    return stored === "true";
  })(),
  darkMode: (() => {
    // One-time reset: clear stale auto-detected dark mode from previous color scheme
    const migrated = localStorage.getItem("dark_mode_v2");
    if (!migrated) {
      localStorage.removeItem("dark_mode");
      localStorage.setItem("dark_mode_v2", "1");
    }
    const stored = localStorage.getItem("dark_mode");
    if (stored !== null) return stored === "true";
    return false; // default to light mode for ops dashboards
  })(),

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebarCollapsed: () =>
    set((s) => {
      const next = !s.sidebarCollapsed;
      localStorage.setItem("sidebar_collapsed", String(next));
      return { sidebarCollapsed: next };
    }),
  toggleDarkMode: () =>
    set((s) => {
      const next = !s.darkMode;
      localStorage.setItem("dark_mode", String(next));
      return { darkMode: next };
    }),
}));
