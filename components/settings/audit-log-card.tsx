"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, History, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

const ACTIONS = {
  create: { label: "Přidáno", icon: Plus, className: "text-income" },
  update: { label: "Upraveno", icon: Pencil, className: "text-amber-600 dark:text-amber-400" },
  delete: { label: "Smazáno", icon: Trash2, className: "text-expense" },
  import: { label: "Import", icon: FileSpreadsheet, className: "text-muted-foreground" },
} as const;

const formatDateTime = (ts: number) =>
  new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));

// Nastavení – historie změn transakcí (jen hospodář)
export function AuditLogCard() {
  const [limit, setLimit] = useState(30);
  const entries = useQuery(api.audit.list, { limit });
  const restore = useMutation(api.audit.restore);

  const handleRestore = async (id: Id<"auditLog">) => {
    if (!confirm("Obnovit tuto smazanou transakci?")) return;
    try {
      await restore({ id });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Obnovení se nepodařilo");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="w-5 h-5" />
          Historie změn
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries === undefined ? (
          <p className="text-sm text-muted-foreground">Načítání…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Zatím žádné záznamy. Historie se vede od nasazení této funkce.
          </p>
        ) : (
          <>
            {entries.map((e) => {
              const action = ACTIONS[e.action];
              const Icon = action.icon;
              return (
                <div key={e._id} className="text-sm border-b border-border last:border-0 pb-2">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                    <span className={cn("flex items-center gap-1 font-medium", action.className)}>
                      <Icon className="w-3.5 h-3.5" />
                      {action.label}
                    </span>
                    · {e.userName} · {formatDateTime(e.at)}
                  </p>
                  <div className="mt-0.5 flex items-start justify-between gap-2">
                    <p>{e.summary}</p>
                    {e.action === "delete" && e.snapshot &&
                      (e.restored ? (
                        <span className="text-xs text-muted-foreground shrink-0">obnoveno</span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs shrink-0"
                          onClick={() => handleRestore(e._id)}
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1" />
                          Obnovit
                        </Button>
                      ))}
                  </div>
                </div>
              );
            })}
            {entries.length >= limit && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => setLimit((l) => l + 50)}>
                Načíst starší
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
