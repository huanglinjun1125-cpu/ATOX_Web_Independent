"use client";
import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";
import { Language, messages } from "@/lib/i18n";
const Context = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
  t: (typeof messages)[Language];
} | null>(null);
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("language-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("language-change", callback);
  };
}
function snapshot(defaultLanguage: Language): Language {
  try {
    const stored = localStorage.getItem("hackathon-language");
    return stored === null ? defaultLanguage : stored === "en" ? "en" : "zh";
  } catch {
    return defaultLanguage;
  }
}
export function LanguageProvider({
  children,
  defaultLanguage = "zh",
}: {
  children: React.ReactNode;
  defaultLanguage?: Language;
}) {
  const language = useSyncExternalStore(
    subscribe,
    () => snapshot(defaultLanguage),
    () => defaultLanguage,
  );
  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);
  const setLanguage = (value: Language) => {
    localStorage.setItem("hackathon-language", value);
    window.dispatchEvent(new Event("language-change"));
  };
  return (
    <Context.Provider value={{ language, setLanguage, t: messages[language] }}>
      {children}
    </Context.Provider>
  );
}
export function useLanguage() {
  const context = useContext(Context);
  if (!context) throw new Error("LanguageProvider is required");
  return context;
}
