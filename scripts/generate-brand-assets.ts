import { mkdir, writeFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OrbitalArt, BrandMark } from "../src/components/brand-art";
async function generate() {
  await mkdir("public/brand", { recursive: true });
  const body = renderToStaticMarkup(createElement(OrbitalArt))
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>$/, "");
  for (const [name, title, subtitle, demo] of [
    ["malaysia-2026", "Build AI", "that matters.", false],
    ["demo", "Build", "together.", true],
    ["upcoming-demo", "Create", "what’s next.", true],
    ["past-demo", "Ideas", "into practice.", true],
  ] as const) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" style="color:#cfd5cb;--bg:#090a0a;--accent:#ff665c"><rect width="1200" height="630" fill="#090a0a"/><g transform="translate(570 -13) scale(.9)">${body}</g><g font-family="Arial,Helvetica,sans-serif" fill="#f1f0e9"><text x="62" y="83" font-size="34" font-weight="700" letter-spacing="-1.5">ATOX</text><text x="62" y="220" font-size="12" fill="#a4a8a5" letter-spacing="2">${demo ? "DEMONSTRATION EVENT" : "MALAYSIA / 2026 · PLANNING"}</text><text x="58" y="322" font-size="81" font-weight="400" letter-spacing="-5">${title}</text><text x="58" y="406" font-size="81" font-weight="400" letter-spacing="-5" fill="#ff665c">${subtitle}</text><text x="62" y="496" font-size="16">${demo ? "ATOX / PLATFORM DEMONSTRATION" : "ATOX × TAMAPUSC at APU"}</text><text x="62" y="528" font-size="12" fill="#a4a8a5">${demo ? "Illustrative content · Not a confirmed event" : "4–6 DECEMBER 2026 · HYBRID · VENUE PENDING APPROVAL"}</text></g><path d="M62 572H1138" stroke="#333635"/></svg>`;
    await writeFile(`public/event-covers/${name}.svg`, svg);
  }
  const mark = renderToStaticMarkup(createElement(BrandMark)).replace(
    "<svg ",
    '<svg xmlns="http://www.w3.org/2000/svg" style="color:#ff665c" ',
  );
  await writeFile("public/brand/favicon.svg", mark);
  console.log(
    "Generated original ATOX vectors and four consistent event covers.",
  );
}
void generate();
