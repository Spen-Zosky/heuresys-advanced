import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import commonIt from "../locales/it/common.json";
import commonEn from "../locales/en/common.json";

// Use a single i18next instance shared by SSR and client.
if (!i18next.isInitialized) {
  void i18next
    .use(initReactI18next)
    .init({
      resources: {
        it: { common: commonIt },
        en: { common: commonEn },
      },
      lng:
        typeof process !== "undefined"
          ? process.env.NEXT_PUBLIC_DEFAULT_LOCALE || "it"
          : "it",
      fallbackLng: "en",
      defaultNS: "common",
      interpolation: { escapeValue: false },
    });
}

export const i18n = i18next;
