import type { AppConfig, FeatureFlags } from "./types";

export const isProduction = import.meta.env.MODE === "production";

const DEFAULT_FEATURES: FeatureFlags = {
  darkMode: false,
  analytics: isProduction,
  betaFeatures: false,
};

export function getAppConfig(): AppConfig {
  return {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000",
    environment: isProduction ? "production" : "development",
    features: DEFAULT_FEATURES,
  };
}

export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  const config = getAppConfig();
  return config.features[flag];
}
