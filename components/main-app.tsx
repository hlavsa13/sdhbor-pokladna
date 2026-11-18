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

// Stránka se pamatuje v adrese (#finance…) – obnovení stránky zůstane na místě
// a tlačítko Zpět v prohlížeči/telefonu přepíná mezi stránkami aplikace.
const VIEW_HASHES: Record<ViewType, string> = {
  dashboard: "prehled",
  transactions: "finance",
  reports: "vykazy",
  members: "clenove",
  settings: "nastaveni",
};

function viewFromHash(): ViewType {
  const hash = window.location.hash.slice(1);
  return (Object.keys(VIEW_HASHES) as ViewType[]).find((v) => VIEW_HASHES[v] === hash) ?? "dashboard";
}

export function MainApp() {
  const [activeView, setActiveViewState] = useState<ViewType>("dashboard");

  useEffect(() => {
    setActiveViewState(viewFromHash());
    const onHashChange = () => {
      setActiveViewState(viewFromHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const setActiveView = (view: ViewType) => {
    if (window.location.hash.slice(1) !== VIEW_HASHES[view]) {
      window.location.hash = VIEW_HASHES[view]; // vyvolá hashchange → přepnutí
    } else {
      setActiveViewState(view);
    }
  };
  const currentUser = useQuery(api.userProfiles.getCurrentUser);

  // Nastavení vidí jen hospodář
  const isAdmin = currentUser?.profile?.role === "admin";
  const visibleNavItems = navItems.filter((item) => item.id !== "settings" || isAdmin);
  const roleLoaded = currentUser !== undefined;
  useEffect(() => {
    if (roleLoaded && !isAdmin && activeView === "settings") setActiveView("dashboard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoaded, isAdmin, activeView]);

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
          {visibleNavItems.map((item) => {
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
        {activeView === "settings" && isAdmin && <SettingsView />}
      </main>

      {/* Spodní navigace — pouze mobil */}
      <div className="md:hidden">
        <BottomNav items={visibleNavItems} activeView={activeView} onViewChange={setActiveView} />
      </div>
    </div>
  );
}
