"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  User,
  Mail,
  Phone,
  Calendar,
  Check,
  X,
  Loader2,
  ChevronRight,
  UserPlus,
  CreditCard,
  Filter,
  Users,
  Baby,
  Pencil,
  FileSpreadsheet,
  Banknote,
  Building2,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ImportExcelDialog } from "@/components/import-excel-dialog";

type MemberType = "man" | "woman" | "child";
type TypeFilter = "all" | MemberType;
type PaymentFilter = "all" | "paid" | "unpaid" | "exempt";
type PaymentMethodFilter = "all" | "cash" | "bank";
type AgeFilter = "all" | "over60";

const THIS_YEAR = new Date().getFullYear();

const memberTypeLabels: Record<MemberType, string> = {
  man: "Muž",
  woman: "Žena",
  child: "Dítě do 18 let",
};

export function MembersView() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Id<"members"> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<PaymentMethodFilter>("all");
  const [ageFilter, setAgeFilter] = useState<AgeFilter>("all");

  const isAdmin = useQuery(api.userProfiles.isAdmin);
  const isSecretary = useQuery(api.userProfiles.isSecretary);
  const canManageMembers = isAdmin || isSecretary;
  // Vybraný rok příspěvků (výchozí letošní)
  const [currentYear, setCurrentYear] = useState(THIS_YEAR);
  const feeYears = useQuery(api.members.feeYears);
  const minYear = feeYears && feeYears.length > 0 ? Math.min(...feeYears, THIS_YEAR) : THIS_YEAR;
  const allMembers = useQuery(api.members.list, { activeOnly: false, year: currentYear });
  
  // Filtrování členů
  const members = allMembers?.filter((member) => {
    // Filtr podle typu
    if (typeFilter !== "all" && member.memberType !== typeFilter) return false;
    
    // Filtr podle platby
    if (paymentFilter === "paid" && member.currentYearFee?.status !== "paid") return false;
    if (paymentFilter === "unpaid" && member.currentYearFee?.status !== "unpaid") return false;
    if (paymentFilter === "exempt" && member.currentYearFee?.status !== "exempt") return false;

    // Filtr podle způsobu platby příspěvku
    if (paymentMethodFilter !== "all") {
      if (member.currentYearFee?.status !== "paid") return false;
      if (member.currentYearFee?.paymentMethod !== paymentMethodFilter) return false;
    }

    // Filtr podle věku
    if (ageFilter === "over60" && !member.over60) return false;
    
    return true;
  });
  const memberDetail = useQuery(
    api.members.get,
    selectedMember ? { id: selectedMember } : "skip"
  );
  const memberStats = useQuery(api.members.getStats, { year: currentYear });

  const createMember = useMutation(api.members.create);
  const updateMember = useMutation(api.members.update);
  const createFee = useMutation(api.members.createFee);
  const updateFee = useMutation(api.members.updateFee);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    memberType: "man" as MemberType,
    birthDate: "",
    joinedAt: new Date().toISOString().split("T")[0],
    over60: false,
  });

  // Pro editaci v detailu
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    birthDate: "",
    joinedAt: "",
  });

  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat("cs-CZ", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(timestamp));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("cs-CZ", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName) return;

    setIsLoading(true);
    try {
      await createMember({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        memberType: formData.memberType,
        birthDate: formData.birthDate ? new Date(formData.birthDate).getTime() : undefined,
        joinedAt: new Date(formData.joinedAt).getTime(),
        over60: formData.over60,
      });
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        memberType: "man",
        birthDate: "",
        joinedAt: new Date().toISOString().split("T")[0],
        over60: false,
      });
      setIsDialogOpen(false);
    } catch (err) {
      console.log("Error creating member:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (memberId: Id<"members">, active: boolean) => {
    try {
      await updateMember({ id: memberId, active });
    } catch (err) {
      console.log("Error updating member:", err);
    }
  };

  const handleCreateFee = async (memberId: Id<"members">) => {
    try {
      await createFee({
        memberId,
        year: currentYear,
      });
    } catch (err) {
      console.log("Error creating fee:", err);
    }
  };

  const handleMarkAsPaid = async (
    feeId: Id<"membershipFees">,
    paymentMethod: "cash" | "bank"
  ) => {
    try {
      await updateFee({
        id: feeId,
        status: "paid",
        paidAt: Date.now(),
        paymentMethod,
      });
    } catch (err) {
      console.log("Error updating fee:", err);
    }
  };

  const handleMarkAsUnpaid = async (feeId: Id<"membershipFees">) => {
    try {
      await updateFee({
        id: feeId,
        status: "unpaid",
      });
    } catch (err) {
      console.log("Error updating fee:", err);
    }
  };

  const handleStartEdit = () => {
    if (!memberDetail) return;
    setEditData({
      firstName: memberDetail.firstName,
      lastName: memberDetail.lastName,
      email: memberDetail.email || "",
      phone: memberDetail.phone || "",
      birthDate: memberDetail.birthDate ? new Date(memberDetail.birthDate).toISOString().split("T")[0] : "",
      joinedAt: new Date(memberDetail.joinedAt).toISOString().split("T")[0],
    });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedMember || !editData.firstName || !editData.lastName) return;

    setIsLoading(true);
    try {
      await updateMember({
        id: selectedMember,
        firstName: editData.firstName,
        lastName: editData.lastName,
        email: editData.email || undefined,
        phone: editData.phone || undefined,
        birthDate: editData.birthDate ? new Date(editData.birthDate).getTime() : undefined,
        joinedAt: new Date(editData.joinedAt).getTime(),
      });
      setIsEditing(false);
    } catch (err) {
      console.log("Error updating member:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  // Výběr roku a statistiky – na počítači v jednom řádku
  const renderYearSelector = () => (
  <Card className="h-full">
          <CardContent className="py-2 h-full flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentYear((y) => y - 1)}
              disabled={currentYear <= minYear}
              aria-label="Předchozí rok"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <p className="text-base font-semibold">Rok {currentYear}</p>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentYear((y) => y + 1)}
              disabled={currentYear >= THIS_YEAR}
              aria-label="Další rok"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
  );
  const renderStatsCards = () => memberStats && (
      <>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold">{members?.length ?? 0}</p>
            <p className="text-sm text-muted-foreground">Nalezeno členů</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold text-income">
              {memberStats.paidFeesCount}/{memberStats.activeMembers}
            </p>
            <p className="text-sm text-muted-foreground">Zaplaceno {currentYear}</p>
          </CardContent>
        </Card>
      </>
    );

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Členové</h1>
        {isAdmin && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsImportOpen(true)}>
              <FileSpreadsheet className="w-4 h-4 mr-1" />
              Import
            </Button>
            <Button size="sm" onClick={() => setIsDialogOpen(true)}>
              <UserPlus className="w-4 h-4 mr-1" />
              Přidat
            </Button>
          </div>
        )}
      </div>

      {/* Výběr roku příspěvků – telefon */}
      <div className="md:hidden">
        <Card>
          <CardContent className="py-2 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentYear((y) => y - 1)}
              disabled={currentYear <= minYear}
              aria-label="Předchozí rok"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <p className="text-base font-semibold">Rok {currentYear}</p>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentYear((y) => y + 1)}
              disabled={currentYear >= THIS_YEAR}
              aria-label="Další rok"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Počítač: rok a statistiky v jednom řádku */}
      <div className="hidden md:grid md:grid-cols-[220px_1fr_1fr] md:gap-3 md:items-stretch">
        {renderYearSelector()}
        {renderStatsCards()}
      </div>

      {/* Filtry – na počítači v jedné řadě */}
      <div className="space-y-4 md:space-y-0 md:flex md:flex-wrap md:gap-x-6 md:gap-y-3 md:items-end">
      {/* Filtr podle typu */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium">Typ člena</p>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Button
            size="sm"
            variant={typeFilter === "all" ? "default" : "outline"}
            onClick={() => setTypeFilter("all")}
            className="flex-shrink-0"
          >
            <Users className="w-4 h-4 mr-1" />
            Všichni
          </Button>
          <Button
            size="sm"
            variant={typeFilter === "man" ? "default" : "outline"}
            onClick={() => setTypeFilter("man")}
            className="flex-shrink-0"
          >
            Muži
          </Button>
          <Button
            size="sm"
            variant={typeFilter === "woman" ? "default" : "outline"}
            onClick={() => setTypeFilter("woman")}
            className="flex-shrink-0"
          >
            Ženy
          </Button>
          <Button
            size="sm"
            variant={typeFilter === "child" ? "default" : "outline"}
            onClick={() => setTypeFilter("child")}
            className="flex-shrink-0"
          >
            <Baby className="w-4 h-4 mr-1" />
            Děti
          </Button>
        </div>
      </div>

      {/* Filtr podle platby a věku */}
      <div className="flex gap-4 flex-wrap">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Příspěvek {currentYear}</p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={paymentFilter === "all" ? "default" : "outline"}
              onClick={() => setPaymentFilter("all")}
            >
              Vše
            </Button>
            <Button
              size="sm"
              variant={paymentFilter === "paid" ? "default" : "outline"}
              onClick={() => setPaymentFilter("paid")}
              className="text-income border-income/50"
            >
              <Check className="w-3 h-3 mr-1" />
              Zaplaceno
            </Button>
            <Button
              size="sm"
              variant={paymentFilter === "unpaid" ? "default" : "outline"}
              onClick={() => setPaymentFilter("unpaid")}
              className="text-expense border-expense/50"
            >
              <X className="w-3 h-3 mr-1" />
              Nezaplaceno
            </Button>
            <Button
              size="sm"
              variant={paymentFilter === "exempt" ? "default" : "outline"}
              onClick={() => setPaymentFilter("exempt")}
              className="text-amber-500 border-amber-500/50"
            >
              Osvobozeni
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Způsob platby příspěvku</p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={paymentMethodFilter === "all" ? "default" : "outline"}
              onClick={() => setPaymentMethodFilter("all")}
            >
              Vše
            </Button>
            <Button
              size="sm"
              variant={paymentMethodFilter === "cash" ? "default" : "outline"}
              onClick={() => setPaymentMethodFilter("cash")}
            >
              <Banknote className="w-3 h-3 mr-1" />
              Hotovost
            </Button>
            <Button
              size="sm"
              variant={paymentMethodFilter === "bank" ? "default" : "outline"}
              onClick={() => setPaymentMethodFilter("bank")}
            >
              <Building2 className="w-3 h-3 mr-1" />
              Banka
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Věk</p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={ageFilter === "all" ? "default" : "outline"}
              onClick={() => setAgeFilter("all")}
            >
              Vše
            </Button>
            <Button
              size="sm"
              variant={ageFilter === "over60" ? "default" : "outline"}
              onClick={() => setAgeFilter("over60")}
              className="text-amber-400 border-amber-500/50"
            >
              60+
            </Button>
          </div>
        </div>
      </div>
      </div>

      {/* Statistiky – telefon */}
      <div className="md:hidden">
        {memberStats && (
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-2xl font-bold">{members?.length ?? 0}</p>
                <p className="text-sm text-muted-foreground">
                  Nalezeno členů
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-2xl font-bold text-income">
                  {memberStats.paidFeesCount}/{memberStats.activeMembers}
                </p>
                <p className="text-sm text-muted-foreground">Zaplaceno {currentYear}</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Seznam členů – na počítači ve sloupcích */}
      <div className="space-y-2 md:space-y-0 md:grid md:grid-cols-2 xl:grid-cols-3 md:gap-2">
        {members && members.length > 0 ? (
          members.map((member) => (
            <Card
              key={member._id}
              className={cn(
                "cursor-pointer transition-colors hover:bg-muted/50",
                !member.active && "opacity-60"
              )}
              onClick={() => setSelectedMember(member._id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xl">
                      {member.memberType === "woman" ? "👩" : member.memberType === "child" ? "👦" : "👨"}
                    </div>
                    <div>
                      <p className="font-medium">{member.lastName} {member.firstName}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {member.memberType && (
                          <Badge variant="outline" className="text-xs">
                            {memberTypeLabels[member.memberType]}
                          </Badge>
                        )}
                        {member.over60 && (
                          <Badge variant="outline" className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30">
                            60+
                          </Badge>
                        )}
                        {!member.active && (
                          <Badge variant="secondary" className="text-xs">
                            Neaktivní
                          </Badge>
                        )}
                        {member.currentYearFee ? (
                          <>
                            <Badge
                              variant={
                                member.currentYearFee.status === "paid" || member.currentYearFee.status === "exempt"
                                  ? "default"
                                  : "destructive"
                              }
                              className={cn(
                                "text-xs",
                                member.currentYearFee.status === "paid" && "bg-income hover:bg-income/90",
                                member.currentYearFee.status === "exempt" && "bg-amber-500/80 hover:bg-amber-500/70"
                              )}
                            >
                              {member.currentYearFee.status === "paid"
                                ? "Zaplaceno"
                                : member.currentYearFee.status === "exempt"
                                ? "Osvobozeni"
                                : "Nezaplaceno"}
                            </Badge>
                            {member.currentYearFee.status === "paid" && member.currentYearFee.paymentMethod && (
                              <Badge variant="outline" className="text-xs flex items-center gap-0.5">
                                {member.currentYearFee.paymentMethod === "bank" ? (
                                  <><Building2 className="w-3 h-3" /> Banka</>
                                ) : (
                                  <><Banknote className="w-3 h-3" /> Hotovost</>
                                )}
                              </Badge>
                            )}
                          </>
                        ) : member.over60 ? (
                          <Badge className="text-xs bg-amber-500/80 hover:bg-amber-500/70">
                            Osvobozeni
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Bez příspěvku {currentYear}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="md:col-span-full">
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Zatím žádní členové</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog pro přidání člena */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Nový člen
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">Jméno *</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="Jan"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, firstName: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Příjmení *</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Novák"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, lastName: e.target.value }))
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="jan@email.cz"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+420 123 456 789"
                value={formData.phone}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, phone: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="birthDate">Datum narození</Label>
              <Input
                id="birthDate"
                type="date"
                value={formData.birthDate}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, birthDate: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Typ člena *</Label>
              <Select
                value={formData.memberType}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, memberType: value as MemberType }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte typ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="man">Muž</SelectItem>
                  <SelectItem value="woman">Žena</SelectItem>
                  <SelectItem value="child">Dítě do 18 let</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="joinedAt">Datum vstupu</Label>
              <Input
                id="joinedAt"
                type="date"
                value={formData.joinedAt}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, joinedAt: e.target.value }))
                }
                required
              />
            </div>

            <div className="flex items-center space-x-3 py-2">
              <Checkbox
                id="over60"
                checked={formData.over60}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, over60: checked === true }))
                }
              />
              <Label htmlFor="over60" className="text-sm font-normal cursor-pointer">
                Věk nad 60 let
              </Label>
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
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Přidat"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail člena */}
      <Sheet
        open={!!selectedMember}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedMember(null);
            setIsEditing(false);
          }
        }}
      >
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {memberDetail && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p>{memberDetail.lastName} {memberDetail.firstName}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge
                        variant={memberDetail.active ? "default" : "secondary"}
                      >
                        {memberDetail.active ? "Aktivní" : "Neaktivní"}
                      </Badge>
                      {memberDetail.memberType && (
                        <Badge variant="outline">
                          {memberTypeLabels[memberDetail.memberType]}
                        </Badge>
                      )}
                      {memberDetail.over60 && (
                        <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                          60+
                        </Badge>
                      )}
                    </div>
                  </div>
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Kontaktní údaje - editační nebo zobrazovací režim */}
                {isEditing ? (
                  <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="edit-firstName">Jméno *</Label>
                        <Input
                          id="edit-firstName"
                          type="text"
                          value={editData.firstName}
                          onChange={(e) =>
                            setEditData((prev) => ({ ...prev, firstName: e.target.value }))
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-lastName">Příjmení *</Label>
                        <Input
                          id="edit-lastName"
                          type="text"
                          value={editData.lastName}
                          onChange={(e) =>
                            setEditData((prev) => ({ ...prev, lastName: e.target.value }))
                          }
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-email">E-mail</Label>
                      <Input
                        id="edit-email"
                        type="email"
                        value={editData.email}
                        onChange={(e) =>
                          setEditData((prev) => ({ ...prev, email: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-phone">Telefon</Label>
                      <Input
                        id="edit-phone"
                        type="tel"
                        value={editData.phone}
                        onChange={(e) =>
                          setEditData((prev) => ({ ...prev, phone: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-birthDate">Datum narození</Label>
                      <Input
                        id="edit-birthDate"
                        type="date"
                        value={editData.birthDate}
                        onChange={(e) =>
                          setEditData((prev) => ({ ...prev, birthDate: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-joinedAt">Datum vstupu</Label>
                      <Input
                        id="edit-joinedAt"
                        type="date"
                        value={editData.joinedAt}
                        onChange={(e) =>
                          setEditData((prev) => ({ ...prev, joinedAt: e.target.value }))
                        }
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={handleCancelEdit}
                      >
                        Zrušit
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={handleSaveEdit}
                        disabled={isLoading}
                      >
                        {isLoading ? "Ukládám..." : "Uložit"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {memberDetail.email && (
                      <div className="flex items-center gap-3 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span>{memberDetail.email}</span>
                      </div>
                    )}
                    {memberDetail.phone && (
                      <div className="flex items-center gap-3 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{memberDetail.phone}</span>
                      </div>
                    )}
                    {memberDetail.birthDate && (
                      <div className="flex items-center gap-3 text-sm">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>Narozen/a {formatDate(memberDetail.birthDate)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>Členem od {formatDate(memberDetail.joinedAt)}</span>
                    </div>
                    {canManageMembers && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={handleStartEdit}
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Upravit údaje
                      </Button>
                    )}
                  </div>
                )}

                {/* Členské příspěvky */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Členské příspěvky
                    </h3>
                    {canManageMembers && !memberDetail.fees?.find((f) => f.year === currentYear) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCreateFee(memberDetail._id)}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        {currentYear}
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {memberDetail.fees && memberDetail.fees.length > 0 ? (
                      memberDetail.fees.map((fee) => (
                        <div
                          key={fee._id}
                          className="p-3 bg-muted/50 rounded-lg space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{fee.year}</p>
                              <p className="text-sm text-muted-foreground">
                                {fee.status === "exempt" ? "Osvobozeno (60+)" : formatCurrency(fee.amount)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={fee.status === "paid" || fee.status === "exempt" ? "default" : "destructive"}
                                className={cn(
                                  fee.status === "paid" && "bg-income hover:bg-income/90",
                                  fee.status === "exempt" && "bg-amber-500/80 hover:bg-amber-500/70"
                                )}
                              >
                                {fee.status === "paid" ? "Zaplaceno" : fee.status === "exempt" ? "Neplatí" : "Nezaplaceno"}
                              </Badge>
                            </div>
                          </div>
                          
                          {/* Zobrazení způsobu platby */}
                          {fee.status === "paid" && fee.paymentMethod && (
                            <p className="text-xs text-muted-foreground">
                              Placeno: {fee.paymentMethod === "cash" ? "💵 Hotově" : "🏦 Na účet"}
                              {fee.paidAt && ` • ${formatDate(fee.paidAt)}`}
                            </p>
                          )}
                          
                          {/* Akce pro admina/tajemníka */}
                          {canManageMembers && fee.status === "unpaid" && (
                            <div className="flex gap-2 pt-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-income border-income/50 hover:bg-income/10"
                                onClick={() => handleMarkAsPaid(fee._id, "cash")}
                              >
                                💵 Hotově
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-income border-income/50 hover:bg-income/10"
                                onClick={() => handleMarkAsPaid(fee._id, "bank")}
                              >
                                🏦 Na účet
                              </Button>
                            </div>
                          )}
                          
                          {canManageMembers && fee.status === "paid" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="w-full text-muted-foreground"
                              onClick={() => handleMarkAsUnpaid(fee._id)}
                            >
                              <X className="w-3 h-3 mr-1" />
                              Zrušit platbu
                            </Button>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Žádné příspěvky
                      </p>
                    )}
                  </div>
                </div>

                {/* Akce pro admina/tajemníka */}
                {canManageMembers && (
                  <div className="pt-4 border-t space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-normal">Typ člena</Label>
                      <Select
                        value={memberDetail.memberType ?? "man"}
                        onValueChange={(value) =>
                          updateMember({ id: memberDetail._id, memberType: value as MemberType })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="man">Muž</SelectItem>
                          <SelectItem value="woman">Žena</SelectItem>
                          <SelectItem value="child">Dítě do 18 let</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="over60-detail" className="text-sm font-normal">
                        Věk nad 60 let
                      </Label>
                      <Checkbox
                        id="over60-detail"
                        checked={memberDetail.over60 ?? false}
                        onCheckedChange={(checked) =>
                          updateMember({ id: memberDetail._id, over60: checked === true })
                        }
                      />
                    </div>
                    <Button
                      variant={memberDetail.active ? "destructive" : "default"}
                      className="w-full"
                      onClick={() =>
                        handleToggleActive(memberDetail._id, !memberDetail.active)
                      }
                    >
                      {memberDetail.active
                        ? "Deaktivovat člena"
                        : "Aktivovat člena"}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Import dialog */}
      <ImportExcelDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        type="members"
      />
    </div>
  );
}
