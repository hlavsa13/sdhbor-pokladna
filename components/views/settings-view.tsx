"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Trash2,
  Loader2,
  Settings,
  Tag,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Users,
  Shield,
  ShieldCheck,
  User,
  CreditCard,
  Save,
  Clock,
  Check,
  X,
  UserCheck,
  UserX,
  Pencil,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function SettingsView() {
  const [activeTab, setActiveTab] = useState<"income" | "expense">("income");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<Id<"categories"> | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [isLoadingDefaults, setIsLoadingDefaults] = useState(false);
  const [isSavingFees, setIsSavingFees] = useState(false);
  const [feeAdult, setFeeAdult] = useState<number | null>(null);
  const [feeChild, setFeeChild] = useState<number | null>(null);

  const isAdmin = useQuery(api.userProfiles.isAdmin);
  const currentUser = useQuery(api.userProfiles.getCurrentUser);
  const users = useQuery(api.userProfiles.listUsers);
  const incomeCategories = useQuery(api.categories.list, { type: "income" });
  const expenseCategories = useQuery(api.categories.list, { type: "expense" });
  const feeAmounts = useQuery(api.settings.getFeeAmounts);
  const createCategory = useMutation(api.categories.create);
  const removeCategory = useMutation(api.categories.remove);
  const renameCategory = useAction(api.categories.rename);
  const loadDefaults = useMutation(api.categories.loadDefaults);
  const setUserRole = useMutation(api.userProfiles.setUserRole);
  const approveUser = useMutation(api.userProfiles.approveUser);
  const rejectUser = useMutation(api.userProfiles.rejectUser);
  const deleteUser = useMutation(api.userProfiles.deleteUser);
  const updateFeeAmounts = useMutation(api.settings.updateFeeAmounts);

  // Inicializovat lokální stav při načtení hodnot z DB
  if (feeAmounts && feeAdult === null) {
    setFeeAdult(feeAmounts.adult);
    setFeeChild(feeAmounts.child);
  }

  const categories = activeTab === "income" ? incomeCategories : expenseCategories;
  const hasNoCategories = 
    incomeCategories?.length === 0 && expenseCategories?.length === 0;

  const handleLoadDefaults = async () => {
    setIsLoadingDefaults(true);
    try {
      await loadDefaults({});
    } catch (err) {
      console.log("Error loading defaults:", err);
    } finally {
      setIsLoadingDefaults(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    setIsLoading(true);
    try {
      await createCategory({
        name: newCategoryName.trim(),
        type: activeTab,
      });
      setNewCategoryName("");
    } catch (err) {
      console.log("Error creating category:", err);
      alert(err instanceof Error ? err.message : "Chyba při vytváření kategorie");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCategory = async (id: Id<"categories">) => {
    if (!confirm("Opravdu chcete smazat tuto kategorii?")) return;
    try {
      await removeCategory({ id });
    } catch (err) {
      console.log("Error deleting category:", err);
    }
  };

  const handleStartEdit = (id: Id<"categories">, currentName: string) => {
    setEditingCategoryId(id);
    setEditingCategoryName(currentName);
  };

  const handleCancelEdit = () => {
    setEditingCategoryId(null);
    setEditingCategoryName("");
  };

  const handleSaveEdit = async (id: Id<"categories">) => {
    if (!editingCategoryName.trim()) return;
    setIsSavingCategory(true);
    try {
      const result = await renameCategory({ id, name: editingCategoryName });
      console.log(`Kategorie přejmenována, aktualizováno ${result.updatedTransactions} transakcí`);
      setEditingCategoryId(null);
      setEditingCategoryName("");
    } catch (err) {
      console.log("Error renaming category:", err);
      alert(err instanceof Error ? err.message : "Chyba při přejmenování kategorie");
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleRoleChange = async (
    profileId: Id<"userProfiles">,
    newRole: "admin" | "secretary" | "deputy" | "member"
  ) => {
    const roleText = newRole === "admin" ? "hospodáře" : newRole === "secretary" ? "tajemníka" : newRole === "deputy" ? "zástupce hospodáře" : "člena";
    if (!confirm(`Opravdu chcete změnit roli tohoto uživatele na ${roleText}?`)) return;
    
    try {
      await setUserRole({ profileId, role: newRole });
    } catch (err) {
      console.log("Error changing role:", err);
      alert(err instanceof Error ? err.message : "Chyba při změně role");
    }
  };

  const handleApproveUser = async (profileId: Id<"userProfiles">) => {
    if (!confirm("Schválit přístup tohoto uživatele?")) return;
    try {
      await approveUser({ profileId });
    } catch (err) {
      console.log("Error approving user:", err);
      alert(err instanceof Error ? err.message : "Chyba při schvalování");
    }
  };

  const handleDeleteUser = async (profileId: Id<"userProfiles">, name: string) => {
    if (!confirm(`Opravdu chcete smazat uživatele „${name}"? Tato akce je nevratná.`)) return;
    try {
      await deleteUser({ profileId });
    } catch (err) {
      console.log("Error deleting user:", err);
      alert(err instanceof Error ? err.message : "Chyba při mazání uživatele");
    }
  };

  const handleRejectUser = async (profileId: Id<"userProfiles">) => {
    if (!confirm("Zamítnout a smazat žádost tohoto uživatele?")) return;
    try {
      await rejectUser({ profileId });
    } catch (err) {
      console.log("Error rejecting user:", err);
      alert(err instanceof Error ? err.message : "Chyba při zamítání");
    }
  };

  const handleSaveFeeAmounts = async () => {
    if (feeAdult === null || feeChild === null) return;
    
    setIsSavingFees(true);
    try {
      await updateFeeAmounts({
        adult: feeAdult,
        child: feeChild,
      });
    } catch (err) {
      console.log("Error updating fee amounts:", err);
      alert(err instanceof Error ? err.message : "Chyba při ukládání");
    } finally {
      setIsSavingFees(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="py-8 text-center">
            <Settings className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              Nastavení je dostupné pouze pro správce
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Settings className="w-6 h-6" />
        <h1 className="text-xl font-bold">Nastavení</h1>
      </div>

      {/* Kategorie */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Tag className="w-5 h-5" />
            Kategorie transakcí
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tabs pro přepínání mezi příjmy a výdaji */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="income" className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Příjmy
              </TabsTrigger>
              <TabsTrigger value="expense" className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                Výdaje
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Formulář pro přidání kategorie */}
          <form onSubmit={handleAddCategory} className="flex gap-2">
            <Input
              placeholder="Název nové kategorie"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={isLoading || !newCategoryName.trim()}
              className={cn(
                activeTab === "income"
                  ? "bg-income hover:bg-income/90"
                  : "bg-expense hover:bg-expense/90"
              )}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </Button>
          </form>

          {/* Tlačítko pro načtení výchozích kategorií */}
          {hasNoCategories && (
            <Button
              variant="outline"
              className="w-full"
              onClick={handleLoadDefaults}
              disabled={isLoadingDefaults}
            >
              {isLoadingDefaults ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Načíst výchozí kategorie
            </Button>
          )}

          {/* Seznam kategorií */}
          <div className="space-y-2">
            {categories && categories.length > 0 ? (
              categories.map((category) => (
                <div
                  key={category._id}
                  className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg"
                >
                  {editingCategoryId === category._id ? (
                    <>
                      <Input
                        value={editingCategoryName}
                        onChange={(e) => setEditingCategoryName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit(category._id);
                          if (e.key === "Escape") handleCancelEdit();
                        }}
                        className="flex-1 h-8"
                        autoFocus
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-green-600 hover:text-green-700"
                        onClick={() => handleSaveEdit(category._id)}
                        disabled={isSavingCategory || !editingCategoryName.trim()}
                      >
                        {isSavingCategory ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={handleCancelEdit}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="font-medium flex-1">{category.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handleStartEdit(category._id, category.name)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteCategory(category._id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-4">
                Žádné kategorie
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Správa uživatelů a rolí */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5" />
            Uživatelé a oprávnění
            {users && users.filter(u => u.approved === false).length > 0 && (
              <span className="ml-auto text-xs font-normal px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                {users.filter(u => u.approved === false).length} čeká na schválení
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Spravujte přístupy uživatelů k aplikaci. Hospodář může upravovat data, členové mohou pouze prohlížet.
          </p>

          {/* Pending users section */}
          {users && users.filter(u => u.approved === false).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-amber-700 flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                Čekají na schválení
              </h4>
              {users.filter(u => u.approved === false).map((user) => (
                <div
                  key={user._id}
                  className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-amber-100">
                      <User className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="h-8 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleApproveUser(user._id)}
                    >
                      <UserCheck className="w-4 h-4 mr-1" />
                      Schválit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-destructive hover:text-destructive border-destructive/30"
                      onClick={() => handleRejectUser(user._id)}
                    >
                      <UserX className="w-4 h-4 mr-1" />
                      Zamítnout
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Approved users list */}
          <div className="space-y-2">
            {users && users.filter(u => u.approved !== false).length > 0 && (
              <h4 className="text-sm font-semibold text-muted-foreground">
                Schválení uživatelé
              </h4>
            )}
            {users && users.filter(u => u.approved !== false).length > 0 ? (
              users.filter(u => u.approved !== false).map((user) => {
                const isCurrentUser = currentUser?.profile?._id === user._id;
                const isUserAdmin = user.role === "admin";
                const isUserSecretary = user.role === "secretary";
                const isUserDeputy = user.role === "deputy";

                return (
                  <div
                    key={user._id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          isUserAdmin
                            ? "bg-primary/10"
                            : isUserSecretary
                            ? "bg-blue-500/10"
                            : isUserDeputy
                            ? "bg-orange-500/10"
                            : "bg-muted"
                        )}
                      >
                        {isUserAdmin ? (
                          <ShieldCheck className="w-5 h-5 text-primary" />
                        ) : isUserSecretary ? (
                          <Shield className="w-5 h-5 text-blue-500" />
                        ) : isUserDeputy ? (
                          <Shield className="w-5 h-5 text-orange-500" />
                        ) : (
                          <User className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium flex items-center gap-2">
                          {user.name}
                          {isCurrentUser && (
                            <span className="text-xs text-muted-foreground">(vy)</span>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-xs px-2 py-1 rounded-full",
                          isUserAdmin
                            ? "bg-primary/10 text-primary"
                            : isUserSecretary
                            ? "bg-blue-500/10 text-blue-600"
                            : isUserDeputy
                            ? "bg-orange-500/10 text-orange-600"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {isUserAdmin ? "Hospodář" : isUserSecretary ? "Tajemník" : isUserDeputy ? "Zástupce hospodáře" : "Člen"}
                      </span>

                      {!isCurrentUser && (
                        <>
                          <Select
                            value={user.role}
                            onValueChange={(value) =>
                              handleRoleChange(user._id, value as "admin" | "secretary" | "deputy" | "member")
                            }
                          >
                            <SelectTrigger className="h-8 w-28 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Hospodář</SelectItem>
                              <SelectItem value="secretary">Tajemník</SelectItem>
                              <SelectItem value="deputy">Zástupce hospodáře</SelectItem>
                              <SelectItem value="member">Člen</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteUser(user._id, user.name)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              !users || users.filter(u => u.approved === false).length === users?.length ? (
                <p className="text-center text-muted-foreground py-4">
                  Žádní schválení uživatelé
                </p>
              ) : null
            )}
          </div>

          {/* Role descriptions */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Popis rolí
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium">Hospodář</span>
                  <span className="text-muted-foreground">
                    {" "}– může přidávat a upravovat transakce, členy, kategorie a měnit oprávnění
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium">Tajemník</span>
                  <span className="text-muted-foreground">
                    {" "}– může upravovat údaje členů a spravovat členské příspěvky, nemůže přidávat/mazat členy ani spravovat finance
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium">Zástupce hospodáře</span>
                  <span className="text-muted-foreground">
                    {" "}– může přidávat transakce a upravovat/mazat pouze vlastní transakce, nemůže spravovat členy ani nastavení
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <User className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium">Člen</span>
                  <span className="text-muted-foreground">
                    {" "}– může pouze prohlížet data, nemůže nic upravovat
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Nastavení členských příspěvků */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="w-5 h-5" />
            Výše členských příspěvků
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Nastavte výši ročních členských příspěvků. Členové nad 60 let příspěvky neplatí.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="feeAdult">Muži a ženy</Label>
              <div className="relative">
                <Input
                  id="feeAdult"
                  type="number"
                  min="0"
                  value={feeAdult ?? ""}
                  onChange={(e) => setFeeAdult(Number(e.target.value))}
                  className="pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  Kč
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="feeChild">Děti do 18 let</Label>
              <div className="relative">
                <Input
                  id="feeChild"
                  type="number"
                  min="0"
                  value={feeChild ?? ""}
                  onChange={(e) => setFeeChild(Number(e.target.value))}
                  className="pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  Kč
                </span>
              </div>
            </div>
          </div>

          <Button
            onClick={handleSaveFeeAmounts}
            disabled={isSavingFees || feeAdult === null || feeChild === null}
            className="w-full"
          >
            {isSavingFees ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Uložit částky
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
