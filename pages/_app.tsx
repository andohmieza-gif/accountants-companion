import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

/** Change this string to update the text shown in the browser tab. */
const defaultTitle = "The Accountant's Companion";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>{defaultTitle}</title>
        <meta
          name="description"
          content="AI assistant for accounting students and professionals — GAAP, IFRS, audit, tax, CPA prep, and journal entries."
        />
      </Head>
      <div className={`${inter.variable} min-h-screen font-sans`}>
        <Component {...pageProps} />
      </div>
    </>
  );
}
