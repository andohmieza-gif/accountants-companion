import Head from "next/head";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AppChromeHeader } from "@/components/app-chrome-header";
import { RatingModal } from "@/components/rating-modal";
import { CalculatorWidget } from "@/components/calculator-widget";
import { defaultDescription, getSiteOrigin, siteTitle } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Calculator,
  ChevronRight,
  Layers,
  Percent,
  Scale,
  Smartphone,
  TrendingUp,
  Wallet,
} from "lucide-react";

const THEME_KEY = "accountants-companion-theme";
const RATING_KEY = "accountants-companion-rated";
const RATING_DISMISSED_KEY = "accountants-companion-rating-dismissed";

type Theme = "light" | "dark";

function parseAmount(raw: string): number | null {
  const n = parseFloat(raw.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function ResultLine({
  ok,
  children,
  theme,
}: {
  ok: boolean;
  children: ReactNode;
  theme: Theme;
}) {
  if (!ok) {
    return (
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Enter valid amounts. Denominators must be greater than zero where noted.
      </p>
    );
  }
  return (
    <p
      className={cn(
        "mt-3 rounded-lg px-3 py-2 text-center font-mono text-sm font-semibold tabular-nums text-foreground",
        theme === "dark" ? "bg-white/10" : "bg-muted"
      )}
    >
      {children}
    </p>
  );
}

function ToolCard({
  theme,
  title,
  hint,
  icon: Icon,
  children,
}: {
  theme: Theme;
  title: string;
  hint: string;
  icon: typeof Wallet;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-sm",
        theme === "dark" ? "border-white/10 bg-card/80" : "border-border/60 bg-card/90"
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{hint}</p>
      {children}
    </div>
  );
}

function WorkingCapitalTool({ theme }: { theme: Theme }) {
  const [ca, setCa] = useState("");
  const [cl, setCl] = useState("");
  const a = parseAmount(ca);
  const l = parseAmount(cl);
  const ok = a !== null && l !== null;
  const wc = ok ? a! - l! : null;

  return (
    <ToolCard
      theme={theme}
      title="Working capital"
      hint="Current assets minus current liabilities. Positive usually means more near-term flexibility."
      icon={Wallet}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Current assets</label>
          <Input type="text" inputMode="decimal" placeholder="e.g. 125000" value={ca} onChange={(e) => setCa(e.target.value)} className="text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Current liabilities</label>
          <Input type="text" inputMode="decimal" placeholder="e.g. 78000" value={cl} onChange={(e) => setCl(e.target.value)} className="text-sm" />
        </div>
      </div>
      <ResultLine ok={ok} theme={theme}>
        {ok ? `$${wc!.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : null}
      </ResultLine>
    </ToolCard>
  );
}

function CurrentRatioTool({ theme }: { theme: Theme }) {
  const [ca, setCa] = useState("");
  const [cl, setCl] = useState("");
  const a = parseAmount(ca);
  const l = parseAmount(cl);
  const ok = a !== null && l !== null && l > 0;
  const ratio = ok ? a! / l! : null;

  return (
    <ToolCard
      theme={theme}
      title="Current ratio"
      hint="Current assets ÷ current liabilities. Quick sanity check only—not a substitute for full analysis."
      icon={Percent}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Current assets</label>
          <Input type="text" inputMode="decimal" placeholder="e.g. 125000" value={ca} onChange={(e) => setCa(e.target.value)} className="text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Current liabilities</label>
          <Input type="text" inputMode="decimal" placeholder="e.g. 78000" value={cl} onChange={(e) => setCl(e.target.value)} className="text-sm" />
        </div>
      </div>
      <ResultLine ok={ratio !== null} theme={theme}>{ratio !== null ? `${ratio.toFixed(2)}×` : null}</ResultLine>
    </ToolCard>
  );
}

function QuickRatioTool({ theme }: { theme: Theme }) {
  const [ca, setCa] = useState("");
  const [inv, setInv] = useState("");
  const [cl, setCl] = useState("");
  const a = parseAmount(ca);
  const inventory = parseAmount(inv);
  const l = parseAmount(cl);
  const ok = a !== null && inventory !== null && l !== null && l > 0 && inventory <= a;
  const ratio = ok ? (a! - inventory!) / l! : null;

  return (
    <ToolCard
      theme={theme}
      title="Quick (acid-test) ratio"
      hint="(Current assets − inventory) ÷ current liabilities. Stricter liquidity check than the current ratio."
      icon={Layers}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Current assets</label>
          <Input type="text" inputMode="decimal" placeholder="e.g. 125000" value={ca} onChange={(e) => setCa(e.target.value)} className="text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Inventory</label>
          <Input type="text" inputMode="decimal" placeholder="e.g. 32000" value={inv} onChange={(e) => setInv(e.target.value)} className="text-sm" />
        </div>
        <div className="sm:col-span-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Current liabilities</label>
          <Input type="text" inputMode="decimal" placeholder="e.g. 78000" value={cl} onChange={(e) => setCl(e.target.value)} className="text-sm" />
        </div>
      </div>
      <ResultLine ok={ratio !== null} theme={theme}>{ratio !== null ? `${ratio.toFixed(2)}×` : null}</ResultLine>
    </ToolCard>
  );
}

function DebtToEquityTool({ theme }: { theme: Theme }) {
  const [debt, setDebt] = useState("");
  const [eq, setEq] = useState("");
  const d = parseAmount(debt);
  const e = parseAmount(eq);
  const ok = d !== null && e !== null && e > 0;
  const ratio = ok ? d! / e! : null;

  return (
    <ToolCard
      theme={theme}
      title="Debt-to-equity"
      hint="Total debt ÷ total equity. Definitions vary by text; use the same inputs consistently when comparing."
      icon={Scale}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Total debt</label>
          <Input type="text" inputMode="decimal" placeholder="e.g. 240000" value={debt} onChange={(e) => setDebt(e.target.value)} className="text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Total equity</label>
          <Input type="text" inputMode="decimal" placeholder="e.g. 180000" value={eq} onChange={(e) => setEq(e.target.value)} className="text-sm" />
        </div>
      </div>
      <ResultLine ok={ratio !== null} theme={theme}>{ratio !== null ? `${ratio.toFixed(2)}×` : null}</ResultLine>
    </ToolCard>
  );
}

function GrossMarginTool({ theme }: { theme: Theme }) {
  const [rev, setRev] = useState("");
  const [cogs, setCogs] = useState("");
  const r = parseAmount(rev);
  const c = parseAmount(cogs);
  const ok = r !== null && c !== null && r > 0 && c >= 0 && c <= r;
  const pct = ok ? ((r! - c!) / r!) * 100 : null;

  return (
    <ToolCard
      theme={theme}
      title="Gross margin"
      hint="(Revenue − cost of goods sold) ÷ revenue, as a percentage."
      icon={TrendingUp}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Revenue</label>
          <Input type="text" inputMode="decimal" placeholder="e.g. 500000" value={rev} onChange={(e) => setRev(e.target.value)} className="text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Cost of goods sold</label>
          <Input type="text" inputMode="decimal" placeholder="e.g. 310000" value={cogs} onChange={(e) => setCogs(e.target.value)} className="text-sm" />
        </div>
      </div>
      <ResultLine ok={pct !== null} theme={theme}>{pct !== null ? `${pct.toFixed(2)}%` : null}</ResultLine>
    </ToolCard>
  );
}

function NetMarginTool({ theme }: { theme: Theme }) {
  const [ni, setNi] = useState("");
  const [rev, setRev] = useState("");
  const n = parseAmount(ni);
  const r = parseAmount(rev);
  const ok = n !== null && r !== null && r > 0;
  const pct = ok ? (n! / r!) * 100 : null;

  return (
    <ToolCard
      theme={theme}
      title="Net profit margin"
      hint="Net income ÷ revenue, as a percentage."
      icon={Percent}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Net income</label>
          <Input type="text" inputMode="decimal" placeholder="e.g. 42000" value={ni} onChange={(e) => setNi(e.target.value)} className="text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Revenue</label>
          <Input type="text" inputMode="decimal" placeholder="e.g. 500000" value={rev} onChange={(e) => setRev(e.target.value)} className="text-sm" />
        </div>
      </div>
      <ResultLine ok={pct !== null} theme={theme}>{pct !== null ? `${pct.toFixed(2)}%` : null}</ResultLine>
    </ToolCard>
  );
}

function InterestCoverageTool({ theme }: { theme: Theme }) {
  const [ebit, setEbit] = useState("");
  const [interest, setInterest] = useState("");
  const e = parseAmount(ebit);
  const i = parseAmount(interest);
  const ok = e !== null && i !== null && i > 0;
  const times = ok ? e! / i! : null;

  return (
    <ToolCard
      theme={theme}
      title="Interest coverage"
      hint="EBIT ÷ interest expense. How many times operating earnings cover interest."
      icon={Calculator}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">EBIT</label>
          <Input type="text" inputMode="decimal" placeholder="e.g. 95000" value={ebit} onChange={(e) => setEbit(e.target.value)} className="text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Interest expense</label>
          <Input type="text" inputMode="decimal" placeholder="e.g. 12000" value={interest} onChange={(e) => setInterest(e.target.value)} className="text-sm" />
        </div>
      </div>
      <ResultLine ok={times !== null} theme={theme}>{times !== null ? `${times.toFixed(2)}×` : null}</ResultLine>
    </ToolCard>
  );
}

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 text-base font-semibold tracking-tight text-foreground">
      {children}
    </h2>
  );
}

export default function ToolsPage() {
  const [theme, setTheme] = useState<Theme>("light");
  const [showRating, setShowRating] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY) as Theme | null;
      if (saved === "dark" || saved === "light") {
        setTheme(saved);
        document.documentElement.classList.toggle("dark", saved === "dark");
      } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        setTheme("dark");
        document.documentElement.classList.add("dark");
      }
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const handleRatingComplete = () => {
    try {
      localStorage.setItem(RATING_KEY, "true");
    } catch {
      /* ignore */
    }
  };

  const pageTitle = `Tools · ${siteTitle}`;
  const pageUrl = `${getSiteOrigin()}/tools`;
  const ogImageUrl = `${getSiteOrigin()}/og.png`;
  const pageDescription = "Accounting calculators and quick ratio checks. Use alongside chat and study mode.";

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:url" content={pageUrl} />
        <meta name="twitter:title" content={pageTitle} />
        <meta property="og:description" content={defaultDescription} />
        <meta name="twitter:description" content={defaultDescription} />
        <meta property="og:image" content={ogImageUrl} />
        <meta name="twitter:image" content={ogImageUrl} />
      </Head>
      <div
        className={cn(
          "relative flex min-h-[100dvh] flex-col text-foreground transition-colors",
          theme === "dark"
            ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"
            : "bg-gradient-to-b from-background via-background to-sky-50/20"
        )}
      >
        {theme === "dark" ? (
          <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
            <div className="absolute -right-24 top-20 h-72 w-72 rounded-full bg-indigo-600/15 blur-3xl" />
            <div className="absolute -left-20 bottom-32 h-80 w-80 rounded-full bg-violet-600/12 blur-3xl" />
          </div>
        ) : (
          <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
            <div className="absolute right-1/4 top-24 h-64 w-64 rounded-full bg-indigo-200/35 blur-3xl" />
            <div className="absolute bottom-20 left-10 h-72 w-72 rounded-full bg-violet-200/25 blur-3xl" />
          </div>
        )}
        <AppChromeHeader
          theme={theme}
          onToggleTheme={toggleTheme}
          exportConversation={null}
          onExportMarkdown={() => {}}
          onExportPdf={() => {}}
          onOpenRating={() => setShowRating(true)}
        />
        <main className="relative z-10 mx-auto w-full max-w-4xl flex-1 px-3 py-5 sm:px-6 sm:py-8">
          <header className="mb-6">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Tools</h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Quick calculators and ratio helpers for homework or review. Numbers here are for practice—always match definitions and
              policies used in your course or firm.
            </p>
          </header>

          <nav
            aria-label="On this page"
            className="mb-6 flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
          >
              <span className="mr-1 hidden sm:inline">Jump to:</span>
              <button type="button" onClick={() => jump("section-calculator")} className="rounded-lg px-2 py-1 font-medium text-primary hover:bg-primary/10">
                Calculator
              </button>
              <ChevronRight className="h-3 w-3 opacity-40" aria-hidden />
              <button type="button" onClick={() => jump("section-liquidity")} className="rounded-lg px-2 py-1 font-medium text-primary hover:bg-primary/10">
                Ratios &amp; coverage
              </button>
              <ChevronRight className="h-3 w-3 opacity-40" aria-hidden />
              <button type="button" onClick={() => jump("section-margins")} className="rounded-lg px-2 py-1 font-medium text-primary hover:bg-primary/10">
                Margins
              </button>
          </nav>

          <details
            className={cn(
              "mb-8 rounded-2xl border text-sm open:shadow-sm",
              theme === "dark" ? "border-white/10 bg-black/20" : "border-border/60 bg-card/50"
            )}
          >
            <summary className="cursor-pointer list-none px-4 py-3 font-medium text-foreground [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                Add to home screen
                <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              </span>
            </summary>
            <div className="border-t border-border/50 px-4 pb-4 pt-3 text-xs leading-relaxed text-muted-foreground">
              <p className="mb-2">Opens in its own window without the browser chrome, like any other installed shortcut.</p>
              <ul className="list-inside list-disc space-y-1">
                <li>
                  <span className="font-medium text-foreground">Android (Chrome):</span> Menu → Install app, or Add to Home screen when
                  shown.
                </li>
                <li>
                  <span className="font-medium text-foreground">iPhone (Safari):</span> Share → Add to Home Screen.
                </li>
              </ul>
            </div>
          </details>

          <div className="space-y-10">
            <section className="space-y-4" aria-labelledby="calc-heading">
              <SectionTitle id="section-calculator">Full calculator</SectionTitle>
              <p id="calc-heading" className="text-xs text-muted-foreground">
                Expression evaluation, PV/FV, loan payment, depreciation, CAGR, break-even, and more—in one panel.
              </p>
              <CalculatorWidget theme={theme} variant="embedded" />
            </section>

            <section className="space-y-4" aria-labelledby="liq-heading">
              <SectionTitle id="section-liquidity">Ratios &amp; coverage</SectionTitle>
              <p id="liq-heading" className="text-xs text-muted-foreground">
                Liquidity, leverage, and interest coverage—compact formulas for drills. Interpretation depends on industry and policy choices.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <WorkingCapitalTool theme={theme} />
                <CurrentRatioTool theme={theme} />
                <QuickRatioTool theme={theme} />
                <DebtToEquityTool theme={theme} />
                <InterestCoverageTool theme={theme} />
              </div>
            </section>

            <section className="space-y-4" aria-labelledby="margin-heading">
              <SectionTitle id="section-margins">Margins</SectionTitle>
              <p id="margin-heading" className="text-xs text-muted-foreground">
                Income-statement percentages from a few inputs.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <GrossMarginTool theme={theme} />
                <NetMarginTool theme={theme} />
              </div>
            </section>
          </div>
        </main>
      </div>

      <RatingModal
        open={showRating}
        onOpenChange={(open) => {
          setShowRating(open);
          if (!open) {
            try {
              localStorage.setItem(RATING_DISMISSED_KEY, "true");
            } catch {
              /* ignore */
            }
          }
        }}
        onComplete={handleRatingComplete}
      />
    </>
  );
}
