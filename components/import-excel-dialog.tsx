"use client";

import { useState, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileSpreadsheet, Loader2, Check } from "lucide-react";

type ImportType = "members" | "transactions";
type MemberType = "man" | "woman" | "child";
type TransactionType = "income" | "expense";

interface ImportExcelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: ImportType;
}

export function ImportExcelDialog({ open, onOpenChange, type }: ImportExcelDialogProps) {
  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "done">("upload");
  const [isLoading, setIsLoading] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [rawData, setRawData] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [parsedData, setParsedData] = useState<unknown[]>([]);
  const [importResult, setImportResult] = useState<{ imported: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importMembers = useMutation(api.members.importMembers);
  const importTransactions = useMutation(api.transactions.importTransactions);
  const categories = useQuery(api.categories.list, { type: "income" });

  const title = type === "members" ? "Import členů" : "Import transakcí";

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet);

      if (jsonData.length === 0) {
        alert("Soubor je prázdný nebo má nesprávný formát");
        return;
      }

      const cols = Object.keys(jsonData[0]);
      setColumns(cols);
      setRawData(jsonData);

      // Auto-mapping
      const autoMapping: Record<string, string> = {};
      cols.forEach((col) => {
        const lower = col.toLowerCase();
        
        if (type === "members") {
          if ((lower.includes("jméno") || lower.includes("jmeno") || lower === "name" || lower === "firstname") && !lower.includes("příjmení") && !lower.includes("prijmeni")) {
            if (!autoMapping.firstName) autoMapping.firstName = col;
          }
          if (lower.includes("příjmení") || lower.includes("prijmeni") || lower === "surname" || lower === "lastname") {
            if (!autoMapping.lastName) autoMapping.lastName = col;
          }
          if (lower.includes("email") || lower.includes("e-mail")) {
            autoMapping.email = col;
          }
          if (lower.includes("telefon") || lower.includes("phone")) {
            autoMapping.phone = col;
          }
          if (lower.includes("narozen") || lower.includes("birth")) {
            autoMapping.birthDate = col;
          }
        } else {
          if (lower.includes("popis") || lower.includes("description") || lower.includes("název")) {
            autoMapping.description = col;
          }
          if (lower.includes("částka") || lower.includes("castka") || lower.includes("amount") || lower.includes("kč")) {
            autoMapping.amount = col;
          }
          if (lower.includes("datum") || lower.includes("date")) {
            autoMapping.date = col;
          }
          if (lower.includes("kategorie") || lower.includes("category")) {
            autoMapping.category = col;
          }
          if (lower.includes("typ") || lower.includes("type")) {
            autoMapping.type = col;
          }
          if (lower.includes("platební") || lower.includes("platba") || lower.includes("metoda") || lower.includes("payment")) {
            autoMapping.paymentMethod = col;
          }
        }
      });

      setMapping(autoMapping);
      setStep("mapping");
    } catch (err) {
      console.log("Error reading file:", err);
      alert("Chyba při čtení souboru");
    } finally {
      setIsLoading(false);
    }
  };

  const parseDate = (value: unknown): number | undefined => {
    if (!value) return undefined;
    
    if (typeof value === "number") {
      const date = XLSX.SSF.parse_date_code(value);
      if (date) {
        return new Date(date.y, date.m - 1, date.d).getTime();
      }
    }
    
    if (typeof value === "string") {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        return parsed.getTime();
      }
      
      const czechMatch = value.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      if (czechMatch) {
        const [, day, month, year] = czechMatch;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).getTime();
      }
    }
    
    return undefined;
  };

  const parseMemberType = (value: unknown): MemberType | undefined => {
    if (!value) return undefined;
    const str = String(value).toLowerCase();
    
    if (str.includes("muž") || str.includes("muz") || str === "m") return "man";
    if (str.includes("žena") || str.includes("zena") || str === "ž" || str === "z" || str === "f") return "woman";
    if (str.includes("dítě") || str.includes("dite") || str === "d") return "child";
    
    return undefined;
  };

  const parseTransactionType = (value: unknown): TransactionType => {
    if (!value) return "expense";
    const str = String(value).toLowerCase();
    
    if (str.includes("příjem") || str.includes("prijem") || str.includes("income") || str === "p" || str === "+") {
      return "income";
    }
    return "expense";
  };

  const parsePaymentMethod = (value: unknown): "cash" | "bank" => {
    if (!value) return "cash";
    const str = String(value).toLowerCase();
    
    if (str.includes("banka") || str.includes("bank") || str.includes("účet") || str.includes("ucet") || str === "bu" || str === "b") {
      return "bank";
    }
    return "cash";
  };

  const parseAmount = (value: unknown): number => {
    if (typeof value === "number") return Math.abs(value);
    if (typeof value === "string") {
      const cleaned = value.replace(/[^\d.,\-]/g, "").replace(",", ".");
      return Math.abs(parseFloat(cleaned)) || 0;
    }
    return 0;
  };

  const calculateAge = (birthDate: number): number => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const handleProceedToPreview = () => {
    if (type === "members" && (!mapping.firstName || !mapping.lastName)) {
      alert("Musíte vybrat sloupce se jménem a příjmením");
      return;
    }
    if (type === "transactions" && (!mapping.description || !mapping.amount)) {
      alert("Musíte vybrat sloupce s popisem a částkou");
      return;
    }

    if (type === "members") {
      const members = rawData.map((row) => {
        const birthDate = parseDate(row[mapping.birthDate]);
        const age = birthDate ? calculateAge(birthDate) : null;
        
        let memberType = parseMemberType(row[mapping.memberType]);
        if (!memberType && age !== null && age < 18) {
          memberType = "child";
        }

        return {
          firstName: row[mapping.firstName] ? String(row[mapping.firstName]) : undefined,
          lastName: row[mapping.lastName] ? String(row[mapping.lastName]) : undefined,
          email: row[mapping.email] ? String(row[mapping.email]) : undefined,
          phone: row[mapping.phone] ? String(row[mapping.phone]) : undefined,
          birthDate,
          memberType,
          over60: age !== null ? age >= 60 : false,
        };
      }).filter((m) => m.firstName && m.lastName);

      setParsedData(members);
    } else {
      const transactions = rawData.map((row) => {
        const amount = parseAmount(row[mapping.amount]);
        const rawAmount = row[mapping.amount];
        
        // Determine type from amount sign or type column
        let txType: TransactionType = "expense";
        if (mapping.type && row[mapping.type]) {
          txType = parseTransactionType(row[mapping.type]);
        } else if (typeof rawAmount === "number" && rawAmount > 0) {
          txType = "income";
        } else if (typeof rawAmount === "string" && !rawAmount.includes("-")) {
          txType = "income";
        }

        return {
          type: txType,
          amount,
          description: row[mapping.description] ? String(row[mapping.description]) : "",
          category: row[mapping.category] ? String(row[mapping.category]) : "Ostatní",
          date: parseDate(row[mapping.date]) ?? Date.now(),
          paymentMethod: mapping.paymentMethod ? parsePaymentMethod(row[mapping.paymentMethod]) : "cash",
        };
      }).filter((t) => t.description && t.amount > 0);

      setParsedData(transactions);
    }

    setStep("preview");
  };

  const handleImport = async () => {
    setIsLoading(true);
    try {
      if (type === "members") {
        const result = await importMembers({
          members: (parsedData as Array<{
            firstName?: string;
            lastName?: string;
            email?: string;
            phone?: string;
            birthDate?: number;
            memberType?: MemberType;
            over60?: boolean;
          }>).map((m) => ({
            firstName: m.firstName!,
            lastName: m.lastName!,
            email: m.email,
            phone: m.phone,
            birthDate: m.birthDate,
            memberType: m.memberType,
            over60: m.over60,
          })),
        });
        setImportResult(result);
      } else {
        const result = await importTransactions({
          transactions: parsedData as Array<{
            type: TransactionType;
            amount: number;
            description: string;
            category: string;
            date: number;
            paymentMethod?: "cash" | "bank";
          }>,
        });
        setImportResult(result);
      }
      setStep("done");
    } catch (err) {
      console.log("Error importing:", err);
      alert("Chyba při importu: " + (err instanceof Error ? err.message : "Neznámá chyba"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setStep("upload");
    setColumns([]);
    setRawData([]);
    setMapping({});
    setParsedData([]);
    setImportResult(null);
    onOpenChange(false);
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "-";
    return new Intl.DateTimeFormat("cs-CZ").format(new Date(timestamp));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("cs-CZ", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            {title} z Excelu
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Nahrajte Excel soubor"}
            {step === "mapping" && "Namapujte sloupce na údaje"}
            {step === "preview" && "Zkontrolujte data před importem"}
            {step === "done" && "Import dokončen"}
          </DialogDescription>
        </DialogHeader>

        {/* Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              variant="outline"
              className="w-full h-32 border-dashed flex flex-col gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : (
                <>
                  <Upload className="w-8 h-8" />
                  <span>Klikněte pro výběr souboru</span>
                  <span className="text-xs text-muted-foreground">.xlsx nebo .xls</span>
                </>
              )}
            </Button>
          </div>
        )}

        {/* Mapping */}
        {step === "mapping" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Nalezeno <strong>{rawData.length}</strong> řádků.
            </p>

            <div className="space-y-3">
              {type === "members" ? (
                <>
                  <div className="space-y-2">
                    <Label>Jméno *</Label>
                    <Select value={mapping.firstName || ""} onValueChange={(v) => setMapping({ ...mapping, firstName: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Vyberte sloupec" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Příjmení *</Label>
                    <Select value={mapping.lastName || ""} onValueChange={(v) => setMapping({ ...mapping, lastName: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Vyberte sloupec" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Select value={mapping.email || "__none__"} onValueChange={(v) => setMapping({ ...mapping, email: v === "__none__" ? "" : v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Nepovinné" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nevybráno</SelectItem>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Telefon</Label>
                    <Select value={mapping.phone || "__none__"} onValueChange={(v) => setMapping({ ...mapping, phone: v === "__none__" ? "" : v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Nepovinné" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nevybráno</SelectItem>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Datum narození</Label>
                    <Select value={mapping.birthDate || "__none__"} onValueChange={(v) => setMapping({ ...mapping, birthDate: v === "__none__" ? "" : v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Nepovinné" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nevybráno</SelectItem>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Popis *</Label>
                    <Select value={mapping.description || ""} onValueChange={(v) => setMapping({ ...mapping, description: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Vyberte sloupec" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Částka *</Label>
                    <Select value={mapping.amount || ""} onValueChange={(v) => setMapping({ ...mapping, amount: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Vyberte sloupec" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Datum</Label>
                    <Select value={mapping.date || "__none__"} onValueChange={(v) => setMapping({ ...mapping, date: v === "__none__" ? "" : v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Nepovinné" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nevybráno</SelectItem>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Kategorie</Label>
                    <Select value={mapping.category || "__none__"} onValueChange={(v) => setMapping({ ...mapping, category: v === "__none__" ? "" : v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Nepovinné" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nevybráno</SelectItem>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Typ (příjem/výdaj)</Label>
                    <Select value={mapping.type || "__none__"} onValueChange={(v) => setMapping({ ...mapping, type: v === "__none__" ? "" : v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Nepovinné (určí se z částky)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nevybráno</SelectItem>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Platební metoda</Label>
                    <Select value={mapping.paymentMethod || "__none__"} onValueChange={(v) => setMapping({ ...mapping, paymentMethod: v === "__none__" ? "" : v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Nepovinné (výchozí: hotovost)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nevybráno</SelectItem>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("upload")} className="flex-1">
                Zpět
              </Button>
              <Button onClick={handleProceedToPreview} className="flex-1">
                Pokračovat
              </Button>
            </div>
          </div>
        )}

        {/* Preview */}
        {step === "preview" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Připraveno k importu: <strong>{parsedData.length}</strong> {type === "members" ? "členů" : "transakcí"}
            </p>

            <div className="max-h-60 overflow-y-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    {type === "members" ? (
                      <>
                        <th className="p-2 text-left">Jméno</th>
                        <th className="p-2 text-left">Narozen/a</th>
                      </>
                    ) : (
                      <>
                        <th className="p-2 text-left">Popis</th>
                        <th className="p-2 text-left">Částka</th>
                        <th className="p-2 text-left">Typ</th>
                        <th className="p-2 text-left">Platba</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {parsedData.slice(0, 20).map((item, i) => (
                    <tr key={i} className="border-t">
                      {type === "members" ? (
                        <>
                          <td className="p-2">{(item as { lastName?: string }).lastName} {(item as { firstName?: string }).firstName}</td>
                          <td className="p-2">{formatDate((item as { birthDate?: number }).birthDate)}</td>
                        </>
                      ) : (
                        <>
                          <td className="p-2 max-w-[150px] truncate">{(item as { description: string }).description}</td>
                          <td className="p-2">{formatCurrency((item as { amount: number }).amount)}</td>
                          <td className="p-2">
                            <span className={(item as { type: string }).type === "income" ? "text-income" : "text-expense"}>
                              {(item as { type: string }).type === "income" ? "Příjem" : "Výdaj"}
                            </span>
                          </td>
                          <td className="p-2 text-xs">
                            {(item as { paymentMethod?: string }).paymentMethod === "bank" ? "Banka" : "Hotovost"}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedData.length > 20 && (
                <p className="p-2 text-center text-muted-foreground text-sm">
                  ...a dalších {parsedData.length - 20}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("mapping")} className="flex-1">
                Zpět
              </Button>
              <Button onClick={handleImport} disabled={isLoading} className="flex-1">
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Importovat
              </Button>
            </div>
          </div>
        )}

        {/* Done */}
        {step === "done" && importResult && (
          <div className="space-y-4 text-center py-4">
            <div className="w-16 h-16 rounded-full bg-income/20 flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-income" />
            </div>
            <div>
              <p className="text-lg font-semibold">Import dokončen!</p>
              <p className="text-muted-foreground">
                Úspěšně importováno {importResult.imported} {type === "members" ? "členů" : "transakcí"}
              </p>
            </div>
            <Button onClick={handleClose} className="w-full">
              Zavřít
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
