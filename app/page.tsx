"use client";

import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { LoginScreen } from "@/components/login-screen";
import { MainApp } from "@/components/main-app";
import { Flame, Clock, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground">Načítání...</p>
      </div>
    </div>
  );
}

function AwaitingApproval() {
  const { signOut } = useAuthActions();
  const claimAdmin = useMutation(api.userProfiles.claimAdminIfNoneExists);

  // Automaticky se pokusíme povýšit uživatele na admina, pokud žádný neexistuje
  useEffect(() => {
    claimAdmin().catch((err) => console.log("claimAdmin check:", err));
  }, [claimAdmin]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-background to-accent/30">
      <div className="flex flex-col items-center mb-8">
        <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center mb-4 shadow-lg">
          <Flame className="w-10 h-10 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">SDH Hospodaření</h1>
      </div>

      <div className="w-full max-w-sm bg-card rounded-2xl shadow-xl p-8 text-center space-y-4 border-0">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
          <Clock className="w-8 h-8 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Čekáme na schválení</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Vaše žádost o přístup byla odeslána. Správce sboru musí váš účet schválit, než se budete moci přihlásit.
        </p>
        <p className="text-xs text-muted-foreground">
          Kontaktujte hospodáře, pokud schválení trvá příliš dlouho.
        </p>
        <Button
          variant="outline"
          className="w-full mt-2"
          onClick={() => signOut()}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Odhlásit se
        </Button>
      </div>
    </div>
  );
}

export default function Home() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const currentUser = useQuery(api.userProfiles.getCurrentUser, isAuthenticated ? undefined : "skip");

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // Čekáme na načtení profilu
  if (currentUser === undefined) {
    return <LoadingSpinner />;
  }

  // Přihlášen, ale profil ještě nebyl vytvořen (setupProfiler v MainApp to obstará)
  // Nebo profil existuje ale není schválený
  if (currentUser?.profile && currentUser.profile.approved === false) {
    return <AwaitingApproval />;
  }

  return <MainApp />;
}
