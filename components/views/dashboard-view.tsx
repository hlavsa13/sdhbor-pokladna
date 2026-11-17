"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Flame, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Users, 
  LogOut,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Banknote,
  Building2,
  Scale,
  ReceiptText,
  Check,
} from "lucide-react";
import { CashCountDialog } from "@/components/cash-count-dialog";
import { cn } from "@/lib/utils";
import type { ComponentType } from "react";

export function DashboardView() {
  const { signOut } = useAuthActions();
  const currentUser = useQuery(api.userProfiles.getCurrentUser);
  const stats = useQuery(api.transactions.getStats);
  const memberStats = useQuery(api.members.getStats);
  const recentTransactions = useQuery(api.transactions.list, { limit: 5 });
  const toReimburse = useQuery(api.transactions.listToReimburse);
  const markReimbursed = useMutation(api.transactions.markReimbursed);
  const [isCashCountOpen, setIsCashCountOpen] = useState(false);
  const role = currentUser?.profile?.role;
  const canManageCash = role === "admin" || role === "deputy";
  // Inventuru pokladny dělá a vidí jen hospodář
  const canCountCash = role === "admin";
  const toReimburseTotal = (toReimburse ?? []).reduce((sum, t) => sum + t.amount, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("cs-CZ", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatSigned = (amount: number) =>
    `${amount > 0 ? "+" : ""}${formatCurrency(amount)}`;

  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat("cs-CZ", {
      day: "numeric",
      month: "short",
    }).format(new Date(timestamp));
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
            <Flame className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">
              Ahoj, {currentUser?.profile?.name || "člene"}!
            </h1>
            <p className="text-sm text-muted-foreground">
              {currentUser?.profile?.role === "admin" ? "Hospodář" : currentUser?.profile?.role === "secretary" ? "Tajemník" : currentUser?.profile?.role === "deputy" ? "Zástupce hospodáře" : "Člen"}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => signOut()}>
          <LogOut className="w-5 h-5" />
        </Button>
      </div>

      {/* Hlavní statistiky */}
      <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0 shadow-lg">
        <CardContent className="pt-6">
          {/* Celkový stav – vystředěný */}
          <div className="text-center mb-4">
            <p className="flex items-center justify-center gap-1.5 h-5 text-sm opacity-80">
              <Wallet className="w-4 h-4 shrink-0" />
              Celkový stav
            </p>
            <p className="text-3xl md:text-4xl font-bold mt-1">
              {stats ? formatCurrency(stats.balance) : "—"}
            </p>
          </div>

          {/* Mobil: mřížka 2×2 + výsledek na samostatném řádku; široká stránka: 5 údajů v řadě */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-4 border-t border-white/20">
            <StatCell icon={Banknote} label="Hotovost" value={stats ? formatCurrency(stats.cashBalance) : "—"} />
            <StatCell icon={Building2} label="Banka" value={stats ? formatCurrency(stats.bankBalance) : "—"} />
            <StatCell icon={TrendingUp} label={`${stats?.currentYear ?? ""} příjmy`} value={stats ? formatCurrency(stats.yearlyIncome) : "—"} />
            <StatCell icon={TrendingDown} label={`${stats?.currentYear ?? ""} výdaje`} value={stats ? formatCurrency(stats.yearlyExpense) : "—"} />

            {/* Hospodářský výsledek aktuálního roku */}
            <div className="col-span-2 md:col-span-1 flex md:flex-col items-center justify-between md:justify-center rounded-lg bg-black/20 px-3 py-2.5 md:px-1 md:py-2">
              <p className="flex items-center gap-1 h-4 text-xs opacity-80 whitespace-nowrap">
                <Scale className="w-3.5 h-3.5 shrink-0" />
                {stats?.currentYear} výsledek
              </p>
              <p className="text-xl md:text-lg font-bold leading-tight md:mt-0.5">
                {stats ? formatSigned(stats.yearlyIncome - stats.yearlyExpense) : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inventura hotovosti */}
      {canCountCash && (
        <div className="-mt-3 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setIsCashCountOpen(true)}>
            <Banknote className="w-4 h-4 mr-1.5" />
            Inventura pokladny
          </Button>
        </div>
      )}
      <CashCountDialog
        open={isCashCountOpen}
        onOpenChange={setIsCashCountOpen}
        expected={stats?.cashBalance}
      />

      {/* K proplacení – výdaje zaplacené ze svého */}
      {toReimburse && toReimburse.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-baseline justify-between text-amber-700 dark:text-amber-400">
              <p className="font-semibold flex items-center gap-2">
                <ReceiptText className="w-4 h-4" />
                K proplacení
              </p>
              <p className="text-lg font-bold tabular-nums">{formatCurrency(toReimburseTotal)}</p>
            </div>
            <div className="space-y-2">
              {toReimburse.map((t) => (
                <div key={t._id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {t.paidBy} – {t.description}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-semibold tabular-nums">{formatCurrency(t.amount)}</span>
                    {canManageCash && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 bg-background"
                        onClick={() => {
                          if (confirm(`Označit výdaj „${t.description}“ (${formatCurrency(t.amount)} Kč) jako proplacený ${t.paidBy}?`)) {
                            markReimbursed({ id: t._id }).catch((e) => console.log("Proplacení selhalo:", e));
                          }
                        }}
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />
                        Proplatit
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Na široké stránce Členové a Poslední pohyby vedle sebe */}
      <div className="grid gap-6 md:grid-cols-[1fr_1.6fr] md:items-start">
      {/* Členové */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex md:flex-col md:items-start items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Aktivní členové</p>
                <p className="text-lg font-bold">
                  {memberStats?.activeMembers ?? "—"}
                </p>
              </div>
            </div>
            <div className="text-right md:text-left md:pl-[52px]">
              <p className="text-xs text-muted-foreground">Zaplacené příspěvky</p>
              <p className="text-lg font-bold text-income">
                {memberStats ? `${memberStats.paidFeesCount}/${memberStats.activeMembers}` : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Poslední transakce */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Poslední pohyby
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentTransactions && recentTransactions.length > 0 ? (
            <div className="space-y-3">
              {recentTransactions.map((transaction) => (
                <div
                  key={transaction._id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        transaction.type === "income"
                          ? "bg-income/10"
                          : "bg-expense/10"
                      )}
                    >
                      {transaction.type === "income" ? (
                        <ArrowUpRight className="w-4 h-4 text-income" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-expense" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium line-clamp-1">
                        {transaction.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {transaction.category} • {formatDate(transaction.date)} • {transaction.paymentMethod === "bank" ? "Banka" : "Hotovost"}
                      </p>
                    </div>
                  </div>
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      transaction.type === "income"
                        ? "text-income"
                        : "text-expense"
                    )}
                  >
                    {transaction.type === "income" ? "+" : "-"}
                    {formatCurrency(transaction.amount)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Zatím žádné transakce
            </p>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

function StatCell({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg px-1 py-2">
      <p className="flex items-center gap-1 h-4 text-xs opacity-80 whitespace-nowrap">
        <Icon className="w-3.5 h-3.5 shrink-0" />
        {label}
      </p>
      <p className="text-lg font-semibold leading-tight mt-0.5">{value}</p>
    </div>
  );
}
