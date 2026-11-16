"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("cs-CZ");
}

function translatePaymentMethod(method?: "cash" | "bank"): string {
  if (method === "cash") return "Hotovost";
  if (method === "bank") return "Banka";
  return "";
}

function translateType(type: "income" | "expense"): string {
  return type === "income" ? "Příjem" : "Výdaj";
}

export function ExcelDownloadButton() {
  const [loading, setLoading] = useState(false);
  const transactions = useQuery(api.transactions.list, {});

  async function handleDownload() {
    if (!transactions || transactions.length === 0) return;

    setLoading(true);

    try {
      // Sort by date desc
      const sortedTransactions = [...transactions].sort((a, b) => b.date - a.date);

      // Calculate totals
      const totalIncome = sortedTransactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);
      const totalExpense = sortedTransactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);
      const balance = totalIncome - totalExpense;

      // Sheet 1: All Transactions
      const transakceData = sortedTransactions.map((t) => ({
        Datum: formatDate(t.date),
        Typ: translateType(t.type),
        Popis: t.description,
        Kategorie: t.category,
        "Způsob platby": translatePaymentMethod(t.paymentMethod),
        "Částka (Kč)": t.amount,
        Proplaceno: t.reimbursed ? "Ano" : "Ne",
      }));

      // Sheet 2: Income
      const prijmyData = sortedTransactions
        .filter((t) => t.type === "income")
        .map((t) => ({
          Datum: formatDate(t.date),
          Popis: t.description,
          Kategorie: t.category,
          "Způsob platby": translatePaymentMethod(t.paymentMethod),
          "Částka (Kč)": t.amount,
        }));

      // Sheet 3: Expenses
      const vydajeData = sortedTransactions
        .filter((t) => t.type === "expense")
        .map((t) => ({
          Datum: formatDate(t.date),
          Popis: t.description,
          Kategorie: t.category,
          "Způsob platby": translatePaymentMethod(t.paymentMethod),
          "Částka (Kč)": t.amount,
          Proplaceno: t.reimbursed ? "Ano" : "Ne",
        }));

      // Sheet 4: Summary
      const souhrnData = [
        { "": "Celkové příjmy", "Částka (Kč)": totalIncome },
        { "": "Celkové výdaje", "Částka (Kč)": totalExpense },
        { "": "Zůstatek", "Částka (Kč)": balance },
      ];

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Add sheets
      const wsTransakce = XLSX.utils.json_to_sheet(transakceData);
      const wsPrijmy = XLSX.utils.json_to_sheet(prijmyData);
      const wsVydaje = XLSX.utils.json_to_sheet(vydajeData);
      const wsSouhrn = XLSX.utils.json_to_sheet(souhrnData);

      // Set column widths
      const colWidths = {
        Datum: { wch: 12 },
        Typ: { wch: 8 },
        Popis: { wch: 35 },
        Kategorie: { wch: 20 },
        "Způsob platby": { wch: 14 },
        "Částka (Kč)": { wch: 14 },
        Proplaceno: { wch: 10 },
        "": { wch: 20 },
      };

      wsTransakce["!cols"] = [
        colWidths.Datum,
        colWidths.Typ,
        colWidths.Popis,
        colWidths.Kategorie,
        colWidths["Způsob platby"],
        colWidths["Částka (Kč)"],
        colWidths.Proplaceno,
      ];

      wsPrijmy["!cols"] = [
        colWidths.Datum,
        colWidths.Popis,
        colWidths.Kategorie,
        colWidths["Způsob platby"],
        colWidths["Částka (Kč)"],
      ];

      wsVydaje["!cols"] = [
        colWidths.Datum,
        colWidths.Popis,
        colWidths.Kategorie,
        colWidths["Způsob platby"],
        colWidths["Částka (Kč)"],
        colWidths.Proplaceno,
      ];

      wsSouhrn["!cols"] = [colWidths[""], colWidths["Částka (Kč)"]];

      XLSX.utils.book_append_sheet(wb, wsTransakce, "Transakce");
      XLSX.utils.book_append_sheet(wb, wsPrijmy, "Příjmy");
      XLSX.utils.book_append_sheet(wb, wsVydaje, "Výdaje");
      XLSX.utils.book_append_sheet(wb, wsSouhrn, "Souhrn");

      // Generate file and trigger download
      const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SDH-BOR-Transakce-${new Date().toISOString().split("T")[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownload}
      disabled={loading || !transactions || transactions.length === 0}
      className="text-xs flex items-center gap-1.5"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Download className="w-3.5 h-3.5" />
      )}
      Stáhnout Excel
    </Button>
  );
}
