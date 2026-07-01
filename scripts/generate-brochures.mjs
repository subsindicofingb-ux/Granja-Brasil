import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const brochuresDir = path.join(root, "docs", "brochures");
const outputDir = path.join(brochuresDir, "pdf");
const buildDir = path.join(brochuresDir, "build");
const logoPath = path.join(root, "public", "logo-granja-brasil.png");

const APP_URL = "https://granjabrasil.app.br";
const SIGNUP_URL = `${APP_URL}/signup`;
const LOGIN_URL = `${APP_URL}/login`;

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

  const leftovers = result.match(/\{\{[A-Z0-9_]+\}\}/g);
  if (leftovers?.length) {
    throw new Error(`Placeholders não substituídos: ${[...new Set(leftovers)].join(", ")}`);
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
  await fs.mkdir(buildDir, { recursive: true });

  const [logo, qrSignup, qrLogin, residentTemplate, adminTemplate] = await Promise.all([
    logoDataUrl(),
    qrDataUrl(SIGNUP_URL),
    qrDataUrl(LOGIN_URL),
    loadTemplate("moradores.html"),
    loadTemplate("sindicos-admin.html"),
  ]);

  const common = {
    LOGO: logo,
    APP_URL,
    SIGNUP_URL,
    LOGIN_URL,
    YEAR: String(new Date().getFullYear()),
  };

  const residentHtml = inject(residentTemplate, {
    ...common,
    QR_SIGNUP: qrSignup,
  });

  const adminHtml = inject(adminTemplate, {
    ...common,
    QR_LOGIN: qrLogin,
  });

  await Promise.all([
    fs.writeFile(path.join(buildDir, "moradores.html"), residentHtml, "utf8"),
    fs.writeFile(path.join(buildDir, "sindicos-admin.html"), adminHtml, "utf8"),
  ]);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    await renderPdf(browser, residentHtml, "Granja-Brasil-Moradores.pdf");
    await renderPdf(browser, adminHtml, "Granja-Brasil-Sindicos-Administradores.pdf");
  } finally {
    await browser.close();
  }

  console.log("Arquivos gerados:");
  console.log("  PDFs:  docs/brochures/pdf/");
  console.log("  HTML:  docs/brochures/build/ (abrir no navegador)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
