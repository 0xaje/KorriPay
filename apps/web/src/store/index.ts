import { create } from "zustand";

interface AppState {
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  systemStatus: "active" | "maintenance" | "offline";
  setSystemStatus: (status: "active" | "maintenance" | "offline") => void;
}

export const useAppStore = create<AppState>((set) => ({
  theme: "dark",
  setTheme: (theme) => set({ theme }),
  systemStatus: "active",
  setSystemStatus: (status) => set({ systemStatus: status }),
}));
