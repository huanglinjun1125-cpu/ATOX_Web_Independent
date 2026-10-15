import { homepageConfig } from "../homepage/config";
import { HOME_TEXT_KEYS, type HomepageContent } from "./contracts";
export function defaultHomepage(): HomepageContent {
  const text = Object.fromEntries(
    HOME_TEXT_KEYS.map((key) => [
      key,
      {
        zh: homepageConfig.copy.zh[key],
        en: homepageConfig.copy.en[key],
      },
    ]),
  ) as HomepageContent["text"];
  return {
    text,
    programs: homepageConfig.copy.zh.programItems.map((item, i) => ({
      title: {
        zh: item.title,
        en: homepageConfig.copy.en.programItems[i].title,
      },
      subtitle: {
        zh: item.subtitle,
        en: homepageConfig.copy.en.programItems[i].subtitle,
      },
      body: { zh: item.body, en: homepageConfig.copy.en.programItems[i].body },
    })),
    metadata: {
      title: {
        zh: homepageConfig.metadata.title,
        en: "ATOX — Connect the next",
      },
      description: {
        zh: homepageConfig.metadata.description,
        en: homepageConfig.copy.en.heroDescription,
      },
    },
  };
}
