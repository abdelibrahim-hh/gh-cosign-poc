import { create } from "zustand";

interface SettingsState {
  theme: "light" | "dark";
  language: string;
  notificationsEnabled: boolean;
  setTheme: (theme: "light" | "dark") => void;
  setLanguage: (language: string) => void;
  toggleNotifications: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: "light",
  language: "en",
  notificationsEnabled: true,
  setTheme: (theme) => set({ theme }),
  setLanguage: (language) => set({ language }),
  toggleNotifications: () =>
    set((state) => ({ notificationsEnabled: !state.notificationsEnabled })),
}));
