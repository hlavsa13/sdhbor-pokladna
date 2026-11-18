"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Banknote, Building2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ValnaHromadaPdfButton } from "@/components/valnahromada-pdf-button";
import { ExcelDownloadButton } from "@/components/excel-download-button";

import { cn } from "@/lib/utils";
import { BudgetReportCard } from "@/components/budget-report-card";

const CURRENT_YEAR = new Date().getFullYear();
const TOP_CATEGORIES = 5;
const TOP_YEARS = 5;

export function ReportsView() {
  // Jeden vybraný rok pro celou stránku
  const [year, setYear] = useState(CURRENT_YEAR);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllYears, setShowAllYears] = useState(false);
  const [chartMode, setChartMode] = useState<"result" | "balance">("result");
  const chartScrollRef = useRef<HTMLDivElement>(null);
  // Zda jde graf posunout doleva / doprava (podle toho se ukazují šipky a vyblednutí)
  const [chartCanScroll, setChartCanScroll] = useState({ left: false, right: false });

  const yearStats = useQuery(api.transactions.getStatsByYear, { year });
  const jan1Balance = useQuery(api.transactions.getBalanceBeforeYear, { year });
  const incomeCategories = useQuery(api.transactions.getCategoryStats, { type: "income", year });
  const expenseCategories = useQuery(api.transactions.getCategoryStats, { type: "expense", year });
  const categoryBalance = useQuery(api.transactions.getCategoryBalanceStats, { year });
  const yearlyStats = useQuery(api.transactions.getYearlyStats);
  // Export do Excelu a PDF pro valnou hromadu jen pro hospodáře
  const isAdmin = useQuery(api.userProfiles.isAdmin);

  // Dostupné roky z dat
  const availableYears = yearlyStats ? yearlyStats.map((y) => Number(y.year)) : [];
  const minYear = availableYears.length > 0 ? Math.min(...availableYears) : CURRENT_YEAR;

  const updateChartScroll = () => {
    const el = chartScrollRef.current;
    if (!el) return;
    setChartCanScroll({
      left: el.scrollLeft > 2,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    });
  };

  const scrollChart = (direction: -1 | 1) => {
    const el = chartScrollRef.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.7, behavior: "smooth" });
  };

  // Graf po letech: po načtení odscrollovat na nejnovější roky
  useEffect(() => {
    const el = chartScrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
    updateChartScroll();
  }, [yearlyStats, chartMode]);

  useEffect(() => {
    window.addEventListener("resize", updateChartScroll);
    return () => window.removeEventListener("resize", updateChartScroll);
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("cs-CZ", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const signed = (amount: number) => `${amount >= 0 ? "+" : ""}${formatCurrency(amount)}`;
  const balanceColor = (amount: number) => (amount >= 0 ? "text-income" : "text-expense");

  // Roky s kumulativním stavem na konci roku
  const yearsWithBalance = (() => {
    if (!yearlyStats) return [];
    let running = 0;
    return yearlyStats.map((y) => {
      running += y.balance;
      return { ...y, endBalance: running };
    });
  })();
  const yearsDesc = [...yearsWithBalance].reverse();
  const visibleYears = showAllYears ? yearsDesc : yearsDesc.slice(0, TOP_YEARS);

  const chartData = yearsWithBalance.map((y) => ({
    year: y.year,
    value: chartMode === "result" ? y.balance : y.endBalance,
  }));
  const chartMaxAbs = chartData.length > 0 ? Math.max(...chartData.map((d) => Math.abs(d.value))) : 0;

  // Pohyb peněz ve vybraném roce
  const totals = yearStats && jan1Balance
    ? {
        start: { total: jan1Balance.balance, cash: jan1Balance.cashBalance, bank: jan1Balance.bankBalance },
        income: { total: yearStats.income, cash: yearStats.cashIncome, bank: yearStats.bankIncome },
        expense: { total: yearStats.expense, cash: yearStats.cashExpense, bank: yearStats.bankExpense },
      }
    : null;
  const result = totals
    ? {
        total: totals.income.total - totals.expense.total,
        cash: totals.income.cash - totals.expense.cash,
        bank: totals.income.bank - totals.expense.bank,
      }
    : null;
  const end = totals && result
    ? {
        total: totals.start.total + result.total,
        cash: totals.start.cash + result.cash,
        bank: totals.start.bank + result.bank,
      }
    : null;

  const renderCategoryList = (
    items: { category: string; value: number }[] | undefined,
    kind: "income" | "expense" | "balance",
    emptyText: string
  ) => {
    if (!items || items.length === 0) {
      return <p className="text-sm text-muted-foreground text-center py-4">{emptyText}</p>;
    }
    const maxAbs = Math.max(...items.map((c) => Math.abs(c.value)));
    const visible = showAllCategories ? items : items.slice(0, TOP_CATEGORIES);
    return (
      <div className="space-y-3">
        {visible.map((cat) => {
          const isPositive = kind === "income" || (kind === "balance" && cat.value >= 0);
          const width = maxAbs > 0 ? (Math.abs(cat.value) / maxAbs) * 100 : 0;
          return (
            <div key={cat.category} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{cat.category}</span>
                <span className={cn("font-semibold", isPositive ? "text-income" : "text-expense")}>
                  {kind === "balance" ? signed(cat.value) : formatCurrency(cat.value)}
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
        {items.length > TOP_CATEGORIES && (
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowAllCategories((v) => !v)}
          >
            {showAllCategories ? (
              <>Zobrazit méně <ChevronUp className="w-3.5 h-3.5" /></>
            ) : (
              <>Zobrazit všechny ({items.length}) <ChevronDown className="w-3.5 h-3.5" /></>
            )}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">Přehledy</h1>
          <p className="text-sm text-muted-foreground">Statistiky hospodaření</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <ExcelDownloadButton />
            <ValnaHromadaPdfButton />
          </div>
        )}
      </div>

      {/* Výběr roku – platí pro celou stránku */}
      <Card>
        <CardContent className="py-2 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setYear((y) => y - 1)}
            disabled={year <= minYear}
            aria-label="Předchozí rok"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <p className="text-base font-semibold">Rok {year}</p>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setYear((y) => y + 1)}
            disabled={year >= CURRENT_YEAR}
            aria-label="Další rok"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        {/* Pohyb peněz ve vybraném roce */}
        <Card>
          <CardContent className="pt-4">
            {totals && result && end ? (
              <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-x-3 gap-y-2 items-baseline tabular-nums">
                {/* Hlavička sloupců */}
                <span />
                <span className="text-xs text-muted-foreground text-right">Celkem</span>
                <span className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                  <Banknote className="w-3.5 h-3.5" /> Hotovost
                </span>
                <span className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                  <Building2 className="w-3.5 h-3.5" /> Banka
                </span>

                {/* Stav k 1. 1. */}
                <span className="text-xs text-muted-foreground">Stav 1. 1.</span>
                <span className={cn("text-base font-bold text-right", balanceColor(totals.start.total))}>
                  {formatCurrency(totals.start.total)}
                </span>
                <span className={cn("text-sm font-semibold text-right", balanceColor(totals.start.cash))}>
                  {formatCurrency(totals.start.cash)}
                </span>
                <span className={cn("text-sm font-semibold text-right", balanceColor(totals.start.bank))}>
                  {formatCurrency(totals.start.bank)}
                </span>

                {/* Příjmy */}
                <span className="text-xs text-muted-foreground">Příjmy</span>
                <span className="text-base font-bold text-right text-income">{formatCurrency(totals.income.total)}</span>
                <span className="text-sm font-semibold text-right text-income">{formatCurrency(totals.income.cash)}</span>
                <span className="text-sm font-semibold text-right text-income">{formatCurrency(totals.income.bank)}</span>

                {/* Výdaje */}
                <span className="text-xs text-muted-foreground">Výdaje</span>
                <span className="text-base font-bold text-right text-expense">{formatCurrency(totals.expense.total)}</span>
                <span className="text-sm font-semibold text-right text-expense">{formatCurrency(totals.expense.cash)}</span>
                <span className="text-sm font-semibold text-right text-expense">{formatCurrency(totals.expense.bank)}</span>

                {/* Výsledek roku */}
                <span className="text-xs text-muted-foreground">Výsledek</span>
                <span className={cn("text-base font-bold text-right", balanceColor(result.total))}>
                  {signed(result.total)}
                </span>
                <span className={cn("text-sm font-semibold text-right", balanceColor(result.cash))}>
                  {signed(result.cash)}
                </span>
                <span className={cn("text-sm font-semibold text-right", balanceColor(result.bank))}>
                  {signed(result.bank)}
                </span>

                <div className="col-span-4 border-t" />

                {/* Stav na konci roku / dnes */}
                <span className="text-xs text-muted-foreground">
                  {year === CURRENT_YEAR ? "Stav dnes" : "Stav 31. 12."}
                </span>
                <span className={cn("text-base font-bold text-right", balanceColor(end.total))}>
                  {formatCurrency(end.total)}
                </span>
                <span className={cn("text-sm font-semibold text-right", balanceColor(end.cash))}>
                  {formatCurrency(end.cash)}
                </span>
                <span className={cn("text-sm font-semibold text-right", balanceColor(end.bank))}>
                  {formatCurrency(end.bank)}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">Načítání…</p>
            )}
          </CardContent>
        </Card>

        {/* Kategorie */}
        <Tabs defaultValue="income">
          <p className="text-sm font-semibold mb-3">Kategorie — rok {year}</p>

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
                {renderCategoryList(
                  incomeCategories?.map((c) => ({ category: c.category, value: c.amount })),
                  "income",
                  "Zatím žádné příjmy"
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expense" className="mt-4">
            <Card>
              <CardContent className="pt-4">
                {renderCategoryList(
                  expenseCategories?.map((c) => ({ category: c.category, value: c.amount })),
                  "expense",
                  "Zatím žádné výdaje"
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="balance" className="mt-4">
            <Card>
              <CardContent className="pt-4">
                {renderCategoryList(
                  categoryBalance?.map((c) => ({ category: c.category, value: c.balance })),
                  "balance",
                  "Zatím žádná data"
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <BudgetReportCard year={year} />

      {/* Po letech – graf a tabulka */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Po letech</p>
            <div className="flex items-center gap-1">
            {(chartCanScroll.left || chartCanScroll.right) && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => scrollChart(-1)}
                  disabled={!chartCanScroll.left}
                  aria-label="Starší roky"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 mr-1"
                  onClick={() => scrollChart(1)}
                  disabled={!chartCanScroll.right}
                  aria-label="Novější roky"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </>
            )}
            <Tabs value={chartMode} onValueChange={(v) => setChartMode(v as "result" | "balance")}>
              <TabsList className="h-8">
                <TabsTrigger value="result" className="text-xs px-2.5">Výsledek</TabsTrigger>
                <TabsTrigger value="balance" className="text-xs px-2.5">Konečný stav</TabsTrigger>
              </TabsList>
            </Tabs>
            </div>
          </div>

          {chartData.length > 0 ? (
            <>
              {/* Graf – klepnutím na sloupec se vybere rok */}
              <div className="relative">
              <div ref={chartScrollRef} onScroll={updateChartScroll} className="overflow-x-auto no-scrollbar">
                <div className="flex items-end gap-3 h-48 min-w-max px-1">
                  {chartData.map((d) => {
                    const isPositive = d.value >= 0;
                    const height = chartMaxAbs > 0 ? (Math.abs(d.value) / chartMaxAbs) * 100 : 0;
                    const isSelected = Number(d.year) === year;
                    return (
                      <button
                        type="button"
                        key={d.year}
                        onClick={() => setYear(Number(d.year))}
                        className="flex flex-col items-center gap-1"
                        style={{ minWidth: "52px" }}
                      >
                        <span className={cn("text-xs font-semibold tabular-nums whitespace-nowrap", isPositive ? "text-income" : "text-expense")}>
                          {chartMode === "result" ? signed(d.value) : formatCurrency(d.value)}
                        </span>
                        <div className="w-10 flex items-end" style={{ height: "140px" }}>
                          <div
                            className={cn(
                              "w-full rounded-t transition-all",
                              isPositive ? "bg-income" : "bg-expense",
                              isSelected && "ring-2 ring-foreground/40 ring-offset-2 ring-offset-background"
                            )}
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <span className={cn("text-xs", isSelected ? "font-bold text-foreground" : "text-muted-foreground font-medium")}>
                          {d.year}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Vyblednutí na straně, kde graf pokračuje */}
              {chartCanScroll.left && (
                <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-card to-transparent" />
              )}
              {chartCanScroll.right && (
                <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card to-transparent" />
              )}
              </div>

              {/* Tabulka – klepnutím na řádek se vybere rok */}
              <div className="border-t pt-2">
                <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr] gap-x-3 text-xs text-muted-foreground px-1 pb-1">
                  <span>Rok</span>
                  <span className="text-right">Příjmy</span>
                  <span className="text-right">Výdaje</span>
                  <span className="text-right">Výsledek</span>
                  <span className="text-right">Stav</span>
                </div>
                {visibleYears.map((y) => {
                  const isSelected = Number(y.year) === year;
                  return (
                    <button
                      type="button"
                      key={y.year}
                      onClick={() => setYear(Number(y.year))}
                      className={cn(
                        "w-full grid grid-cols-[auto_1fr_1fr_1fr_1fr] gap-x-3 text-sm tabular-nums px-1 py-1.5 rounded-md text-left hover:bg-muted/40",
                        isSelected && "bg-muted/60 font-semibold"
                      )}
                    >
                      <span>{y.year}</span>
                      <span className="text-right text-income">{formatCurrency(y.income)}</span>
                      <span className="text-right text-expense">{formatCurrency(y.expense)}</span>
                      <span className={cn("text-right", balanceColor(y.balance))}>{signed(y.balance)}</span>
                      <span className={cn("text-right", balanceColor(y.endBalance))}>{formatCurrency(y.endBalance)}</span>
                    </button>
                  );
                })}
                {yearsDesc.length > TOP_YEARS && (
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2 px-1"
                    onClick={() => setShowAllYears((v) => !v)}
                  >
                    {showAllYears ? (
                      <>Zobrazit méně <ChevronUp className="w-3.5 h-3.5" /></>
                    ) : (
                      <>Zobrazit všechny roky (od {yearsWithBalance[0]?.year}) <ChevronDown className="w-3.5 h-3.5" /></>
                    )}
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Zatím žádná data
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
