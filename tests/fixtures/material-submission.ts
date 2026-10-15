import { expect, type APIRequestContext } from "@playwright/test";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import type {
  MaterialPayload,
  MaterialsDto,
} from "../../src/modules/event-participation/contracts";

/** Use only with an isolated test server and a registered participant session. */
export async function seedMaterialSubmission(
  client: APIRequestContext,
  name: string,
) {
  const currentResponse = await client.get("/api/events/demo/materials");
  expect(currentResponse.status()).toBe(200);
  const current = (await currentResponse.json()) as MaterialsDto;
  if (current.official) return { material: current, payload: current.official };
  const image = await sharp({
    create: { width: 12, height: 12, channels: 3, background: "#b397ff" },
  })
    .png()
    .toBuffer();
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const document = Buffer.from(await pdf.save());
  const registration = await client.post("/api/events/demo/registration", {
    data: {
      displayName: `Review ${name}`,
      role: "developer",
      country: "China",
      organization: "Browser test",
      contact: "Private contact",
      acceptedTerms: true,
    },
  });
  expect(registration.status()).toBe(200);
  const cover = await client.post("/api/events/demo/files", {
    multipart: {
      purpose: "cover",
      file: { name: "review-cover.png", mimeType: "image/png", buffer: image },
    },
  });
  expect(cover.status()).toBe(200);
  const attachment = await client.post("/api/events/demo/files", {
    multipart: {
      purpose: "document",
      file: {
        name: "review-document.pdf",
        mimeType: "application/pdf",
        buffer: document,
      },
    },
  });
  expect(attachment.status()).toBe(200);
  const payload: MaterialPayload = {
    name: `Official ${name}`,
    tagline: "Official review material",
    description: "This official project demonstrates the review workflow.",
    trackId: "open",
    coverId: (await cover.json()).id,
    screenshotIds: [],
    documentId: (await attachment.json()).id,
    videoUrl: "",
    experienceUrl: "",
    codeUrl: "",
    original: true,
    usageAuthorized: true,
    publicDisplay: false,
  };
  const draft = await client.put("/api/events/demo/materials/draft", {
    data: { revision: current.revision, payload },
  });
  expect(draft.status()).toBe(200);
  const submit = await client.post("/api/events/demo/materials/submit", {
    data: { revision: (await draft.json()).revision },
  });
  expect(submit.status()).toBe(200);
  return { material: (await submit.json()) as MaterialsDto, payload };
}
