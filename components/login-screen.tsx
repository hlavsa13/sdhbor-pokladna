"use client";

import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame, Mail, Lock, User, ArrowRight, Loader2, KeyRound } from "lucide-react";

type Mode = "login" | "register" | "reset" | "reset-verify";

export function LoginScreen() {
  const { signIn } = useAuthActions();
  const createProfile = useMutation(api.userProfiles.createProfile);
  const requestReset = useAction(api.passwordReset.requestReset);
  const confirmReset = useAction(api.passwordReset.confirmReset);
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (mode === "register") {
      if (password.length < 8) { setError("Heslo musí mít alespoň 8 znaků."); return; }
      if (password !== confirmPassword) { setError("Hesla se neshodují."); return; }
    }
    if (mode === "reset-verify") {
      if (newPassword.length < 8) { setError("Nové heslo musí mít alespoň 8 znaků."); return; }
      if (newPassword !== confirmNewPassword) { setError("Hesla se neshodují."); return; }
    }

    setIsLoading(true);
    try {
      if (mode === "reset") {
        await requestReset({ email });
        setSuccessMessage("Kód pro reset hesla byl odeslán na váš e-mail.");
        setMode("reset-verify");
      } else if (mode === "reset-verify") {
        await confirmReset({ email, code: resetCode, newPassword });
        setSuccessMessage("Heslo bylo úspěšně změněno. Přihlaste se.");
        setMode("login");
        setResetCode(""); setNewPassword(""); setConfirmNewPassword("");
      } else {
        const fd = new FormData();
        fd.append("email", email);
        fd.append("password", password);
        fd.append("flow", mode === "login" ? "signIn" : "signUp");
        if (mode === "register") fd.append("name", name);

        await signIn("password", fd);

        if (mode === "register") {
          try {
            await createProfile({ name: name.trim() });
          } catch (profileErr) {
            console.log("Profile creation after signup:", profileErr);
          }
        }
      }
    } catch (err) {
      console.log("Auth error:", err);
      const msg = err instanceof Error ? err.message : "";
      if (mode === "login") {
        setError(msg.includes("Invalid password") || msg.includes("Could not sign in")
          ? "Nesprávný e-mail nebo heslo."
          : "Přihlášení se nezdařilo. Zkuste to znovu.");
      } else if (mode === "register") {
        setError(msg.includes("already exists") || msg.includes("already registered")
          ? "Účet s tímto e-mailem již existuje. Přihlaste se."
          : "Registrace se nezdařila. Zkuste to znovu.");
      } else if (mode === "reset") {
        setError("Nepodařilo se odeslat kód. Zkontrolujte e-mail.");
      } else if (mode === "reset-verify") {
        setError(msg.includes("Invalid code") || msg.includes("expired")
          ? "Neplatný nebo prošlý kód. Zkuste znovu."
          : "Změna hesla se nezdařila. Zkuste to znovu.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const goToLogin = () => {
    setMode("login");
    setError(""); setSuccessMessage("");
    setPassword(""); setConfirmPassword("");
    setResetCode(""); setNewPassword(""); setConfirmNewPassword("");
  };

  const titles: Record<Mode, string> = {
    login: "Přihlášení", register: "Registrace",
    reset: "Zapomenuté heslo", "reset-verify": "Nové heslo",
  };
  const descriptions: Record<Mode, string> = {
    login: "Přihlaste se svým e-mailem a heslem",
    register: "Vytvořte si účet — správce vás musí schválit",
    reset: "Zadejte e-mail a pošleme vám kód pro reset hesla",
    "reset-verify": "Zadejte kód z e-mailu a vaše nové heslo",
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-background to-accent/30">
      <div className="flex flex-col items-center mb-8">
        <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center mb-4 shadow-lg">
          <Flame className="w-10 h-10 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">SDH Hospodaření</h1>
        <p className="text-muted-foreground text-sm mt-1">Správa financí sboru</p>
      </div>

      <Card className="w-full max-w-sm shadow-xl border-0">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-lg">{titles[mode]}</CardTitle>
          <CardDescription>{descriptions[mode]}</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "register" && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input type="text" placeholder="Vaše jméno" value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-11 h-12 text-base" required autoComplete="name" />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input type="email" placeholder="vas@email.cz" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-11 h-12 text-base" required autoComplete="email"
                readOnly={mode === "reset-verify"} />
            </div>

            {(mode === "login" || mode === "register") && (
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input type="password"
                  placeholder={mode === "register" ? "Heslo (min. 8 znaků)" : "Heslo"}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="pl-11 h-12 text-base" required
                  autoComplete={mode === "login" ? "current-password" : "new-password"} />
              </div>
            )}

            {mode === "register" && (
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input type="password" placeholder="Heslo znovu" value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-11 h-12 text-base" required autoComplete="new-password" />
              </div>
            )}

            {mode === "reset-verify" && (
              <>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input type="text" placeholder="Kód z e-mailu" value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    className="pl-11 h-12 text-base tracking-widest" required autoComplete="one-time-code" />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input type="password" placeholder="Nové heslo (min. 8 znaků)" value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-11 h-12 text-base" required autoComplete="new-password" />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input type="password" placeholder="Nové heslo znovu" value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="pl-11 h-12 text-base" required autoComplete="new-password" />
                </div>
              </>
            )}

            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            {successMessage && <p className="text-sm text-green-600 text-center">{successMessage}</p>}

            <Button type="submit" className="w-full h-12 text-base font-medium mt-1" disabled={isLoading}>
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> :
               mode === "login" ? <><span>Přihlásit se</span><ArrowRight className="w-5 h-5 ml-2" /></> :
               mode === "register" ? "Odeslat žádost o přístup" :
               mode === "reset" ? "Odeslat kód" : "Nastavit nové heslo"}
            </Button>

            {mode === "login" && (
              <>
                <button type="button"
                  onClick={() => { setMode("register"); setError(""); setSuccessMessage(""); }}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors pt-1">
                  Nemáte účet? Zaregistrovat se
                </button>
                <button type="button"
                  onClick={() => { setMode("reset"); setError(""); setSuccessMessage(""); }}
                  className="w-full text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors">
                  Zapomněli jste heslo?
                </button>
              </>
            )}

            {(mode === "register" || mode === "reset" || mode === "reset-verify") && (
              <button type="button" onClick={goToLogin}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors pt-1">
                ← Zpět na přihlášení
              </button>
            )}
          </form>
        </CardContent>
      </Card>

      <p className="mt-6 text-xs text-muted-foreground text-center max-w-xs">
        Pro přístup musíte být schváleni správcem sboru.
      </p>
    </div>
  );
}
