"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { PiggyBank } from "lucide-react";
import { cn } from "@/lib/utils";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(amount);

// Výkazy – rozpočet vybraného roku: skutečnost proti plánu
export function BudgetReportCard({ year }: { year: number }) {
  const budgets = useQuery(api.budgets.list, { year });
  const incomeStats = useQuery(api.transactions.getCategoryStats, { type: "income", year });
  const expenseStats = useQuery(api.transactions.getCategoryStats, { type: "expense", year });

  if (budgets === undefined) return null;

  const actualFor = (category: string, type: "income" | "expense") =>
    (type === "income" ? incomeStats : expenseStats)?.find((c) => c.category === category)?.amount ?? 0;

  const renderSection = (title: string, type: "income" | "expense") => {
    const items = budgets
      .filter((b) => b.type === type)
      .map((b) => ({ ...b, actual: actualFor(b.category, type) }))
      .sort((a, b) => b.amount - a.amount);
    if (items.length === 0) return null;
    const planned = items.reduce((s, i) => s + i.amount, 0);
    const actual = items.reduce((s, i) => s + i.actual, 0);
    return (
      <div className="space-y-3">
        <div className="flex items-baseline justify-between text-sm">
          <span className={cn("font-semibold", type === "income" ? "text-income" : "text-expense")}>{title}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatCurrency(actual)} / {formatCurrency(planned)}
          </span>
        </div>
        {items.map((i) => {
          const percent = i.amount > 0 ? Math.round((i.actual / i.amount) * 100) : 0;
          // U výdajů je překročení plánu varování, u příjmů naopak úspěch
          const over = type === "expense" && percent > 100;
          return (
            <div key={i._id} className="space-y-1">
              <div className="flex items-center justify-between text-sm gap-2">
                <span className="font-medium truncate">
                  {i.category}{" "}
                  <span className="text-xs text-muted-foreground font-normal tabular-nums">
                    {formatCurrency(i.actual)} / {formatCurrency(i.amount)}
                  </span>
                </span>
                <span className={cn("text-xs tabular-nums", over ? "text-expense font-bold" : "text-muted-foreground")}>
                  {percent} %
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    type === "income" ? "bg-income" : "bg-expense",
                    over && "animate-pulse"
                  )}
                  style={{ width: `${Math.min(percent, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card>
      <CardContent className="pt-4 space-y-5">
        <p className="text-sm font-semibold flex items-center gap-2">
          <PiggyBank className="w-4 h-4" />
          Rozpočet {year}
        </p>
        {budgets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Pro rok {year} není nastavený rozpočet. Hospodář ho může zadat v Nastavení → Rozpočet.
          </p>
        ) : (
          <>
            {renderSection("Výdaje", "expense")}
            {renderSection("Příjmy", "income")}
          </>
        )}
      </CardContent>
    </Card>
  );
}
