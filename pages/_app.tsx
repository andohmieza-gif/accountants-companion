import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { DM_Sans } from "next/font/google";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "700"],
});

/** Change this string to update the text shown in the browser tab. */
const defaultTitle = "The Accountant's Companion";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>{defaultTitle}</title>
        <meta
          name="description"
          content="AI assistant for accounting students and professionals: GAAP, IFRS, audit, tax, CPA prep, and journal entries."
        />
      </Head>
      <div className={`${dmSans.variable} min-h-screen font-sans`}>
        <Component {...pageProps} />
      </div>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
