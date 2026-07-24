export type PhoneCountryOption = {
  code: string;
  dial: string;
  label: string;
};

/** Códigos de país mais comuns para moradores (DDI). */
export const PHONE_COUNTRY_OPTIONS: PhoneCountryOption[] = [
  { code: "BR", dial: "55", label: "Brasil (+55)" },
  { code: "PT", dial: "351", label: "Portugal (+351)" },
  { code: "US", dial: "1", label: "EUA / Canadá (+1)" },
  { code: "AR", dial: "54", label: "Argentina (+54)" },
  { code: "UY", dial: "598", label: "Uruguai (+598)" },
  { code: "PY", dial: "595", label: "Paraguai (+595)" },
  { code: "CL", dial: "56", label: "Chile (+56)" },
  { code: "CO", dial: "57", label: "Colômbia (+57)" },
  { code: "PE", dial: "51", label: "Peru (+51)" },
  { code: "BO", dial: "591", label: "Bolívia (+591)" },
  { code: "MX", dial: "52", label: "México (+52)" },
  { code: "ES", dial: "34", label: "Espanha (+34)" },
  { code: "IT", dial: "39", label: "Itália (+39)" },
  { code: "DE", dial: "49", label: "Alemanha (+49)" },
  { code: "FR", dial: "33", label: "França (+33)" },
  { code: "GB", dial: "44", label: "Reino Unido (+44)" },
  { code: "AO", dial: "244", label: "Angola (+244)" },
  { code: "MZ", dial: "258", label: "Moçambique (+258)" },
  { code: "CV", dial: "238", label: "Cabo Verde (+238)" },
  { code: "JP", dial: "81", label: "Japão (+81)" },
  { code: "CN", dial: "86", label: "China (+86)" },
];

export const DEFAULT_PHONE_COUNTRY_DIAL = "55";

export function buildInternationalPhone(dialCode: string, nationalNumber: string): string {
  const dial = dialCode.replace(/\D/g, "");
  const national = nationalNumber.replace(/\D/g, "");

  if (!national) {
    return "";
  }

  if (!dial) {
    return `+${national}`;
  }

  // Evita duplicar DDI se a pessoa colar o número completo.
  if (national.startsWith(dial) && national.length > dial.length + 6) {
    return `+${national}`;
  }

  return `+${dial}${national}`;
}
