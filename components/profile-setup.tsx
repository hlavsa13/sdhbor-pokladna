"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame, User, Loader2 } from "lucide-react";

export function ProfileSetup() {
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const createProfile = useMutation(api.userProfiles.createProfile);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsLoading(true);
    try {
      await createProfile({ name: name.trim() });
    } catch (err) {
      console.log("Error creating profile:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-background to-accent/30">
      <div className="flex flex-col items-center mb-8">
        <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center mb-4 shadow-lg">
          <Flame className="w-10 h-10 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Vítejte!</h1>
        <p className="text-muted-foreground text-sm mt-1">Dokončete nastavení účtu</p>
      </div>

      <Card className="w-full max-w-sm shadow-xl border-0">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-lg">Váš profil</CardTitle>
          <CardDescription>Jak vám máme říkat?</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Vaše jméno"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-11 h-12 text-base"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-medium"
              disabled={isLoading || !name.trim()}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Dokončit nastavení"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-8 text-xs text-muted-foreground text-center max-w-xs">
        První uživatel bude automaticky nastaven jako správce (hospodář).
      </p>
    </div>
  );
}
