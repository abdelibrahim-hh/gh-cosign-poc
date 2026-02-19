import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../store/settingsStore";
import { Toggle } from "../components/ui/Toggle";
import type { FunctionComponent } from "../common/types";

export const Settings = (): FunctionComponent => {
  const { t } = useTranslation();
  const {
    theme,
    language,
    notificationsEnabled,
    setTheme,
    setLanguage,
    toggleNotifications,
  } = useSettingsStore();

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">{t("settings.title", "Settings")}</h1>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Appearance</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setTheme("light")}
            className={`px-4 py-2 rounded-lg border ${
              theme === "light"
                ? "bg-blue-100 border-blue-500 text-blue-700"
                : "border-gray-300 text-gray-600"
            }`}
          >
            Light
          </button>
          <button
            onClick={() => setTheme("dark")}
            className={`px-4 py-2 rounded-lg border ${
              theme === "dark"
                ? "bg-blue-100 border-blue-500 text-blue-700"
                : "border-gray-300 text-gray-600"
            }`}
          >
            Dark
          </button>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Language</h2>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2"
        >
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Notifications</h2>
        <Toggle
          label="Enable notifications"
          enabled={notificationsEnabled}
          onToggle={toggleNotifications}
        />
      </section>
    </div>
  );
};
