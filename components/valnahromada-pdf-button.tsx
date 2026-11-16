"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Loader2 } from "lucide-react";

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 2013;

// Generate year options from MIN_YEAR to CURRENT_YEAR
const yearOptions = Array.from(
  { length: CURRENT_YEAR - MIN_YEAR + 1 },
  (_, i) => CURRENT_YEAR - i
).reverse();

function formatCurrency(amount: number): string {
  return (
    new Intl.NumberFormat("cs-CZ", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + " Kč"
  );
}

function getMemberTypeLabel(type: string | null | undefined): string {
  switch (type) {
    case "man":
      return "Muž";
    case "woman":
      return "Žena";
    case "child":
      return "Dítě";
    default:
      return "—";
  }
}

function getFeeStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "paid":
      return "Zaplaceno";
    case "unpaid":
      return "Nezaplaceno";
    case "exempt":
      return "Osvobozeno";
    default:
      return "—";
  }
}

function getPaymentMethodLabel(method: string | null | undefined): string {
  switch (method) {
    case "cash":
      return "Hotovost";
    case "bank":
      return "Banka";
    default:
      return "—";
  }
}

interface ValnaHromadaData {
  year: number;
  financials: {
    income: number;
    expense: number;
    balance: number;
    cashIncome: number;
    cashExpense: number;
    cashBalance: number;
    bankIncome: number;
    bankExpense: number;
    bankBalance: number;
    incomeByCategory: { category: string; amount: number }[];
    expenseByCategory: { category: string; amount: number }[];
  };
  members: {
    total: number;
    paid: number;
    unpaid: number;
    exempt: number;
    list: {
      firstName: string;
      lastName: string;
      memberType: string | null;
      over60: boolean;
      feeStatus: string | null;
      feeAmount: number | null;
      feePaymentMethod: string | null;
    }[];
  };
}

function generatePDF(data: ValnaHromadaData) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Prosím povolte vyskakovací okna pro generování PDF.");
    return;
  }

  const generatedDate = new Date().toLocaleDateString("cs-CZ");

  const html = `
<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <title>Zpráva hospodáře pro valnou hromadu ${data.year}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm;
    }
    
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #333;
      margin: 0;
      padding: 0;
    }
    
    .page {
      padding: 10mm;
    }
    
    .page-break {
      page-break-before: always;
    }
    
    /* Page 1 - Title */
    .title-page {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 240mm;
      text-align: center;
    }
    
    .title-page h1 {
      font-size: 32pt;
      color: #8B0000;
      margin-bottom: 20px;
      font-weight: bold;
    }
    
    .title-page .subtitle {
      font-size: 18pt;
      color: #333;
      margin-bottom: 40px;
    }
    
    .title-page .year {
      font-size: 48pt;
      color: #8B0000;
      font-weight: bold;
      margin: 30px 0;
    }
    
    .title-page .generated {
      position: absolute;
      bottom: 30mm;
      font-size: 10pt;
      color: #666;
    }
    
    /* Page 2 & 3 - Content */
    h2 {
      font-size: 16pt;
      color: #8B0000;
      border-bottom: 2px solid #8B0000;
      padding-bottom: 8px;
      margin-top: 0;
      margin-bottom: 20px;
    }
    
    h3 {
      font-size: 12pt;
      color: #333;
      margin-top: 25px;
      margin-bottom: 10px;
    }
    
    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    
    th {
      background-color: #8B0000;
      color: white;
      font-weight: bold;
      text-align: left;
      padding: 10px 8px;
      font-size: 10pt;
    }
    
    td {
      padding: 8px;
      border-bottom: 1px solid #ddd;
      font-size: 10pt;
    }
    
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    
    tr:hover {
      background-color: #f0f0f0;
    }
    
    .text-right {
      text-align: right;
    }
    
    .text-center {
      text-align: center;
    }
    
    /* Summary table */
    .summary-table th {
      background-color: #6b0000;
    }
    
    .summary-table .total-row {
      font-weight: bold;
      background-color: #f0e0e0 !important;
    }
    
    .summary-table .total-row td {
      border-top: 2px solid #8B0000;
    }
    
    /* Stats boxes */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin-bottom: 25px;
    }
    
    .stat-box {
      background-color: #f5f5f5;
      border-left: 4px solid #8B0000;
      padding: 15px;
      text-align: center;
    }
    
    .stat-box .label {
      font-size: 9pt;
      color: #666;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    
    .stat-box .value {
      font-size: 18pt;
      font-weight: bold;
      color: #333;
    }
    
    /* Income/Expense colors */
    .income {
      color: #2e7d32;
    }
    
    .expense {
      color: #c62828;
    }
    
    /* Small text */
    .small {
      font-size: 9pt;
      color: #666;
    }
    
    /* Footer */
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #ddd;
      font-size: 9pt;
      color: #666;
      text-align: center;
    }
  </style>
</head>
<body>
  <!-- Page 1: Title -->
  <div class="page title-page">
    <h1>SDH BOR u Sedlčan</h1>
    <div class="subtitle">Zpráva hospodáře pro valnou hromadu</div>
    <div class="year">${data.year}</div>
    <div class="generated">Vygenerováno: ${generatedDate}</div>
  </div>

  <!-- Page 2: Financial Report -->
  <div class="page page-break">
    <h2>Finanční přehled za rok ${data.year}</h2>
    
    <h3>Souhrn hospodaření</h3>
    <table class="summary-table">
      <thead>
        <tr>
          <th style="width: 40%;">Kategorie</th>
          <th class="text-right">Příjmy</th>
          <th class="text-right">Výdaje</th>
          <th class="text-right">Výsledek</th>
        </tr>
      </thead>
      <tbody>
        <tr class="total-row">
          <td><strong>Celkem</strong></td>
          <td class="text-right income"><strong>${formatCurrency(data.financials.income)}</strong></td>
          <td class="text-right expense"><strong>${formatCurrency(data.financials.expense)}</strong></td>
          <td class="text-right ${data.financials.balance >= 0 ? "income" : "expense"}"><strong>${formatCurrency(data.financials.balance)}</strong></td>
        </tr>
        <tr>
          <td>Hotovost</td>
          <td class="text-right income">${formatCurrency(data.financials.cashIncome)}</td>
          <td class="text-right expense">${formatCurrency(data.financials.cashExpense)}</td>
          <td class="text-right ${data.financials.cashBalance >= 0 ? "income" : "expense"}">${formatCurrency(data.financials.cashBalance)}</td>
        </tr>
        <tr>
          <td>Banka</td>
          <td class="text-right income">${formatCurrency(data.financials.bankIncome)}</td>
          <td class="text-right expense">${formatCurrency(data.financials.bankExpense)}</td>
          <td class="text-right ${data.financials.bankBalance >= 0 ? "income" : "expense"}">${formatCurrency(data.financials.bankBalance)}</td>
        </tr>
      </tbody>
    </table>

    <h3>Přehled příjmů podle kategorií</h3>
    <table>
      <thead>
        <tr>
          <th>Kategorie</th>
          <th class="text-right">Částka (Kč)</th>
        </tr>
      </thead>
      <tbody>
        ${data.financials.incomeByCategory
          .map(
            (cat) => `
        <tr>
          <td>${cat.category}</td>
          <td class="text-right income">${formatCurrency(cat.amount)}</td>
        </tr>
        `
          )
          .join("")}
        <tr class="total-row">
          <td><strong>Celkem příjmy</strong></td>
          <td class="text-right income"><strong>${formatCurrency(data.financials.income)}</strong></td>
        </tr>
      </tbody>
    </table>

    <h3>Přehled výdajů podle kategorií</h3>
    <table>
      <thead>
        <tr>
          <th>Kategorie</th>
          <th class="text-right">Částka (Kč)</th>
        </tr>
      </thead>
      <tbody>
        ${data.financials.expenseByCategory
          .map(
            (cat) => `
        <tr>
          <td>${cat.category}</td>
          <td class="text-right expense">${formatCurrency(cat.amount)}</td>
        </tr>
        `
          )
          .join("")}
        <tr class="total-row">
          <td><strong>Celkem výdaje</strong></td>
          <td class="text-right expense"><strong>${formatCurrency(data.financials.expense)}</strong></td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Page 3: Members -->
  <div class="page page-break">
    <h2>Přehled členů</h2>
    
    <div class="stats-grid">
      <div class="stat-box">
        <div class="label">Celkem aktivních</div>
        <div class="value">${data.members.total}</div>
      </div>
      <div class="stat-box">
        <div class="label">Zaplaceno</div>
        <div class="value" style="color: #2e7d32;">${data.members.paid}</div>
      </div>
      <div class="stat-box">
        <div class="label">Nezaplaceno</div>
        <div class="value" style="color: #c62828;">${data.members.unpaid}</div>
      </div>
      <div class="stat-box">
        <div class="label">Osvobozeno</div>
        <div class="value" style="color: #666;">${data.members.exempt}</div>
      </div>
    </div>

    <h3>Seznam členů a příspěvků za rok ${data.year}</h3>
    <table>
      <thead>
        <tr>
          <th style="width: 35%;">Příjmení a jméno</th>
          <th class="text-center" style="width: 15%;">Typ</th>
          <th class="text-center" style="width: 20%;">Příspěvek ${data.year}</th>
          <th class="text-center" style="width: 30%;">Způsob platby</th>
        </tr>
      </thead>
      <tbody>
        ${data.members.list
          .map(
            (member) => `
        <tr>
          <td>${member.lastName} ${member.firstName}${member.over60 ? " <span class=\"small\">(60+)</span>" : ""}</td>
          <td class="text-center">${getMemberTypeLabel(member.memberType)}</td>
          <td class="text-center ${member.feeStatus === "paid" ? "income" : member.feeStatus === "unpaid" ? "expense" : ""}">${getFeeStatusLabel(member.feeStatus)}${member.feeAmount && member.feeAmount > 0 ? ` (${formatCurrency(member.feeAmount)})` : ""}</td>
          <td class="text-center">${getPaymentMethodLabel(member.feePaymentMethod)}</td>
        </tr>
        `
          )
          .join("")}
      </tbody>
    </table>

    <div class="footer">
      SDH BOR u Sedlčan — Zpráva pro valnou hromadu ${data.year} — Vygenerováno ${generatedDate}
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

export function ValnaHromadaPdfButton() {
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [open, setOpen] = useState(false);

  const data = useQuery(api.reports.getValnaHromadaData, { year: selectedYear });

  const handleGenerate = () => {
    if (data) {
      generatePDF(data as ValnaHromadaData);
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileText className="w-4 h-4" />
          PDF Valná hromada
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Generovat PDF pro valnou hromadu</DialogTitle>
          <DialogDescription>
            Vyberte rok pro vygenerování zprávy hospodáře.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <label className="text-sm font-medium mb-2 block">Rok</label>
          <Select
            value={String(selectedYear)}
            onValueChange={(value) => setSelectedYear(Number(value))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Vyberte rok" />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Zrušit
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!data}
            className="gap-2"
          >
            {!data ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            Generovat PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
