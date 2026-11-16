# SDH Hospodaření

Mobilní webová aplikace pro sledování hospodaření SDH Bor: příjmy a výdaje (hotovost i banka), účtenky, členové a příspěvky, výkazy, PDF pro valnou hromadu, import a export Excelu a záloha na Google Drive.

- **Frontend:** Next.js + React, sestavený jako statický web (`output: "export"`) → složka `out/`
- **Backend a databáze:** [Convex](https://convex.dev) (cloud)
- **Přihlášení:** e-mail a heslo (Convex Auth), reset hesla kódem e-mailem
- **E-maily:** [Resend](https://resend.com)
- **Hosting:** Wedos webhosting. GitHub Actions při každém pushi do `main` nasadí backend do Convexu a statické soubory nahraje přes FTP.

Role: hospodář (admin), zástupce hospodáře (deputy), tajemník (secretary) a člen. Nový uživatel čeká, dokud ho správce neschválí v Nastavení → Uživatelé.

---

## Převod z Macaly – postup

### 1. Vlastní Convex projekt
1. Založ si účet na https://dashboard.convex.dev (stačí free tarif).
2. Lokálně:
   ```bash
   npm install
   npx convex dev          # vytvoří projekt a dev deployment a zapíše .env.local
   ```
3. Nastav přihlašování pro produkci (vygeneruje `JWT_PRIVATE_KEY`, `JWKS` a `SITE_URL`):
   ```bash
   npx @convex-dev/auth --prod
   ```
   Na dotaz na `SITE_URL` zadej `https://app1.sdhbor.cz`.

### 2. Proměnné prostředí v Convexu (produkce)
Dashboard → projekt → Production → Settings → Environment Variables:

| Proměnná | Hodnota |
|---|---|
| `RESEND_API_KEY` | API klíč z Resend |
| `EMAIL_FROM` | např. `SDH Bor <pokladna@sdhbor.cz>`. Doména musí být ověřená v Resend. |
| `RECIPIENT_EMAIL` | komu chodí upozornění na nové registrace |
| `APP_NAME` | `SDH Hospodaření` (volitelné) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `GOOGLE_DRIVE_FOLDER_ID` | stejné jako dosud, pokud chceš zálohu na Drive |

Proměnné `EMAIL_NOTIFICATION_ENDPOINT`, `OTP_ENDPOINT`, `CHAT_ID` a `SECRET_KEY` patřily službě Macaly a už se nepoužívají.

### 3. Přenos dat
**Varianta A (doporučená): máš přístup k Convex deploymentu, který používá Macaly** (deploy key nebo přístup do dashboardu):
```bash
# export ze starého deploymentu, včetně účtenek
CONVEX_DEPLOY_KEY="<klíč starého deploymentu>" npx convex export --path zaloha.zip --include-file-storage
# import do nového produkčního deploymentu
npx convex import --prod --replace-all zaloha.zip
```
Přenesou se i uživatelé a jejich hesla. Všichni se jen jednou znovu přihlásí.

**Varianta B: přístup nemáš.** Ve staré aplikaci si stáhni export do Excelu a v nové ho importuj (Finance → Import, Členové → Import). Uživatelé se zaregistrují znovu a první registrovaný se stane hospodářem. Účtenky se tímhle způsobem nepřenesou.

### 4. GitHub
1. Založ **soukromý** repozitář a pushni do něj tento projekt (větev `main`).
2. Settings → Secrets and variables → Actions → New repository secret:

| Secret | Hodnota |
|---|---|
| `CONVEX_DEPLOY_KEY` | Convex Dashboard → Production → Settings → Deploy Keys → Generate |
| `FTP_SERVER` | FTP server z administrace Wedos |
| `FTP_USERNAME` | FTP uživatel |
| `FTP_PASSWORD` | FTP heslo |
| `FTP_SERVER_DIR` | cílová složka, u subdomény typicky `/www/subdom/app1/` (musí končit lomítkem) |

3. Po pushi do `main` (nebo ručně: Actions → Nasazení na Wedos → Run workflow) se aplikace nasadí.

### 5. Wedos a doména
1. V administraci Wedos založ subdoménu `app1` pro `sdhbor.cz` a ověř, do které složky míří.
2. Zapni SSL certifikát (Let's Encrypt) pro `app1.sdhbor.cz`.
3. Až nová verze funguje, přepni DNS záznam `app1.sdhbor.cz` z Macaly na Wedos.

---

## Vývoj

```bash
npm install
npx convex dev   # v jednom terminálu (backend, sleduje změny v convex/)
npm run dev      # ve druhém terminálu (frontend na http://localhost:3000)
npm run build    # statický build do out/
```
