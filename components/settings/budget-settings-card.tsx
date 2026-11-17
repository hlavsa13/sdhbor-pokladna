"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, PiggyBank } from "lucide-react";

const CURRENT_YEAR = new Date().getFullYear();

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(amount);

// Nastavení – plánovaný rozpočet kategorií na rok
export function BudgetSettingsCard() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const incomeCategories = useQuery(api.categories.list, { type: "income" });
  const expenseCategories = useQuery(api.categories.list, { type: "expense" });
  const budgets = useQuery(api.budgets.list, { year });
  const setBudget = useMutation(api.budgets.set);

  const amountFor = (category: string, type: "income" | "expense") =>
    budgets?.find((b) => b.category === category && b.type === type)?.amount ?? 0;

  const total = (type: "income" | "expense") =>
    (budgets ?? []).filter((b) => b.type === type).reduce((sum, b) => sum + b.amount, 0);

  const renderSection = (
    title: string,
    type: "income" | "expense",
    categories: { _id: string; name: string }[] | undefined
  ) => (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className={type === "income" ? "text-sm font-semibold text-income" : "text-sm font-semibold text-expense"}>
          {title}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">celkem {formatCurrency(total(type))} Kč</p>
      </div>
      {categories && categories.length > 0 ? (
        categories.map((c) => {
          const current = amountFor(c.name, type);
          return (
            <div key={c._id} className="flex items-center gap-2">
              <span className="flex-1 text-sm truncate">{c.name}</span>
              <div className="relative w-32">
                <Input
                  // Klíč s aktuální hodnotou – po uložení / změně roku se pole obnoví
                  key={`${year}-${type}-${c.name}-${current}`}
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="100"
                  placeholder="—"
                  defaultValue={current || ""}
                  className="h-8 pr-8 text-right tabular-nums"
                  onBlur={(e) => {
                    const value = Number(e.target.value) || 0;
                    if (value !== current) {
                      setBudget({ year, category: c.name, type, amount: value }).catch((err) =>
                        console.log("Uložení rozpočtu selhalo:", err)
                      );
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Kč</span>
              </div>
            </div>
          );
        })
      ) : (
        <p className="text-sm text-muted-foreground">Žádné kategorie</p>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-lg">
          <span className="flex items-center gap-2">
            <PiggyBank className="w-5 h-5" />
            Rozpočet
          </span>
          <span className="flex items-center gap-1 text-base font-semibold">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setYear((y) => y - 1)} aria-label="Předchozí rok">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {year}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setYear((y) => y + 1)}
              disabled={year >= CURRENT_YEAR + 1}
              aria-label="Další rok"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Plánovaná částka na rok u každé kategorie. Prázdné pole = bez plánu. Ukládá se automaticky po opuštění pole.
          Porovnání se skutečností je ve Výkazech.
        </p>
        {renderSection("Výdaje", "expense", expenseCategories)}
        {renderSection("Příjmy", "income", incomeCategories)}
      </CardContent>
    </Card>
  );
}
