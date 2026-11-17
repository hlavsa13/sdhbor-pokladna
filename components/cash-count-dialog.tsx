"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Banknote, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const DENOMINATIONS = [5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(amount);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Stav hotovosti podle aplikace */
  expected: number | undefined;
};

export function CashCountDialog({ open, onOpenChange, expected }: Props) {
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recordCashCount = useMutation(api.transactions.recordCashCount);
  const history = useQuery(api.transactions.listCashCounts);

  const counted = DENOMINATIONS.reduce((sum, d) => sum + d * (parseInt(counts[d] || "0") || 0), 0);
  const difference = expected !== undefined ? counted - expected : 0;
  const anyEntered = Object.values(counts).some((v) => v && v !== "0");

  const reset = () => {
    setCounts({});
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const denominations = Object.fromEntries(
        DENOMINATIONS.filter((d) => parseInt(counts[d] || "0") > 0).map((d) => [String(d), parseInt(counts[d])])
      );
      await recordCashCount({ counted, denominations });
      reset();
      onOpenChange(false);
    } catch (e) {
      console.log("Inventura selhala:", e);
      setError("Inventuru se nepodařilo uložit.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5" />
            Inventura pokladny
          </DialogTitle>
          <DialogDescription>Zadejte počet kusů bankovek a mincí v pokladně.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1.5 items-center tabular-nums">
          {DENOMINATIONS.map((d) => (
            <div key={d} className="contents">
              <span className="text-sm text-muted-foreground text-right">{formatCurrency(d)} ×</span>
              <Input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                className="h-8"
                placeholder="0"
                value={counts[d] ?? ""}
                onChange={(e) => setCounts((prev) => ({ ...prev, [d]: e.target.value }))}
              />
              <span className="text-sm text-right w-16">
                {formatCurrency(d * (parseInt(counts[d] || "0") || 0))}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t pt-3 grid grid-cols-[1fr_auto] gap-y-1 text-sm tabular-nums">
          <span>Napočítáno</span>
          <span className="font-semibold text-right">{formatCurrency(counted)}</span>
          <span className="text-muted-foreground">Podle aplikace</span>
          <span className="text-right">{expected !== undefined ? formatCurrency(expected) : "—"}</span>
          <span className={cn(difference === 0 ? "text-income" : "text-expense")}>Rozdíl</span>
          <span className={cn("font-semibold text-right", difference === 0 ? "text-income" : "text-expense")}>
            {difference > 0 ? "+" : ""}
            {formatCurrency(difference)}
          </span>
        </div>

        {error && <p className="text-sm text-destructive text-center">{error}</p>}

        <Button onClick={handleSave} disabled={saving || !anyEntered || expected === undefined}>
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "Uložit inventuru"
          )}
        </Button>
        {difference !== 0 && anyEntered && (
          <p className="text-xs text-muted-foreground -mt-2">
            Rozdíl se do transakcí nezapisuje – případně ho doúčtuj ručně jako {difference > 0 ? "příjem" : "výdaj"} v hotovosti.
          </p>
        )}

        {history && history.length > 0 && (
          <div className="border-t pt-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Předchozí inventury</p>
            {history.slice(0, 5).map((h) => (
              <div key={h._id} className="flex justify-between text-xs tabular-nums">
                <span>{new Date(h.countedAt).toLocaleDateString("cs-CZ")}</span>
                <span>{formatCurrency(h.counted)}</span>
                <span className={cn(h.difference === 0 ? "text-income" : "text-expense")}>
                  {h.difference === 0 ? "sedí" : `${h.difference > 0 ? "+" : ""}${formatCurrency(h.difference)}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
