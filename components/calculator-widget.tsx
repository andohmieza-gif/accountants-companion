import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calculator, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type CalculatorMode = "basic" | "pv" | "fv" | "depreciation" | "percentage";

interface CalculatorWidgetProps {
  theme: "light" | "dark";
}

export function CalculatorWidget({ theme }: CalculatorWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
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

  const clearResult = () => setResult(null);

  const modes: { id: CalculatorMode; label: string }[] = [
    { id: "basic", label: "Basic" },
    { id: "pv", label: "Present Value" },
    { id: "fv", label: "Future Value" },
    { id: "depreciation", label: "Depreciation" },
    { id: "percentage", label: "Percentage" },
  ];

  return (
    <>
      {/* Floating button */}
      <motion.button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-24 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-colors",
          theme === "dark"
            ? "bg-foreground text-background hover:bg-foreground/90"
            : "bg-foreground text-background hover:bg-foreground/90"
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title="Calculator"
      >
        <Calculator className="h-5 w-5" />
      </motion.button>

      {/* Calculator panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className={cn(
                "fixed bottom-20 right-4 z-50 w-80 overflow-hidden rounded-2xl border shadow-2xl",
                theme === "dark" ? "border-border/60 bg-card" : "border-border/40 bg-white"
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-foreground" />
                  <span className="font-medium">Quick Calculator</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
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

                {/* Result */}
                <AnimatePresence>
                  {result && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mt-4 rounded-lg bg-muted p-3 text-center"
                    >
                      <p className="font-mono text-lg font-semibold text-foreground">{result}</p>
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
