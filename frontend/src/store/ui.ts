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
    const stored = localStorage.getItem("dark_mode");
    if (stored !== null) return stored === "true";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
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
