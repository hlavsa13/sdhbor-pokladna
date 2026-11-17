"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Trash2,
  Pencil,
  Banknote,
  Building2,
  FileSpreadsheet,
  Calendar,
  Tag,
  X,
  Check,
  Camera,
  Receipt,
  Mic,
  ScanLine,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ImportExcelDialog } from "@/components/import-excel-dialog";
import { ReceiptCropper } from "@/components/receipt-cropper";
import { VoiceTransactionDialog, useSpeechSupported } from "@/components/voice-transaction-dialog";
import { parseVoiceTransaction } from "@/lib/voice-transaction";
import { imageToBase64Jpeg } from "@/lib/image-to-base64";



const CURRENT_YEAR = new Date().getFullYear();

export function TransactionsView() {
  const [activeTab, setActiveTab] = useState<"all" | "income" | "expense">("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<"income" | "expense">("income");
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<Id<"transactions"> | null>(null);
  // Výchozí je aktuální rok – seznam je kratší a souhrn ukazuje letošek
  const [selectedYear, setSelectedYear] = useState<string>(String(CURRENT_YEAR));
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("all");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [existingReceiptStorageId, setExistingReceiptStorageId] = useState<Id<"_storage"> | null>(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const [viewReceiptUrl, setViewReceiptUrl] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const speechSupported = useSpeechSupported();
  // Načtení z účtenky
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanFile, setScanFile] = useState<{ file: File; preview: string } | null>(null);
  const cropModeRef = useRef<"attach" | "scan">("attach");
  const scanInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = useQuery(api.userProfiles.isAdmin);
  const isDeputy = useQuery(api.userProfiles.isDeputy);
  const currentUser = useQuery(api.userProfiles.getCurrentUser);
  const currentUserId = currentUser?.id;
  const canAddTransactions = isAdmin || isDeputy;
  const allTransactions = useQuery(api.transactions.list, {
    type: activeTab === "all" ? undefined : activeTab,
    ...(selectedYear !== "all" ? { year: Number(selectedYear) } : {}),
  });
  const yearlyStats = useQuery(api.transactions.getYearlyStats);
  const incomeCategories = useQuery(api.categories.list, { type: "income" });
  const expenseCategories = useQuery(api.categories.list, { type: "expense" });
  const createTransaction = useMutation(api.transactions.create);
  const updateTransaction = useMutation(api.transactions.update);
  const removeTransaction = useMutation(api.transactions.remove);
  const generateUploadUrl = useMutation(api.media.generateUploadUrl);
  const parseWithAi = useAction(api.ai.parseTransaction);

  // Roky pro filtr – ze všech dat, nejen z právě načtených transakcí
  const availableYears = Array.from(
    new Set([CURRENT_YEAR, ...(yearlyStats ?? []).map((y) => Number(y.year))])
  ).sort((a, b) => b - a);

  // Získat unikátní kategorie z transakcí
  const availableCategories = allTransactions
    ? Array.from(new Set(allTransactions.map((t) => t.category))).sort()
    : [];

  // Filtrovat transakce (seřazeny podle data sestupně z databáze)
  const transactions = allTransactions?.filter((t) => {
    const year = new Date(t.date).getFullYear().toString();
    const matchesYear = selectedYear === "all" || year === selectedYear;
    const matchesCategory = selectedCategory === "all" || t.category === selectedCategory;
    const matchesPayment = selectedPaymentMethod === "all" || t.paymentMethod === selectedPaymentMethod;
    return matchesYear && matchesCategory && matchesPayment;
  });

  const [formData, setFormData] = useState({
    amount: "",
    description: "",
    category: "",
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "cash" as "cash" | "bank",
    reimbursed: false,
  });

  const formatCurrency = (amount: number) => {
    const hasDecimals = amount % 1 !== 0;
    return new Intl.NumberFormat("cs-CZ", {
      style: "decimal",
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat("cs-CZ", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(timestamp));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.description || !formData.category) return;

    setIsLoading(true);
    try {
      // Nahrát účtenku, pokud byla vybrána
      let uploadedStorageId: Id<"_storage"> | undefined = undefined;
      if (receiptFile) {
        const uploadUrl = await generateUploadUrl();
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": receiptFile.type },
          body: receiptFile,
        });
        if (!uploadResponse.ok) throw new Error("Nahrávání účtenky selhalo");
        const { storageId } = await uploadResponse.json();
        uploadedStorageId = storageId;
        console.log("Účtenka nahrána:", storageId);
      }

      if (editingId) {
        await updateTransaction({
          id: editingId,
          type: transactionType,
          amount: parseFloat(formData.amount),
          description: formData.description,
          category: formData.category,
          date: new Date(formData.date).getTime(),
          paymentMethod: formData.paymentMethod,
          ...(transactionType === "expense" ? { reimbursed: formData.reimbursed } : {}),
          ...(uploadedStorageId ? { receiptStorageId: uploadedStorageId } : {}),
          ...(removeReceipt ? { removeReceipt: true } : {}),
        });
      } else {
        await createTransaction({
          type: transactionType,
          amount: parseFloat(formData.amount),
          description: formData.description,
          category: formData.category,
          date: new Date(formData.date).getTime(),
          paymentMethod: formData.paymentMethod,
          ...(uploadedStorageId ? { receiptStorageId: uploadedStorageId } : {}),
        });
      }
      setFormData({
        amount: "",
        description: "",
        category: "",
        date: new Date().toISOString().split("T")[0],
        paymentMethod: "cash",
        reimbursed: false,
      });
      setReceiptFile(null);
      setReceiptPreview(null);
      setExistingReceiptStorageId(null);
      setRemoveReceipt(false);
      setEditingId(null);
      setIsDialogOpen(false);
    } catch (err) {
      console.log("Error saving transaction:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: Id<"transactions">) => {
    if (!confirm("Opravdu chcete smazat tuto transakci?")) return;
    try {
      await removeTransaction({ id });
    } catch (err) {
      console.log("Error deleting transaction:", err);
    }
  };

  const openDialog = (type: "income" | "expense") => {
    setTransactionType(type);
    setEditingId(null);
    setFormData({
      amount: "",
      description: "",
      category: "",
      date: new Date().toISOString().split("T")[0],
      paymentMethod: "cash",
      reimbursed: false,
    });
    setReceiptFile(null);
    setReceiptPreview(null);
    setExistingReceiptStorageId(null);
    setRemoveReceipt(false);
    setIsDialogOpen(true);
  };

  const openEditDialog = (transaction: NonNullable<typeof transactions>[number]) => {
    setTransactionType(transaction.type);
    setEditingId(transaction._id);
    setFormData({
      amount: transaction.amount.toString(),
      description: transaction.description,
      category: transaction.category,
      date: new Date(transaction.date).toISOString().split("T")[0],
      paymentMethod: transaction.paymentMethod || "cash",
      reimbursed: transaction.reimbursed ?? false,
    });
    setReceiptFile(null);
    setReceiptPreview(null);
    setExistingReceiptStorageId(transaction.receiptStorageId ?? null);
    setRemoveReceipt(false);
    setIsDialogOpen(true);
  };

  type Prefill = {
    type?: "income" | "expense";
    amount?: number;
    description?: string;
    category?: string;
    paymentMethod?: "cash" | "bank";
    date?: string;
  };

  // Otevře formulář nové transakce předvyplněný rozpoznanými údaji
  const openPrefilledDialog = (p: Prefill, receipt?: { file: File; preview: string }) => {
    openDialog(p.type ?? "expense");
    setFormData((prev) => ({
      ...prev,
      amount: p.amount !== undefined ? String(p.amount) : "",
      description: p.description ?? "",
      category: p.category ?? "",
      date: p.date ?? prev.date,
      paymentMethod: p.paymentMethod ?? prev.paymentMethod,
    }));
    if (receipt) {
      setReceiptFile(receipt.file);
      setReceiptPreview(receipt.preview);
    }
  };

  // Hlasové zadání: větu rozebere AI, při chybě se použijí místní pravidla
  const handleVoiceResult = async (text: string) => {
    const allCategories = [
      ...(incomeCategories ?? []).map((c) => ({ name: c.name, type: "income" as const })),
      ...(expenseCategories ?? []).map((c) => ({ name: c.name, type: "expense" as const })),
    ];
    const local = parseVoiceTransaction(text, allCategories);
    let result: Prefill = local;

    setVoiceProcessing(true);
    try {
      const ai = await parseWithAi({ text });
      if (ai.ok) {
        // AI má přednost, chybějící údaje doplní místní rozbor
        result = {
          type: ai.data.type ?? local.type,
          amount: ai.data.amount ?? local.amount,
          description: ai.data.description ?? local.description,
          category: ai.data.category ?? local.category,
          paymentMethod: ai.data.paymentMethod ?? local.paymentMethod,
          date: ai.data.date ?? local.date,
        };
      } else {
        console.log("AI nedostupná, použita místní pravidla:", ai.error);
      }
    } catch (e) {
      console.log("AI chyba, použita místní pravidla:", e);
    } finally {
      setVoiceProcessing(false);
    }

    console.log("Hlasové zadání:", text, result);
    setIsVoiceOpen(false);
    openPrefilledDialog(result);
  };

  // Načtení z účtenky: vybrat fotku → ořez → AI → předvyplněný formulář s přiloženou účtenkou
  const openScan = () => {
    setScanError(null);
    setScanFile(null);
    setScanBusy(false);
    setIsScanOpen(true);
  };

  const pickScanPhoto = (useCamera: boolean) => {
    const input = scanInputRef.current;
    if (!input) return;
    if (useCamera) input.setAttribute("capture", "environment");
    else input.removeAttribute("capture");
    input.click();
  };

  const handleScanFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    cropModeRef.current = "scan";
    setIsScanOpen(false); // během ořezu zavřít, po ořezu se znovu otevře
    handleReceiptChange(e);
  };

  const runScan = async (file: File, preview: string) => {
    setScanFile({ file, preview });
    setScanError(null);
    setScanBusy(true);
    setIsScanOpen(true);
    try {
      const imageBase64 = await imageToBase64Jpeg(file);
      const ai = await parseWithAi({ imageBase64, imageMediaType: "image/jpeg" });
      if (!ai.ok) {
        setScanError(ai.error);
        return;
      }
      setIsScanOpen(false);
      openPrefilledDialog({ type: "expense", ...ai.data }, { file, preview });
    } catch (e) {
      console.log("Čtení účtenky selhalo:", e);
      setScanError("Účtenku se nepodařilo přečíst.");
    } finally {
      setScanBusy(false);
    }
  };

  const categories = transactionType === "income" ? incomeCategories : expenseCategories;
  const categoryList = categories || [];

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    console.log("Účtenka vybrána, otvírám ořez:", file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCropSrc(ev.target?.result as string);
      setIsCropOpen(true);
    };
    reader.readAsDataURL(file);
    // Reset input aby šlo vybrat stejný soubor znovu
    e.target.value = "";
  };

  const handleCropConfirm = (blob: Blob, previewUrl: string) => {
    const croppedFile = new File([blob], "uctenka.jpg", { type: "image/jpeg" });
    if (cropModeRef.current === "scan") {
      cropModeRef.current = "attach";
      setIsCropOpen(false);
      setCropSrc(null);
      runScan(croppedFile, previewUrl);
      return;
    }
    setReceiptFile(croppedFile);
    setReceiptPreview(previewUrl);
    setRemoveReceipt(false);
    setIsCropOpen(false);
    setCropSrc(null);
    console.log("Účtenka ořezána, velikost:", croppedFile.size);
  };

  const handleCropCancel = () => {
    cropModeRef.current = "attach";
    setIsCropOpen(false);
    setCropSrc(null);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-bold">Finance</h1>
        {canAddTransactions && (
          <div className="flex gap-2 flex-wrap justify-end">
            <Button
              size="sm"
              variant="outline"
              className="px-2.5"
              onClick={openScan}
              aria-label="Načíst z účtenky"
              title="Načíst z účtenky"
            >
              <ScanLine className="w-4 h-4" />
            </Button>
            {speechSupported && (
              <Button
                size="sm"
                variant="outline"
                className="px-2.5"
                onClick={() => setIsVoiceOpen(true)}
                aria-label="Zadat hlasem"
                title="Zadat hlasem"
              >
                <Mic className="w-4 h-4" />
              </Button>
            )}
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsImportOpen(true)}
              >
                <FileSpreadsheet className="w-4 h-4 mr-1" />
                Import
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="text-income border-income hover:bg-income/10"
              onClick={() => openDialog("income")}
            >
              <Plus className="w-4 h-4 mr-1" />
              Příjem
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-expense border-expense hover:bg-expense/10"
              onClick={() => openDialog("expense")}
            >
              <Plus className="w-4 h-4 mr-1" />
              Výdaj
            </Button>
          </div>
        )}
      </div>

      {/* Filtr typ */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">Vše</TabsTrigger>
          <TabsTrigger value="income" className="text-income data-[state=active]:text-income">
            Příjmy
          </TabsTrigger>
          <TabsTrigger value="expense" className="text-expense data-[state=active]:text-expense">
            Výdaje
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filtry rok a kategorie */}
      <div className="flex gap-2 flex-wrap">
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[130px]">
            <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Rok" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechny roky</SelectItem>
            {availableYears.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[180px]">
            <Tag className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Kategorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Kategorie</SelectItem>
            {availableCategories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Platba" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Typ platby</SelectItem>
            <SelectItem value="cash">💵 Hotovost</SelectItem>
            <SelectItem value="bank">🏦 Banka</SelectItem>
          </SelectContent>
        </Select>

        {(selectedYear !== String(CURRENT_YEAR) || selectedCategory !== "all" || selectedPaymentMethod !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedYear(String(CURRENT_YEAR));
              setSelectedCategory("all");
              setSelectedPaymentMethod("all");
            }}
            className="text-muted-foreground"
          >
            <X className="w-4 h-4 mr-1" />
            Zrušit filtry
          </Button>
        )}
      </div>

      {/* Souhrn filtrovaných transakcí */}
      {transactions && transactions.length > 0 && (
        <Card className="bg-muted/50">
          <CardContent className="py-3 px-4">
            {(() => {
              const inc = transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
              const exp = transactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
              const balance = inc - exp;
              return (
                <div className="flex justify-between items-center text-sm">
                  <span className={`text-base font-bold ${balance >= 0 ? "text-income" : "text-expense"}`}>
                    {balance >= 0 ? "+" : ""}{formatCurrency(balance)}
                  </span>
                  <div className="flex gap-4 items-center">
                    <span className="text-income font-medium">+{formatCurrency(inc)}</span>
                    <span className="text-expense font-medium">-{formatCurrency(exp)}</span>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Seznam transakcí */}
      <div className="space-y-3">
        {transactions && transactions.length > 0 ? (
          transactions.map((transaction) => (
            <Card key={transaction._id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center mt-0.5",
                        transaction.type === "income"
                          ? "bg-income/10"
                          : "bg-expense/10"
                      )}
                    >
                      {transaction.type === "income" ? (
                        <ArrowUpRight className="w-5 h-5 text-income" />
                      ) : (
                        <ArrowDownRight className="w-5 h-5 text-expense" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{transaction.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {transaction.category}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 flex-wrap">
                        {formatDate(transaction.date)}
                        <span className="mx-1">•</span>
                        {transaction.paymentMethod === "bank" ? (
                          <span className="flex items-center gap-0.5">
                            <Building2 className="w-3 h-3" /> Banka
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5">
                            <Banknote className="w-3 h-3" /> Hotovost
                          </span>
                        )}
                        {transaction.type === "expense" && transaction.reimbursed && (
                          <>
                            <span className="mx-1">•</span>
                            <span className="text-income font-medium flex items-center gap-0.5">
                              <Check className="w-3 h-3" /> Proplaceno
                            </span>
                          </>
                        )}
                        {transaction.receiptStorageId && (
                          <>
                            <span className="mx-1">•</span>
                            <ReceiptLink
                              storageId={transaction.receiptStorageId}
                              onView={(url) => setViewReceiptUrl(url)}
                            />
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <p
                      className={cn(
                        "text-lg font-bold",
                        transaction.type === "income"
                          ? "text-income"
                          : "text-expense"
                      )}
                    >
                      {transaction.type === "income" ? "+" : "-"}
                      {formatCurrency(transaction.amount)}
                    </p>
                    {(isAdmin || (isDeputy && transaction.createdBy === currentUserId)) && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => openEditDialog(transaction)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(transaction._id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                {activeTab === "all"
                  ? "Zatím žádné transakce"
                  : activeTab === "income"
                  ? "Zatím žádné příjmy"
                  : "Zatím žádné výdaje"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog pro přidání transakce */}
      <VoiceTransactionDialog
        open={isVoiceOpen}
        onOpenChange={setIsVoiceOpen}
        onResult={handleVoiceResult}
        processing={voiceProcessing}
      />

      {/* Načtení transakce z účtenky */}
      <Dialog open={isScanOpen} onOpenChange={(open) => !scanBusy && setIsScanOpen(open)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="w-5 h-5" />
              Načíst z účtenky
            </DialogTitle>
          </DialogHeader>

          {scanFile && (
            <img
              src={scanFile.preview}
              alt="Účtenka"
              className="w-full max-h-48 object-contain rounded-lg border"
            />
          )}

          {scanBusy ? (
            <p className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Čtu účtenku…
            </p>
          ) : (
            <>
              {scanError && (
                <p className="text-sm text-destructive text-center">{scanError}</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" className="flex items-center gap-2" onClick={() => pickScanPhoto(true)}>
                  <Camera className="w-4 h-4" />
                  Vyfotit
                </Button>
                <Button type="button" variant="outline" className="flex items-center gap-2" onClick={() => pickScanPhoto(false)}>
                  <Receipt className="w-4 h-4" />
                  Galerie
                </Button>
              </div>
              {scanError && scanFile && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setIsScanOpen(false);
                    openPrefilledDialog({ type: "expense" }, scanFile);
                  }}
                >
                  Zadat ručně s touto účtenkou
                </Button>
              )}
            </>
          )}
          <input
            ref={scanInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleScanFileChange}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {transactionType === "income" ? (
                <>
                  <TrendingUp className="w-5 h-5 text-income" />
                  {editingId ? "Upravit příjem" : "Nový příjem"}
                </>
              ) : (
                <>
                  <TrendingDown className="w-5 h-5 text-expense" />
                  {editingId ? "Upravit výdaj" : "Nový výdaj"}
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Částka (Kč)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="1000"
                value={formData.amount}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, amount: e.target.value }))
                }
                required
                min="0"
                step="0.01"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Popis</Label>
              <Input
                id="description"
                type="text"
                placeholder="Popis transakce"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Kategorie</Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, category: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte kategorii" />
                </SelectTrigger>
                <SelectContent>
                  {categoryList.length > 0 ? (
                    categoryList.map((cat) => (
                      <SelectItem key={cat._id} value={cat.name}>
                        {cat.name}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                      Žádné kategorie. Přidejte je v Nastavení.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Datum</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, date: e.target.value }))
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Způsob platby</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={formData.paymentMethod === "cash" ? "default" : "outline"}
                  className={cn(
                    "flex items-center gap-2",
                    formData.paymentMethod === "cash" && "bg-primary"
                  )}
                  onClick={() => setFormData((prev) => ({ ...prev, paymentMethod: "cash" }))}
                >
                  <Banknote className="w-4 h-4" />
                  Hotovost
                </Button>
                <Button
                  type="button"
                  variant={formData.paymentMethod === "bank" ? "default" : "outline"}
                  className={cn(
                    "flex items-center gap-2",
                    formData.paymentMethod === "bank" && "bg-primary"
                  )}
                  onClick={() => setFormData((prev) => ({ ...prev, paymentMethod: "bank" }))}
                >
                  <Building2 className="w-4 h-4" />
                  Banka
                </Button>
              </div>
            </div>

            {transactionType === "expense" && (
              <div className="flex items-center gap-3 py-1">
                <Checkbox
                  id="reimbursed"
                  checked={formData.reimbursed}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, reimbursed: !!checked }))
                  }
                />
                <Label htmlFor="reimbursed" className="cursor-pointer font-normal">
                  Výdaj byl proplacen
                </Label>
              </div>
            )}

            {/* Foto účtenky */}
            <div className="space-y-2">
              <Label>Foto účtenky</Label>
              {/* Existující účtenka při editaci */}
              {existingReceiptStorageId && !removeReceipt && !receiptPreview && (
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                  <Receipt className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm flex-1">Účtenka je přiložena</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => setRemoveReceipt(true)}
                  >
                    <X className="w-3 h-3 mr-1" /> Odebrat
                  </Button>
                </div>
              )}
              {removeReceipt && (
                <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded-lg">
                  <span className="text-sm text-destructive flex-1">Účtenka bude odstraněna</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setRemoveReceipt(false)}
                  >
                    Vrátit zpět
                  </Button>
                </div>
              )}
              {/* Náhled nově vybrané fotky */}
              {receiptPreview && (
                <div className="relative">
                  <img
                    src={receiptPreview}
                    alt="Náhled účtenky"
                    className="w-full max-h-40 object-contain rounded-lg border"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 h-7 w-7 bg-background/80 hover:bg-background"
                    onClick={() => {
                      setReceiptFile(null);
                      setReceiptPreview(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
              {/* Tlačítka pro výběr fotky */}
              {!receiptPreview && !(existingReceiptStorageId && !removeReceipt) && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex items-center gap-2"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.removeAttribute("capture");
                        fileInputRef.current.click();
                      }
                    }}
                  >
                    <Receipt className="w-4 h-4" />
                    Galerie
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex items-center gap-2"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.setAttribute("capture", "environment");
                        fileInputRef.current.click();
                      }
                    }}
                  >
                    <Camera className="w-4 h-4" />
                    Fotoaparát
                  </Button>
                </div>
              )}
              {existingReceiptStorageId && !removeReceipt && !receiptPreview && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-sm"
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.removeAttribute("capture");
                      fileInputRef.current.click();
                    }
                  }}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Nahradit účtenku
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleReceiptChange}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setIsDialogOpen(false)}
              >
                Zrušit
              </Button>
              <Button
                type="submit"
                className={cn(
                  "flex-1",
                  transactionType === "income"
                    ? "bg-income hover:bg-income/90"
                    : "bg-expense hover:bg-expense/90"
                )}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : editingId ? (
                  "Uložit"
                ) : (
                  "Přidat"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      <ImportExcelDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        type="transactions"
      />

      {/* Ořez účtenky */}
      {cropSrc && (
        <ReceiptCropper
          imageSrc={cropSrc}
          open={isCropOpen}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}

      {/* Zobrazení účtenky */}
      <Dialog open={!!viewReceiptUrl} onOpenChange={(open) => !open && setViewReceiptUrl(null)}>
        <DialogContent className="sm:max-w-lg p-2">
          <DialogHeader className="p-2">
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Účtenka
            </DialogTitle>
          </DialogHeader>
          {viewReceiptUrl && (
            <img
              src={viewReceiptUrl}
              alt="Účtenka"
              className="w-full rounded-lg object-contain max-h-[70vh]"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReceiptLink({
  storageId,
  onView,
}: {
  storageId: Id<"_storage">;
  onView: (url: string) => void;
}) {
  const url = useQuery(api.media.getReceiptUrl, { storageId });
  return (
    <button
      type="button"
      className="flex items-center gap-0.5 text-primary underline underline-offset-2 hover:text-primary/80 transition-colors disabled:opacity-50"
      onClick={() => url && onView(url)}
      disabled={!url}
    >
      <Receipt className="w-3 h-3" />
      Účtenka
    </button>
  );
}
