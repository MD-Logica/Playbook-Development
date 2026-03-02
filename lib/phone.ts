export interface CountryCode {
  code: string;
  dial: string;
  flag: string;
  digits: number;
}

export const COUNTRY_CODES: CountryCode[] = [
  { code: "US", dial: "1", flag: "US", digits: 10 },
  { code: "CA", dial: "1", flag: "CA", digits: 10 },
  { code: "GB", dial: "44", flag: "GB", digits: 10 },
  { code: "AU", dial: "61", flag: "AU", digits: 9 },
  { code: "MX", dial: "52", flag: "MX", digits: 10 },
  { code: "BR", dial: "55", flag: "BR", digits: 11 },
  { code: "IN", dial: "91", flag: "IN", digits: 10 },
];

export function stripNonDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizePhone(raw: string, dialCode: string = "1"): string {
  const digits = stripNonDigits(raw);
  return `+${dialCode}${digits}`;
}

export function formatPhoneDisplay(raw: string | null | undefined): string {
  if (!raw) return "";
  let digits = stripNonDigits(raw);
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  } else if (digits.length > 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw ?? "";
}

export function formatPhoneAsYouType(digits: string): string {
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

export function isValidPhoneLength(digits: string, expectedDigits: number = 10): boolean {
  return stripNonDigits(digits).length === expectedDigits;
}
