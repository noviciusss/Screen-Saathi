export const DENYLIST_STORAGE_KEY = "saathi_denylist" as const;
export const CONSENT_STORAGE_KEY = "saathi_consent_accepted" as const;

export const DEFAULT_DENYLIST = [
  "bank",
  "netbanking",
  "upi",
  "payment",
  "paytm",
  "broker",
  "trading",
  "creditcard",
] as const;

export function isDenylisted(urlString: string, patterns: readonly string[]): boolean {
  try {
    const url = new URL(urlString);
    const hostAndPath = `${url.hostname}${url.pathname}`.toLowerCase();
    return patterns.some((pattern) => pattern.trim() !== "" && hostAndPath.includes(pattern.trim().toLowerCase()));
  } catch {
    return true;
  }
}
