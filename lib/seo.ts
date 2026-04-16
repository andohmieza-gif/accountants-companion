export const siteTitle = "The Accountant's Companion";

export const defaultDescription =
  "AI assistant for accounting students and professionals: GAAP, IFRS, audit, tax, CPA prep, and journal entries.";

/** Base URL for canonical links and Open Graph (no trailing slash). */
export function getSiteOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return "http://localhost:3000";
}
