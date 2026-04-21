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
  Droplets,
  Landmark,
  Layers,
  LayoutGrid,
  LineChart,
  Percent,
  PieChart,
  Receipt,
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

function OperatingMarginTool({ theme }: { theme: Theme }) {
  const [opInc, setOpInc] = useState("");
  const [rev, setRev] = useState("");
  const o = parseAmount(opInc);
  const r = parseAmount(rev);
  const ok = o !== null && r !== null && r !== 0;
  const pct = ok ? (o! / r!) * 100 : null;

  return (
    <ToolCard
      theme={theme}
      title="Operating margin"
      hint="Operating income ÷ revenue. Shows core operations before interest and tax."
      icon={TrendingUp}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Operating income</label>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="e.g. 72000"
            value={opInc}
            onChange={(e) => setOpInc(e.target.value)}
            className="text-sm"
          />
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

function ContributionMarginRatioTool({ theme }: { theme: Theme }) {
  const [rev, setRev] = useState("");
  const [vc, setVc] = useState("");
  const r = parseAmount(rev);
  const v = parseAmount(vc);
  const ok = r !== null && v !== null && r > 0 && v >= 0 && v <= r;
  const pct = ok ? ((r! - v!) / r!) * 100 : null;

  return (
    <ToolCard
      theme={theme}
      title="Contribution margin ratio"
      hint="(Revenue − variable costs) ÷ revenue. Used in CVP; fixed costs are ignored here."
      icon={PieChart}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Revenue</label>
          <Input type="text" inputMode="decimal" placeholder="e.g. 400000" value={rev} onChange={(e) => setRev(e.target.value)} className="text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Total variable costs</label>
          <Input type="text" inputMode="decimal" placeholder="e.g. 250000" value={vc} onChange={(e) => setVc(e.target.value)} className="text-sm" />
        </div>
      </div>
      <ResultLine ok={pct !== null} theme={theme}>{pct !== null ? `${pct.toFixed(2)}%` : null}</ResultLine>
    </ToolCard>
  );
}

function ROATool({ theme }: { theme: Theme }) {
  const [ni, setNi] = useState("");
  const [assets, setAssets] = useState("");
  const n = parseAmount(ni);
  const a = parseAmount(assets);
  const ok = n !== null && a !== null && a > 0;
  const pct = ok ? (n! / a!) * 100 : null;

  return (
    <ToolCard
      theme={theme}
      title="Return on assets (ROA)"
      hint="Net income ÷ total assets. How efficiently assets generate profit (one-period snapshot)."
      icon={LineChart}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Net income</label>
          <Input type="text" inputMode="decimal" placeholder="e.g. 42000" value={ni} onChange={(e) => setNi(e.target.value)} className="text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Total assets</label>
          <Input type="text" inputMode="decimal" placeholder="e.g. 620000" value={assets} onChange={(e) => setAssets(e.target.value)} className="text-sm" />
        </div>
      </div>
      <ResultLine ok={pct !== null} theme={theme}>{pct !== null ? `${pct.toFixed(2)}%` : null}</ResultLine>
    </ToolCard>
  );
}

function ROETool({ theme }: { theme: Theme }) {
  const [ni, setNi] = useState("");
  const [eq, setEq] = useState("");
  const n = parseAmount(ni);
  const e = parseAmount(eq);
  const ok = n !== null && e !== null && e > 0;
  const pct = ok ? (n! / e!) * 100 : null;

  return (
    <ToolCard
      theme={theme}
      title="Return on equity (ROE)"
      hint="Net income ÷ total equity. Return to owners’ stake; leverage and definitions affect comparability."
      icon={LineChart}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Net income</label>
          <Input type="text" inputMode="decimal" placeholder="e.g. 42000" value={ni} onChange={(e) => setNi(e.target.value)} className="text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Total equity</label>
          <Input type="text" inputMode="decimal" placeholder="e.g. 280000" value={eq} onChange={(e) => setEq(e.target.value)} className="text-sm" />
        </div>
      </div>
      <ResultLine ok={pct !== null} theme={theme}>{pct !== null ? `${pct.toFixed(2)}%` : null}</ResultLine>
    </ToolCard>
  );
}

function AssetTurnoverTool({ theme }: { theme: Theme }) {
  const [rev, setRev] = useState("");
  const [assets, setAssets] = useState("");
  const r = parseAmount(rev);
  const a = parseAmount(assets);
  const ok = r !== null && a !== null && a > 0;
  const turns = ok ? r! / a! : null;

  return (
    <ToolCard
      theme={theme}
      title="Asset turnover"
      hint="Revenue ÷ average total assets. Here: revenue ÷ ending assets (simplified one-period)."
      icon={TrendingUp}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Revenue</label>
          <Input type="text" inputMode="decimal" placeholder="e.g. 900000" value={rev} onChange={(e) => setRev(e.target.value)} className="text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Total assets</label>
          <Input type="text" inputMode="decimal" placeholder="e.g. 600000" value={assets} onChange={(e) => setAssets(e.target.value)} className="text-sm" />
        </div>
      </div>
      <ResultLine ok={turns !== null} theme={theme}>{turns !== null ? `${turns.toFixed(2)}×` : null}</ResultLine>
    </ToolCard>
  );
}

function InventoryTurnoverTool({ theme }: { theme: Theme }) {
  const [cogs, setCogs] = useState("");
  const [inv, setInv] = useState("");
  const c = parseAmount(cogs);
  const i = parseAmount(inv);
  const ok = c !== null && i !== null && i > 0 && c >= 0;
  const turns = ok ? c! / i! : null;

  return (
    <ToolCard
      theme={theme}
      title="Inventory turnover"
      hint="COGS ÷ average inventory. Here: COGS ÷ ending inventory (simplified)."
      icon={Layers}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Cost of goods sold</label>
          <Input type="text" inputMode="decimal" placeholder="e.g. 310000" value={cogs} onChange={(e) => setCogs(e.target.value)} className="text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Inventory</label>
          <Input type="text" inputMode="decimal" placeholder="e.g. 45000" value={inv} onChange={(e) => setInv(e.target.value)} className="text-sm" />
        </div>
      </div>
      <ResultLine ok={turns !== null} theme={theme}>{turns !== null ? `${turns.toFixed(2)}×` : null}</ResultLine>
    </ToolCard>
  );
}

function DaysSalesOutstandingTool({ theme }: { theme: Theme }) {
  const [ar, setAr] = useState("");
  const [rev, setRev] = useState("");
  const a = parseAmount(ar);
  const r = parseAmount(rev);
  const ok = a !== null && r !== null && r > 0 && a >= 0;
  const days = ok ? (a! / r!) * 365 : null;

  return (
    <ToolCard
      theme={theme}
      title="Days sales outstanding (DSO)"
      hint="(Accounts receivable ÷ revenue) × 365. Rough days of sales tied up in AR; uses revenue as proxy for credit sales."
      icon={Wallet}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Accounts receivable</label>
          <Input type="text" inputMode="decimal" placeholder="e.g. 82000" value={ar} onChange={(e) => setAr(e.target.value)} className="text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Revenue (annual)</label>
          <Input type="text" inputMode="decimal" placeholder="e.g. 600000" value={rev} onChange={(e) => setRev(e.target.value)} className="text-sm" />
        </div>
      </div>
      <ResultLine ok={days !== null} theme={theme}>{days !== null ? `${days.toFixed(1)} days` : null}</ResultLine>
    </ToolCard>
  );
}

function ReceivablesTurnoverTool({ theme }: { theme: Theme }) {
  const [rev, setRev] = useState("");
  const [ar, setAr] = useState("");
  const r = parseAmount(rev);
  const a = parseAmount(ar);
  const ok = r !== null && a !== null && a > 0;
  const turns = ok ? r! / a! : null;

  return (
    <ToolCard
      theme={theme}
      title="Receivables turnover"
      hint="Revenue ÷ accounts receivable. Higher usually means faster collection (definitions vary)."
      icon={Receipt}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Revenue</label>
          <Input type="text" inputMode="decimal" placeholder="e.g. 600000" value={rev} onChange={(e) => setRev(e.target.value)} className="text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Accounts receivable</label>
          <Input type="text" inputMode="decimal" placeholder="e.g. 82000" value={ar} onChange={(e) => setAr(e.target.value)} className="text-sm" />
        </div>
      </div>
      <ResultLine ok={turns !== null} theme={theme}>{turns !== null ? `${turns.toFixed(2)}×` : null}</ResultLine>
    </ToolCard>
  );
}

function ToolsPageSection({
  id,
  theme,
  title,
  description,
  icon: Icon,
  children,
}: {
  id: string;
  theme: Theme;
  title: string;
  description: string;
  icon: typeof Calculator;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4 sm:scroll-mt-28" aria-labelledby={`${id}-heading`}>
      <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-start sm:gap-4 dark:border-white/10">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-sm",
            theme === "dark"
              ? "border-white/10 bg-white/[0.06] text-emerald-200"
              : "border-emerald-200/80 bg-emerald-50 text-emerald-800"
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h2 id={`${id}-heading`} className="text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
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
  const pageDescription =
    "Accounting calculators, financial ratios, and quick checks for homework or review. Pair with Chat for explanations and Study for practice.";

  const jumpTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const tocSections = [
    { id: "section-calculator", label: "Full calculator", Icon: Calculator },
    { id: "section-liquidity", label: "Liquidity", Icon: Droplets },
    { id: "section-leverage", label: "Leverage & coverage", Icon: Landmark },
    { id: "section-margins", label: "Margins & contribution", Icon: PieChart },
    { id: "section-returns", label: "Returns & activity", Icon: LineChart },
  ] as const;

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
        <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-3 py-5 sm:px-6 sm:py-8">
          <header className="mb-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Tools</h1>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  One place for quick financial math: multi-purpose calculator, liquidity and leverage ratios, margins, and
                  return/activity metrics. Use the same currency for every field in a worksheet.
                </p>
              </div>
            </div>
          </header>

          <div
            className={cn(
              "mb-6 rounded-2xl border p-4 sm:p-5",
              theme === "dark" ? "border-emerald-500/15 bg-emerald-950/20" : "border-emerald-200/60 bg-emerald-50/40"
            )}
          >
            <div className="flex items-start gap-3">
              <LayoutGrid className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden />
              <div className="min-w-0 space-y-2 text-sm leading-relaxed text-muted-foreground">
                <p className="font-medium text-foreground">How to use this page</p>
                <ul className="list-inside list-disc space-y-1 text-xs sm:text-sm">
                  <li>Pick a section below or use <span className="font-medium text-foreground">Jump to</span> for long pages.</li>
                  <li>Outputs are educational—always follow your course or firm definitions (average vs. ending balances, etc.).</li>
                  <li>
                    Need a walkthrough? Open <span className="font-medium text-foreground">Chat</span> from the header or practice in{" "}
                    <span className="font-medium text-foreground">Study</span>.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <nav
            aria-label="Jump to section"
            className={cn(
              "mb-8 rounded-2xl border p-4 shadow-sm",
              theme === "dark" ? "border-white/10 bg-card/60" : "border-border/70 bg-card/80"
            )}
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Jump to</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {tocSections.map(({ id, label, Icon }) => (
                <Button
                  key={id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-auto justify-start gap-2 rounded-xl border py-2.5 text-left font-medium",
                    theme === "dark" ? "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]" : "hover:bg-muted/80"
                  )}
                  onClick={() => jumpTo(id)}
                >
                  <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span>{label}</span>
                </Button>
              ))}
            </div>
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

          <div className="space-y-12 sm:space-y-14">
            <ToolsPageSection
              id="section-calculator"
              theme={theme}
              title="Full calculator"
              description="Expressions, present and future value, loan payments, depreciation, CAGR, break-even, and more—in one embedded panel."
              icon={Calculator}
            >
              <CalculatorWidget theme={theme} variant="embedded" />
            </ToolsPageSection>

            <ToolsPageSection
              id="section-liquidity"
              theme={theme}
              title="Liquidity & working capital"
              description="Short-term cushion and ability to cover near-term obligations. Pair with leverage ratios for a fuller picture."
              icon={Droplets}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <WorkingCapitalTool theme={theme} />
                <CurrentRatioTool theme={theme} />
                <QuickRatioTool theme={theme} />
              </div>
            </ToolsPageSection>

            <ToolsPageSection
              id="section-leverage"
              theme={theme}
              title="Leverage & coverage"
              description="Capital structure and ability to service interest. Numerators and denominators should match your problem set definitions."
              icon={Landmark}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <DebtToEquityTool theme={theme} />
                <InterestCoverageTool theme={theme} />
              </div>
            </ToolsPageSection>

            <ToolsPageSection
              id="section-margins"
              theme={theme}
              title="Margins & contribution"
              description="Income-statement profitability and contribution margin for quick CVP-style checks."
              icon={PieChart}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <GrossMarginTool theme={theme} />
                <OperatingMarginTool theme={theme} />
                <ContributionMarginRatioTool theme={theme} />
                <NetMarginTool theme={theme} />
              </div>
            </ToolsPageSection>

            <ToolsPageSection
              id="section-returns"
              theme={theme}
              title="Returns & activity"
              description="How profit and sales relate to the balance sheet, plus turnover and collection speed. Simplified one-period formulas where noted."
              icon={LineChart}
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <ROATool theme={theme} />
                <ROETool theme={theme} />
                <AssetTurnoverTool theme={theme} />
                <InventoryTurnoverTool theme={theme} />
                <ReceivablesTurnoverTool theme={theme} />
                <DaysSalesOutstandingTool theme={theme} />
              </div>
            </ToolsPageSection>
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
