import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { DM_Sans } from "next/font/google";
import {
  defaultDescription,
  getSiteOrigin,
  siteTitle,
} from "@/lib/seo";
import { useRouter } from "next/router";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "700"],
});

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const siteUrl = getSiteOrigin();
  const pathOnly = router.asPath.split("#")[0]?.split("?")[0] ?? "/";
  const canonicalUrl = `${siteUrl}${pathOnly === "/" ? "" : pathOnly}`;
  const ogImageUrl = `${siteUrl}/og.png`;
  const studyOg = router.pathname === "/study";

  return (
    <>
      <Head>
        <title>{siteTitle}</title>
        <meta name="description" content={defaultDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={siteTitle} />
        {!studyOg && (
          <>
            <meta property="og:title" content={siteTitle} />
            <meta property="og:url" content={canonicalUrl} />
            <meta name="twitter:title" content={siteTitle} />
          </>
        )}
        <meta property="og:description" content={defaultDescription} />
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:image:width" content="1376" />
        <meta property="og:image:height" content="768" />
        <meta property="og:image:alt" content={siteTitle} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:description" content={defaultDescription} />
        <meta name="twitter:image" content={ogImageUrl} />
      </Head>
      <div className={`${dmSans.variable} min-h-screen font-sans`}>
        <Component {...pageProps} />
      </div>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
