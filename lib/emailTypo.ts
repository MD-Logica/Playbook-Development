const TYPO_MAP: Record<string, string> = {
  ".con": ".com",
  ".cpm": ".com",
  ".ocm": ".com",
  "gnail.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmail.co": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "yahooo.com": "yahoo.com",
  "yaho.com": "yahoo.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "iclod.com": "icloud.com",
  "icloud.con": "icloud.com",
};

export function checkEmailTypo(email: string): string | null {
  if (!email || !email.includes("@")) return null;
  const lower = email.toLowerCase().trim();
  const atIndex = lower.indexOf("@");
  const domain = lower.slice(atIndex + 1);
  const localPart = lower.slice(0, atIndex);

  for (const [typo, correction] of Object.entries(TYPO_MAP)) {
    if (typo.startsWith(".")) {
      if (domain.endsWith(typo.slice(1))) {
        const correctedDomain = domain.slice(0, domain.length - typo.slice(1).length) + correction.slice(1);
        return `${localPart}@${correctedDomain}`;
      }
    } else {
      if (domain === typo) {
        return `${localPart}@${correction}`;
      }
    }
  }
  return null;
}
