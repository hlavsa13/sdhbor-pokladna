"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DashboardView } from "@/components/views/dashboard-view";
import { TransactionsView } from "@/components/views/transactions-view";
import { MembersView } from "@/components/views/members-view";
import { ReportsView } from "@/components/views/reports-view";
import { SettingsView } from "@/components/views/settings-view";
import { ProfileSetup } from "@/components/profile-setup";
import { BottomNav } from "@/components/bottom-nav";
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  Users, 
  BarChart3,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewType = "dashboard" | "transactions" | "members" | "reports" | "settings";

export const navItems = [
  { id: "dashboard" as const, label: "Přehled", icon: LayoutDashboard },
  { id: "transactions" as const, label: "Finance", icon: ArrowLeftRight },
  { id: "reports" as const, label: "Výkazy", icon: BarChart3 },
  { id: "members" as const, label: "Členové", icon: Users },
  { id: "settings" as const, label: "Nastavení", icon: Settings },
];

export function MainApp() {
  const [activeView, setActiveView] = useState<ViewType>("dashboard");
  const currentUser = useQuery(api.userProfiles.getCurrentUser);

  // Pokud uživatel nemá profil, zobrazit setup
  if (currentUser === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Načítání...</p>
        </div>
      </div>
    );
  }

  if (currentUser && !currentUser.profile) {
    return <ProfileSetup />;
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Levé menu — pouze desktop */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border bg-card min-h-screen sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-border">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">SDH Bor</p>
          <p className="text-base font-bold text-foreground leading-tight mt-0.5">Pokladna</p>
        </div>
        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Hlavní obsah */}
      <main className="flex-1 pb-20 md:pb-0 overflow-auto min-w-0">
        {activeView === "dashboard" && <DashboardView />}
        {activeView === "transactions" && <TransactionsView />}
        {activeView === "members" && <MembersView />}
        {activeView === "reports" && <ReportsView />}
        {activeView === "settings" && <SettingsView />}
      </main>

      {/* Spodní navigace — pouze mobil */}
      <div className="md:hidden">
        <BottomNav activeView={activeView} onViewChange={setActiveView} />
      </div>
    </div>
  );
}
