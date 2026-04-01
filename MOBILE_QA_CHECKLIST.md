# Mobile QA Checklist (360px / 390px)

Pouziti:
- Otevri app ve viewportu 360x800 (Android small) a 390x844 (iPhone 12/13/14).
- Otestuj v obou jazycich: CS a EN.
- Projdi body nize a oznac Pass/Fail.

## 1. Global Navigation (Public Layout)
- [ ] Header nema horizontalni scroll.
- [ ] Logo/nazev je citelny a nezalamuje se nehezky.
- [ ] Jazykove tlacitko je plne klikatelne (min. cca 40x40).
- [ ] Hlavni nav odkazy jsou citelne a bez prekryvu.
- [ ] Pri prihlaseni jsou account/login/register/logout tlacitka citelna a nepretekaji.

## 2. Homepage Gallery (ArtworkList)
- [ ] Search input je plne viditelny a nepada mimo viewport.
- [ ] Sekce filtru STAV je cistelna (tlacitka pod sebou, zadne preteceni textu).
- [ ] Sekce filtru Typ umeleckeho dila je citelna (tlacitka pod sebou).
- [ ] Pocty u STAV reflektuji zvoleny Typ.
- [ ] Pocty u Typ reflektuji zvoleny STAV.
- [ ] Toggle card/list je dobre klikatelny.
- [ ] Karty v card view nemaji useknuty obsah a akce se daji pohodlne kliknout.
- [ ] V list view se meta informace nelamou necitelnym zpusobem.

## 3. Filtered Gallery Pages
- [ ] Type chips jsou na mobilu pod sebou a text je citelny.
- [ ] Clear filters tlacitko je citelne a nepretyka.
- [ ] Search + view toggle se neprekryvaji.
- [ ] V card i list zobrazeni nejsou horizontalni overflow problemy.

## 4. My Account - Author Profile
- [ ] Sekce Biography (CZ/EN) ma obe textarea citelne.
- [ ] Badge Approved/Pending jsou citelne a nepretekaji.
- [ ] Artwork Types seznam je citelny a klikatelny.
- [ ] V EN se u Artwork Types zobrazuje preklad (name_en) kde existuje.

## 5. My Payments
- [ ] Header (nadpis + refresh) je ve sloupci a nic se neprekryva.
- [ ] Filter tlacitka (all/paid/unpaid) jsou full-width a citelna.
- [ ] Tabulka je citelna bez rozpadu layoutu.
- [ ] Klik na nazev dila funguje i na malem displeji.

## 6. Admin - Approvals
- [ ] Filter tlacitka jsou na mobilu pod sebou a full-width.
- [ ] Action tlacitka v tabulkach jsou citelna a klikatelna.
- [ ] Modal footer tlacitka jsou full-width a nepretekaji.

## 7. Admin - Artwork Approvals
- [ ] User dropdown je citelny a full-width.
- [ ] Filter group (status) je pod sebou a citelna.
- [ ] Action tlacitka u dila i eventu jsou citelna.
- [ ] Modal akce jsou full-width.

## 8. Admin - Gallery Manager
- [ ] Filtry a user dropdown jsou citelne na 360px.
- [ ] Tablova i card varianta je pouzitelna bez horizontalniho chaosu.
- [ ] Action tlacitka v tabulce/kartach jsou dobre klikatelna.

## 9. Admin - Payments
- [ ] Summary cards nepretejkaji.
- [ ] Filters jsou pod sebou a citelne.
- [ ] Group header je citelny i pri delsim textu.
- [ ] Table cells a tlacitka jsou pouzitelne na 360px.

## 10. Admin - Profile Approvals
- [ ] Filter tlacitka full-width a citelna.
- [ ] Table action tlacitka pod sebou, bez prekryvu.
- [ ] Modal content se vejde do viewportu bez useknuti akci.

## 11. Language Regression (CS/EN)
- [ ] Zadny klicovy ovladaci prvek nema useknuty text v EN.
- [ ] Cz/En prepinani nerozbije layout v aktualni strance.
- [ ] Artwork type labels se zobrazuji podle jazyka UI v user-facing casti.

## 12. Basic Interaction Regression
- [ ] Zadny click target neni prilis maly (orientacne min. 40x40).
- [ ] Neni horizontalni scrollbar na hlavnich strankach.
- [ ] Neni vizualni jitter/skakani pri hover/active stavech na mobilu.

## Suggested Test Accounts
- Uzivatel s roli user (s artworks, profile bio, payments)
- Uzivatel s roli admin (approvals/payments/gallery manager)

## Final Sign-off
- [ ] 360x800 (CS) PASS
- [ ] 360x800 (EN) PASS
- [ ] 390x844 (CS) PASS
- [ ] 390x844 (EN) PASS
