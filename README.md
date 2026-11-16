# SDH Hospodaření

Mobilní aplikace pro sledování hospodaření sboru dobrovolných hasičů.

## Funkce

### Pro vedení (hospodáře)
- **Evidence příjmů** - dotace, dary, sponzoři, členské příspěvky, akce
- **Evidence výdajů** - vybavení, PHM, údržba, školení, občerstvení
- **Správa členů** - seznam členů, sledování úhrady příspěvků
- **Přehledy** - grafy a statistiky hospodaření

### Pro členy
- **Náhled na hospodaření** - vidí stav pokladny a pohyby
- **Kontrola příspěvků** - vidí stav svých členských příspěvků

## Přístup

- První uživatel, který se zaregistruje, je automaticky nastaven jako správce (hospodář)
- Další uživatelé jsou automaticky členy (mohou pouze prohlížet)
- Přihlášení funguje přes e-mail s jednorázovým kódem (OTP)

## Technologie

- **Frontend:** Next.js + React
- **Databáze:** Convex (real-time)
- **Autentizace:** Convex Auth s OTP
- **Design:** Tailwind CSS, optimalizováno pro mobil
