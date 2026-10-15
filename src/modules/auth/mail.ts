import { randomUUID } from "node:crypto";
import { desc } from "drizzle-orm";
import { getDb } from "../../lib/db";
import { devMails } from "./schema";

export function isDevMailEnabled() {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.ENABLE_DEV_MAIL === "true"
  );
}

export function createDevMail(
  email: string,
  language: "zh" | "en",
  code: string,
  createdAt: Date,
) {
  if (!isDevMailEnabled()) throw new Error("MAIL_DISABLED");
  return {
    id: randomUUID(),
    email,
    language,
    createdAt,
    subject: language === "zh" ? "黑客松登录验证码" : "Hackathon sign-in code",
    body:
      language === "zh"
        ? `你的验证码是 ${code}，10 分钟内有效。请勿向他人透露。`
        : `Your sign-in code is ${code}. It expires in 10 minutes. Do not share it.`,
  };
}

export async function listDevMails() {
  if (!isDevMailEnabled()) return [];
  return (await getDb())
    .select()
    .from(devMails)
    .orderBy(desc(devMails.createdAt))
    .limit(50);
}
