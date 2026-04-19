import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calculator, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type CalculatorMode =
  | "basic"
  | "pv"
  | "fv"
  | "depreciation"
  | "percentage"
  | "loan"
  | "markup"
  | "breakeven"
  | "cagr"
  | "ear";

interface CalculatorWidgetProps {
  theme: "light" | "dark";
  /** Inline full-width panel for Tools hub (no floating button or modal backdrop). */
  variant?: "floating" | "embedded";
}

export function CalculatorWidget({ theme, variant = "floating" }: CalculatorWidgetProps) {
  const isEmbedded = variant === "embedded";
  const [isOpen, setIsOpen] = useState(isEmbedded);
  const [mode, setMode] = useState<CalculatorMode>("basic");
  const [result, setResult] = useState<string | null>(null);

  // Basic calculator
  const [basicExpr, setBasicExpr] = useState("");

  // PV/FV calculator
  const [fvAmount, setFvAmount] = useState("");
  const [pvAmount, setPvAmount] = useState("");
  const [rate, setRate] = useState("");
  const [periods, setPeriods] = useState("");

  // Depreciation calculator
  const [assetCost, setAssetCost] = useState("");
  const [salvageValue, setSalvageValue] = useState("");
  const [usefulLife, setUsefulLife] = useState("");

  // Percentage calculator
  const [percentValue, setPercentValue] = useState("");
  const [percentOf, setPercentOf] = useState("");

  // Loan payment (ordinary annuity, monthly compounding)
  const [loanPrincipal, setLoanPrincipal] = useState("");
  const [loanAnnualRate, setLoanAnnualRate] = useState("");
  const [loanMonths, setLoanMonths] = useState("");

  // Markup vs margin (from cost & selling price)
  const [markupCost, setMarkupCost] = useState("");
  const [markupPrice, setMarkupPrice] = useState("");

  // Break-even (units)
  const [beFixed, setBeFixed] = useState("");
  const [beVar, setBeVar] = useState("");
  const [bePrice, setBePrice] = useState("");

  // CAGR (geometric mean return)
  const [cagrBegin, setCagrBegin] = useState("");
  const [cagrEnd, setCagrEnd] = useState("");
  const [cagrYears, setCagrYears] = useState("");

  // Effective annual rate from nominal APR and compounding frequency
  const [earNominal, setEarNominal] = useState("");
  const [earPeriods, setEarPeriods] = useState("");

  const calculateBasic = useCallback(() => {
    try {
      const sanitized = basicExpr.replace(/[^0-9+\-*/.() ]/g, "");
      const evalResult = Function(`"use strict"; return (${sanitized})`)();
      setResult(typeof evalResult === "number" ? evalResult.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "Error");
    } catch {
      setResult("Error");
    }
  }, [basicExpr]);

  const calculatePV = useCallback(() => {
    const fv = parseFloat(fvAmount);
    const r = parseFloat(rate) / 100;
    const n = parseFloat(periods);
    if (isNaN(fv) || isNaN(r) || isNaN(n)) {
      setResult("Enter all values");
      return;
    }
    const pv = fv / Math.pow(1 + r, n);
    setResult(`PV = $${pv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  }, [fvAmount, rate, periods]);

  const calculateFV = useCallback(() => {
    const pv = parseFloat(pvAmount);
    const r = parseFloat(rate) / 100;
    const n = parseFloat(periods);
    if (isNaN(pv) || isNaN(r) || isNaN(n)) {
      setResult("Enter all values");
      return;
    }
    const fv = pv * Math.pow(1 + r, n);
    setResult(`FV = $${fv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  }, [pvAmount, rate, periods]);

  const calculateDepreciation = useCallback(() => {
    const cost = parseFloat(assetCost);
    const salvage = parseFloat(salvageValue);
    const life = parseFloat(usefulLife);
    if (isNaN(cost) || isNaN(salvage) || isNaN(life) || life <= 0) {
      setResult("Enter all values");
      return;
    }
    const annual = (cost - salvage) / life;
    setResult(`Annual: $${annual.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/yr`);
  }, [assetCost, salvageValue, usefulLife]);

  const calculatePercentage = useCallback(() => {
    const percent = parseFloat(percentValue);
    const base = parseFloat(percentOf);
    if (isNaN(percent) || isNaN(base)) {
      setResult("Enter all values");
      return;
    }
    const value = (percent / 100) * base;
    setResult(`= ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  }, [percentValue, percentOf]);

  const calculateLoan = useCallback(() => {
    const P = parseFloat(loanPrincipal);
    const annualPct = parseFloat(loanAnnualRate);
    const n = parseFloat(loanMonths);
    if (isNaN(P) || isNaN(annualPct) || isNaN(n) || P <= 0 || n <= 0) {
      setResult("Enter principal, rate, and term");
      return;
    }
    const i = annualPct / 100 / 12;
    let payment: number;
    if (i === 0) {
      payment = P / n;
    } else {
      const factor = Math.pow(1 + i, n);
      payment = (P * i * factor) / (factor - 1);
    }
    const totalPaid = payment * n;
    const interest = totalPaid - P;
    setResult(
      `Payment $${payment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo · Total interest $${interest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    );
  }, [loanPrincipal, loanAnnualRate, loanMonths]);

  const calculateMarkup = useCallback(() => {
    const cost = parseFloat(markupCost);
    const price = parseFloat(markupPrice);
    if (isNaN(cost) || isNaN(price) || cost <= 0 || price <= 0) {
      setResult("Enter positive cost and price");
      return;
    }
    const profit = price - cost;
    const markupOnCost = (profit / cost) * 100;
    const marginOnPrice = (profit / price) * 100;
    setResult(
      `Markup ${markupOnCost.toFixed(2)}% on cost · Margin ${marginOnPrice.toFixed(2)}% on price · Profit $${profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    );
  }, [markupCost, markupPrice]);

  const calculateBreakeven = useCallback(() => {
    const fixed = parseFloat(beFixed);
    const varPer = parseFloat(beVar);
    const price = parseFloat(bePrice);
    if (isNaN(fixed) || isNaN(varPer) || isNaN(price)) {
      setResult("Enter all values");
      return;
    }
    const cm = price - varPer;
    if (cm <= 0) {
      setResult("Price must be above variable cost per unit");
      return;
    }
    const units = fixed / cm;
    const revenue = units * price;
    setResult(
      `B/E ${units.toLocaleString(undefined, { maximumFractionDigits: 2 })} units · Revenue $${revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    );
  }, [beFixed, beVar, bePrice]);

  const calculateCAGR = useCallback(() => {
    const begin = parseFloat(cagrBegin);
    const end = parseFloat(cagrEnd);
    const years = parseFloat(cagrYears);
    if (isNaN(begin) || isNaN(end) || isNaN(years) || begin <= 0 || end <= 0 || years <= 0) {
      setResult("Enter positive beginning, ending, and years");
      return;
    }
    const cagr = (Math.pow(end / begin, 1 / years) - 1) * 100;
    setResult(`CAGR ${cagr.toFixed(4)}% (${years} yr)`);
  }, [cagrBegin, cagrEnd, cagrYears]);

  const calculateEAR = useCallback(() => {
    const nominal = parseFloat(earNominal);
    const m = parseFloat(earPeriods);
    if (isNaN(nominal) || isNaN(m) || m < 1) {
      setResult("Enter nominal APR and periods/year (e.g. 12)");
      return;
    }
    const periods = Math.round(m);
    const r = nominal / 100 / periods;
    const ear = (Math.pow(1 + r, periods) - 1) * 100;
    setResult(
      `EAR ${ear.toFixed(4)}% (${periods}x/yr on ${nominal}% nominal)`
    );
  }, [earNominal, earPeriods]);

  const clearResult = () => setResult(null);

  const modes: { id: CalculatorMode; label: string }[] = [
    { id: "basic", label: "Basic" },
    { id: "pv", label: "Present Value" },
    { id: "fv", label: "Future Value" },
    { id: "loan", label: "Loan payment" },
    { id: "cagr", label: "CAGR" },
    { id: "ear", label: "EAR" },
    { id: "depreciation", label: "Depreciation" },
    { id: "percentage", label: "Percentage" },
    { id: "markup", label: "Markup & margin" },
    { id: "breakeven", label: "Break-even" },
  ];

  return (
    <>
      {!isEmbedded ? (
        <motion.button
          type="button"
          onClick={() => setIsOpen(true)}
          className={cn(
            "fixed bottom-32 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-colors max-[480px]:bottom-24",
            theme === "dark"
              ? "bg-foreground text-background hover:bg-foreground/90"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Calculator"
        >
          <Calculator className="h-5 w-5" />
        </motion.button>
      ) : null}

      <AnimatePresence>
        {(isOpen || isEmbedded) && (
          <>
            {!isEmbedded ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 cursor-pointer bg-black/20 backdrop-blur-sm"
                onClick={() => setIsOpen(false)}
              />
            ) : null}
            <motion.div
              initial={isEmbedded ? false : { opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={isEmbedded ? undefined : { opacity: 0, y: 20, scale: 0.95 }}
              transition={isEmbedded ? undefined : { type: "spring", stiffness: 500, damping: 30 }}
              className={cn(
                "overflow-hidden rounded-2xl border shadow-2xl",
                isEmbedded
                  ? "relative z-10 w-full max-w-2xl shadow-lg"
                  : "fixed bottom-32 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] max-[480px]:bottom-24",
                theme === "dark" ? "border-border/60 bg-card" : "border-border/60 bg-card"
              )}
            >
              <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-foreground" />
                  <span className="font-medium">{isEmbedded ? "Calculator" : "Quick Calculator"}</span>
                </div>
                {!isEmbedded ? (
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Tools hub
                  </span>
                )}
              </div>

              {/* Mode selector */}
              <div className="border-b border-border/40 p-2">
                <div className="flex flex-wrap gap-1">
                  {modes.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setMode(m.id);
                        clearResult();
                      }}
                      className={cn(
                        "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                        mode === m.id
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Calculator body */}
              <div className="p-4">
                {mode === "basic" && (
                  <div className="space-y-3">
                    <Input
                      type="text"
                      placeholder="e.g., 1000 * 0.08 / 12"
                      value={basicExpr}
                      onChange={(e) => setBasicExpr(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && calculateBasic()}
                      className="font-mono text-sm"
                    />
                    <Button onClick={calculateBasic} className="w-full" size="sm">
                      Calculate
                    </Button>
                  </div>
                )}

                {mode === "pv" && (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Future Value ($)</label>
                      <Input
                        type="number"
                        placeholder="10000"
                        value={fvAmount}
                        onChange={(e) => setFvAmount(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Rate (%)</label>
                        <Input
                          type="number"
                          placeholder="5"
                          value={rate}
                          onChange={(e) => setRate(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Periods</label>
                        <Input
                          type="number"
                          placeholder="10"
                          value={periods}
                          onChange={(e) => setPeriods(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </div>
                    <Button onClick={calculatePV} className="w-full" size="sm">
                      Calculate PV
                    </Button>
                  </div>
                )}

                {mode === "fv" && (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Present Value ($)</label>
                      <Input
                        type="number"
                        placeholder="5000"
                        value={pvAmount}
                        onChange={(e) => setPvAmount(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Rate (%)</label>
                        <Input
                          type="number"
                          placeholder="5"
                          value={rate}
                          onChange={(e) => setRate(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Periods</label>
                        <Input
                          type="number"
                          placeholder="10"
                          value={periods}
                          onChange={(e) => setPeriods(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </div>
                    <Button onClick={calculateFV} className="w-full" size="sm">
                      Calculate FV
                    </Button>
                  </div>
                )}

                {mode === "depreciation" && (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Asset Cost ($)</label>
                      <Input
                        type="number"
                        placeholder="50000"
                        value={assetCost}
                        onChange={(e) => setAssetCost(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Salvage ($)</label>
                        <Input
                          type="number"
                          placeholder="5000"
                          value={salvageValue}
                          onChange={(e) => setSalvageValue(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Life (years)</label>
                        <Input
                          type="number"
                          placeholder="5"
                          value={usefulLife}
                          onChange={(e) => setUsefulLife(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </div>
                    <Button onClick={calculateDepreciation} className="w-full" size="sm">
                      Calculate (Straight-Line)
                    </Button>
                  </div>
                )}

                {mode === "percentage" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="15"
                        value={percentValue}
                        onChange={(e) => setPercentValue(e.target.value)}
                        className="text-sm"
                      />
                      <span className="shrink-0 text-sm text-muted-foreground">% of</span>
                      <Input
                        type="number"
                        placeholder="200"
                        value={percentOf}
                        onChange={(e) => setPercentOf(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <Button onClick={calculatePercentage} className="w-full" size="sm">
                      Calculate
                    </Button>
                  </div>
                )}

                {mode === "loan" && (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Principal ($)</label>
                      <Input
                        type="number"
                        placeholder="250000"
                        value={loanPrincipal}
                        onChange={(e) => setLoanPrincipal(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">APR (%)</label>
                        <Input
                          type="number"
                          placeholder="6.5"
                          value={loanAnnualRate}
                          onChange={(e) => setLoanAnnualRate(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Term (months)</label>
                        <Input
                          type="number"
                          placeholder="360"
                          value={loanMonths}
                          onChange={(e) => setLoanMonths(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] leading-snug text-muted-foreground">
                      Level monthly payment; standard amortizing loan (end-of-period).
                    </p>
                    <Button onClick={calculateLoan} className="w-full" size="sm">
                      Calculate payment
                    </Button>
                  </div>
                )}

                {mode === "markup" && (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Cost ($)</label>
                      <Input
                        type="number"
                        placeholder="40"
                        value={markupCost}
                        onChange={(e) => setMarkupCost(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Selling price ($)</label>
                      <Input
                        type="number"
                        placeholder="65"
                        value={markupPrice}
                        onChange={(e) => setMarkupPrice(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <p className="text-[10px] leading-snug text-muted-foreground">
                      Markup % is on cost; margin % is profit as a share of selling price.
                    </p>
                    <Button onClick={calculateMarkup} className="w-full" size="sm">
                      Calculate
                    </Button>
                  </div>
                )}

                {mode === "breakeven" && (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Fixed costs ($)</label>
                      <Input
                        type="number"
                        placeholder="120000"
                        value={beFixed}
                        onChange={(e) => setBeFixed(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Variable $ / unit</label>
                        <Input
                          type="number"
                          placeholder="18"
                          value={beVar}
                          onChange={(e) => setBeVar(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Price $ / unit</label>
                        <Input
                          type="number"
                          placeholder="45"
                          value={bePrice}
                          onChange={(e) => setBePrice(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] leading-snug text-muted-foreground">
                      Single-product break-even: fixed ÷ (price − variable cost per unit).
                    </p>
                    <Button onClick={calculateBreakeven} className="w-full" size="sm">
                      Calculate break-even
                    </Button>
                  </div>
                )}

                {mode === "cagr" && (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Beginning value ($)</label>
                      <Input
                        type="number"
                        placeholder="10000"
                        value={cagrBegin}
                        onChange={(e) => setCagrBegin(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Ending value ($)</label>
                      <Input
                        type="number"
                        placeholder="18500"
                        value={cagrEnd}
                        onChange={(e) => setCagrEnd(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Years</label>
                      <Input
                        type="number"
                        placeholder="5"
                        value={cagrYears}
                        onChange={(e) => setCagrYears(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <p className="text-[10px] leading-snug text-muted-foreground">
                      Compound annual growth: constant rate that maps beginning to ending over the horizon.
                    </p>
                    <Button onClick={calculateCAGR} className="w-full" size="sm">
                      Calculate CAGR
                    </Button>
                  </div>
                )}

                {mode === "ear" && (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Nominal APR (%)</label>
                      <Input
                        type="number"
                        placeholder="6"
                        value={earNominal}
                        onChange={(e) => setEarNominal(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Compounding periods / year</label>
                      <Input
                        type="number"
                        placeholder="12 (monthly)"
                        value={earPeriods}
                        onChange={(e) => setEarPeriods(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <p className="text-[10px] leading-snug text-muted-foreground">
                      Stated rate with m compounding periods vs once-per-year equivalent (EAR).
                    </p>
                    <Button onClick={calculateEAR} className="w-full" size="sm">
                      Calculate EAR
                    </Button>
                  </div>
                )}

                {/* Result */}
                <AnimatePresence>
                  {result && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mt-4 rounded-lg bg-muted p-3 text-center"
                    >
                      <p className="break-words font-mono text-sm font-semibold leading-snug text-foreground md:text-base">
                        {result}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
