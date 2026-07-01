import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const brochuresDir = path.join(root, "docs", "brochures");
const outputDir = path.join(brochuresDir, "pdf");
const logoPath = path.join(root, "public", "logo-granja-brasil.png");

const APP_URL = "https://granjabrasil.app.br";
const LINKS = {
  home: APP_URL,
  login: `${APP_URL}/login`,
  signup: `${APP_URL}/signup`,
};

async function loadTemplate(name) {
  return fs.readFile(path.join(brochuresDir, name), "utf8");
}

async function logoDataUrl() {
  const buffer = await fs.readFile(logoPath);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

async function qrDataUrl(url) {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 280,
    color: { dark: "#14532d", light: "#ffffff" },
  });
}

function inject(html, replacements) {
  let result = html;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

async function renderPdf(browser, html, outputName) {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.emulateMediaType("print");
  await page.pdf({
    path: path.join(outputDir, outputName),
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });
  await page.close();
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });

  const [logo, qrSignup, qrLogin, adminHtml, residentHtml] = await Promise.all([
    logoDataUrl(),
    qrDataUrl(LINKS.signup),
    qrDataUrl(LINKS.login),
    loadTemplate("moradores.html"),
    loadTemplate("sindicos-admin.html"),
  ]);

  const common = { LOGO: logo, APP_URL, YEAR: String(new Date().getFullYear()) };

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    await renderPdf(
      browser,
      inject(residentHtml, { ...common, QR_SIGNUP: qrSignup }),
      "Granja-Brasil-Moradores.pdf",
    );

    await renderPdf(
      browser,
      inject(adminHtml, { ...common, QR_LOGIN: qrLogin }),
      "Granja-Brasil-Sindicos-Administradores.pdf",
    );
  } finally {
    await browser.close();
  }

  console.log("PDFs gerados em docs/brochures/pdf/");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
