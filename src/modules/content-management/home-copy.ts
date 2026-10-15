import { homepageConfig } from "../homepage/config";
import type { HomepageContent } from "./contracts";
type Copy = {
  [K in keyof typeof homepageConfig.copy.zh]: K extends "programItems"
    ? readonly { title: string; subtitle: string; body: string }[]
    : string;
};
export function homeCopy(
  language: "zh" | "en",
  content?: HomepageContent,
): Copy {
  const base = homepageConfig.copy[language];
  if (!content) return base;
  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(content.text).map(([key, value]) => [
        key,
        value[language],
      ]),
    ),
    programItems: content.programs.map((item) => ({
      title: item.title[language],
      subtitle: item.subtitle[language],
      body: item.body[language],
    })),
  };
}
