"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Banknote, Building2, ChevronLeft, ChevronRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ValnaHromadaPdfButton } from "@/components/valnahromada-pdf-button";
import { ExcelDownloadButton } from "@/components/excel-download-button";

import { cn } from "@/lib/utils";

const CURRENT_YEAR = new Date().getFullYear();

export function ReportsView() {
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [catYear, setCatYear] = useState(CURRENT_YEAR);

  const stats = useQuery(api.transactions.getStats);
  const yearStats = useQuery(api.transactions.getStatsByYear, { year: selectedYear });
  const jan1Balance = useQuery(api.transactions.getBalanceBeforeYear, { year: selectedYear });
  const incomeCategories = useQuery(api.transactions.getCategoryStats, { type: "income", year: catYear });
  const expenseCategories = useQuery(api.transactions.getCategoryStats, { type: "expense", year: catYear });
  const categoryBalance = useQuery(api.transactions.getCategoryBalanceStats, { year: catYear });
  const yearlyStats = useQuery(api.transactions.getYearlyStats);

  // Dostupné roky z dat
  const availableYears = yearlyStats ? yearlyStats.map((y) => Number(y.year)) : [];
  const minYear = availableYears.length > 0 ? Math.min(...availableYears) : CURRENT_YEAR;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("cs-CZ", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const maxIncomeCategory = incomeCategories && incomeCategories.length > 0
    ? Math.max(...incomeCategories.map((c) => c.amount))
    : 0;

  const maxExpenseCategory = expenseCategories && expenseCategories.length > 0
    ? Math.max(...expenseCategories.map((c) => c.amount))
    : 0;


  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">Přehledy</h1>
          <p className="text-sm text-muted-foreground">Statistiky hospodaření</p>
        </div>
        <div className="flex items-center gap-2">
          <ExcelDownloadButton />
          <ValnaHromadaPdfButton />
        </div>
      </div>

      {/* Aktuální stav */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="pt-4 text-center">
          <p className="text-sm text-muted-foreground mb-1">Aktuální stav</p>
          <p className={cn(
            "text-4xl font-bold",
            stats && stats.balance >= 0 ? "text-income" : "text-expense"
          )}>
            {stats ? formatCurrency(stats.balance) : "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Kč</p>
        </CardContent>
      </Card>

      {/* Hotovost a banka */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Banknote className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Hotovost</p>
            </div>
            <p className={cn(
              "text-2xl font-bold",
              stats && stats.cashBalance >= 0 ? "text-income" : "text-expense"
            )}>
              {stats ? formatCurrency(stats.cashBalance) : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Kč</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Banka</p>
            </div>
            <p className={cn(
              "text-2xl font-bold",
              stats && stats.bankBalance >= 0 ? "text-income" : "text-expense"
            )}>
              {stats ? formatCurrency(stats.bankBalance) : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Kč</p>
          </CardContent>
        </Card>
      </div>

      {/* Rok — s filtrem */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          {/* Selektor roku */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Rok {selectedYear}</p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setSelectedYear((y) => y - 1)}
                disabled={availableYears.length > 0 && selectedYear <= Math.min(...availableYears)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setSelectedYear((y) => y + 1)}
                disabled={selectedYear >= CURRENT_YEAR}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {yearStats ? (
            <>
              {/* Celkem */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Příjmy</p>
                  <p className="text-base font-bold text-income">{formatCurrency(yearStats.income)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Výdaje</p>
                  <p className="text-base font-bold text-expense">{formatCurrency(yearStats.expense)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Stav</p>
                  <p className={cn(
                    "text-base font-bold",
                    yearStats.income - yearStats.expense >= 0 ? "text-income" : "text-expense"
                  )}>
                    {formatCurrency(yearStats.income - yearStats.expense)}
                  </p>
                </div>
              </div>

              {/* Stav k 1. lednu */}
              {jan1Balance && (
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Stav k 1. 1. {selectedYear}</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Celkem</p>
                      <p className={cn("text-sm font-semibold", jan1Balance.balance >= 0 ? "text-income" : "text-expense")}>
                        {formatCurrency(jan1Balance.balance)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Hotovost</p>
                      <p className={cn("text-sm font-semibold", jan1Balance.cashBalance >= 0 ? "text-income" : "text-expense")}>
                        {formatCurrency(jan1Balance.cashBalance)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Banka</p>
                      <p className={cn("text-sm font-semibold", jan1Balance.bankBalance >= 0 ? "text-income" : "text-expense")}>
                        {formatCurrency(jan1Balance.bankBalance)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              {/* Hotovost */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Banknote className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Hotovost</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Příjmy</p>
                    <p className="text-sm font-semibold text-income">{formatCurrency(yearStats.cashIncome)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Výdaje</p>
                    <p className="text-sm font-semibold text-expense">{formatCurrency(yearStats.cashExpense)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Stav</p>
                    <p className={cn(
                      "text-sm font-semibold",
                      yearStats.cashIncome - yearStats.cashExpense >= 0 ? "text-income" : "text-expense"
                    )}>
                      {formatCurrency(yearStats.cashIncome - yearStats.cashExpense)}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Banka */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Banka</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Příjmy</p>
                    <p className="text-sm font-semibold text-income">{formatCurrency(yearStats.bankIncome)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Výdaje</p>
                    <p className="text-sm font-semibold text-expense">{formatCurrency(yearStats.bankExpense)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Stav</p>
                    <p className={cn(
                      "text-sm font-semibold",
                      yearStats.bankIncome - yearStats.bankExpense >= 0 ? "text-income" : "text-expense"
                    )}>
                      {formatCurrency(yearStats.bankIncome - yearStats.bankExpense)}
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">Načítání…</p>
          )}
        </CardContent>
      </Card>


      {/* Kategorie */}
      <Tabs defaultValue="income">
        {/* Hlavička s názvem a selektorem roku */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold">Kategorie — rok {catYear}</p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCatYear((y) => y - 1)}
              disabled={catYear <= minYear}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCatYear((y) => y + 1)}
              disabled={catYear >= CURRENT_YEAR}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="income" className="text-income data-[state=active]:text-income text-xs">
            Příjmy
          </TabsTrigger>
          <TabsTrigger value="expense" className="text-expense data-[state=active]:text-expense text-xs">
            Výdaje
          </TabsTrigger>
          <TabsTrigger value="balance" className="text-balance data-[state=active]:text-balance text-xs">
            Výsledek
          </TabsTrigger>
        </TabsList>

        <TabsContent value="income" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {incomeCategories && incomeCategories.length > 0 ? (
                <div className="space-y-3">
                  {incomeCategories.map((cat, index) => (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{cat.category}</span>
                        <span className="text-income font-semibold">
                          {formatCurrency(cat.amount)}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-income rounded-full transition-all"
                          style={{
                            width: `${(cat.amount / maxIncomeCategory) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Zatím žádné příjmy
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expense" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {expenseCategories && expenseCategories.length > 0 ? (
                <div className="space-y-3">
                  {expenseCategories.map((cat, index) => (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{cat.category}</span>
                        <span className="text-expense font-semibold">
                          {formatCurrency(cat.amount)}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-expense rounded-full transition-all"
                          style={{
                            width: `${(cat.amount / maxExpenseCategory) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Zatím žádné výdaje
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balance" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {categoryBalance && categoryBalance.length > 0 ? (
                <div className="space-y-3">
                  {categoryBalance.map((cat) => {
                    const isPositive = cat.balance >= 0;
                    const maxAbs = Math.max(...categoryBalance.map((c) => Math.abs(c.balance)));
                    const width = maxAbs > 0 ? (Math.abs(cat.balance) / maxAbs) * 100 : 0;
                    return (
                      <div key={cat.category} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{cat.category}</span>
                          <span className={cn("font-semibold", isPositive ? "text-income" : "text-expense")}>
                            {isPositive ? "+" : ""}{formatCurrency(cat.balance)}
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all", isPositive ? "bg-income" : "bg-expense")}
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Zatím žádná data
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>


      {/* Hospodaření po letech */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-sm font-semibold mb-4">Výsledek hospodaření po letech</p>
          {yearlyStats && yearlyStats.length > 0 ? (
            <div className="overflow-x-auto">
              <div className="flex items-end gap-3 h-48 min-w-max px-1">
                {yearlyStats.map((y) => {
                  const isPositive = y.balance >= 0;
                  const maxAbs = Math.max(...yearlyStats.map((r) => Math.abs(r.balance)));
                  const height = maxAbs > 0 ? (Math.abs(y.balance) / maxAbs) * 100 : 0;
                  return (
                    <div key={y.year} className="flex flex-col items-center gap-1" style={{ minWidth: '52px' }}>
                      <span className={cn("text-xs font-semibold tabular-nums whitespace-nowrap", isPositive ? "text-income" : "text-expense")}>
                        {isPositive ? "+" : ""}{formatCurrency(y.balance)}
                      </span>
                      <div className="w-10 flex items-end" style={{ height: '140px' }}>
                        <div
                          className={cn("w-full rounded-t transition-all", isPositive ? "bg-income" : "bg-expense")}
                          style={{ height: `${height}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">{y.year}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Zatím žádná data
            </p>
          )}
        </CardContent>
      </Card>

      {/* Konečný stav po letech */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-sm font-semibold mb-4">Konečný stav po letech</p>
          {yearlyStats && yearlyStats.length > 0 ? (() => {
            // Kumulativní součet
            let running = 0;
            const cumulative = yearlyStats.map((y) => {
              running += y.balance;
              return { year: y.year, balance: running };
            });
            const maxAbs = Math.max(...cumulative.map((r) => Math.abs(r.balance)));
            return (
              <div className="overflow-x-auto">
                <div className="flex items-end gap-3 h-48 min-w-max px-1">
                  {cumulative.map((y) => {
                    const isPositive = y.balance >= 0;
                    const height = maxAbs > 0 ? (Math.abs(y.balance) / maxAbs) * 100 : 0;
                    return (
                      <div key={y.year} className="flex flex-col items-center gap-1" style={{ minWidth: '52px' }}>
                        <span className={cn("text-xs font-semibold tabular-nums whitespace-nowrap", isPositive ? "text-income" : "text-expense")}>
                          {formatCurrency(y.balance)}
                        </span>
                        <div className="w-10 flex items-end" style={{ height: '140px' }}>
                          <div
                            className={cn("w-full rounded-t transition-all", isPositive ? "bg-income" : "bg-expense")}
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">{y.year}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })() : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Zatím žádná data
            </p>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
