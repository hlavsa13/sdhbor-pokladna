"use client";

import { useQuery } from "convex/react";
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
  Building2
} from "lucide-react";
import { cn } from "@/lib/utils";

export function DashboardView() {
  const { signOut } = useAuthActions();
  const currentUser = useQuery(api.userProfiles.getCurrentUser);
  const stats = useQuery(api.transactions.getStats);
  const memberStats = useQuery(api.members.getStats);
  const recentTransactions = useQuery(api.transactions.list, { limit: 5 });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("cs-CZ", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat("cs-CZ", {
      day: "numeric",
      month: "short",
    }).format(new Date(timestamp));
  };

  return (
    <div className="p-4 space-y-6">
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
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm opacity-80">Celkový stav</p>
              <p className="text-3xl font-bold">
                {stats ? formatCurrency(stats.balance) : "—"}
              </p>
            </div>
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
              <Wallet className="w-7 h-7" />
            </div>
          </div>
          {/* Rozdělení: Hotovost / Banka */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
            <div className="flex items-center gap-2">
              <Banknote className="w-5 h-5 opacity-80" />
              <div>
                <p className="text-xs opacity-80">Hotovost</p>
                <p className="text-lg font-semibold">
                  {stats ? formatCurrency(stats.cashBalance) : "—"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 opacity-80" />
              <div>
                <p className="text-xs opacity-80">Banka</p>
                <p className="text-lg font-semibold">
                  {stats ? formatCurrency(stats.bankBalance) : "—"}
                </p>
              </div>
            </div>
          </div>
          {/* Roční statistiky */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
            <div>
              <p className="text-xs opacity-80">Rok {stats?.currentYear} příjmy</p>
              <p className="text-lg font-semibold flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                {stats ? formatCurrency(stats.yearlyIncome) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs opacity-80">Rok {stats?.currentYear} výdaje</p>
              <p className="text-lg font-semibold flex items-center gap-1">
                <TrendingDown className="w-4 h-4" />
                {stats ? formatCurrency(stats.yearlyExpense) : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>



      {/* Členové */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
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
            <div className="text-right">
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
  );
}
