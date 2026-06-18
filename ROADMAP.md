# TicketAll — Roadmap (čo zostáva do plnej platformy)

> Living dokument. Stav k: 2026-06-18. Odškrtávaj `- [x]` ako postupujeme.
> Priority: A = kritické (legislatíva + spustenie), B = dôležité (úplnosť),
> C = menej dôležité (polish), D = na koniec (prevádzka/škálovanie), E = samostatná vetva.
> Pozn.: fiškálne/daňové a právne body potvrdiť s účtovníkom/právnikom — nie sú právne poradenstvo.

## Hotové (kostra platformy)
Podujatia/shows/termíny, typy lístkov, seatmapy (SECTIONED/SEATED), checkout (Stripe), guest
checkout, zákaznícke účty + história + PDF doklady, kupóny/zľavy, POS (hotovosť/karta + denná
uzávierka), scanner účty + Android scan app, venues, multi-user organizátor, refundy +
schvaľovanie, zrušenie podujatia, AI asistent, marketingová homepage, plná i18n (SK/EN/CS),
fakturačný systém / provízie (13a–e), metriky/dashboardy.

---

## A) Kritické — legislatíva SK + spustenie
- [ ] **eKasa / VRP — fiškalizácia POS.** Predaj na mieste (hotovosť/karta) musí vystavovať fiškálny
  bloček registrovaný na Finančnej správe. Cesty: VRP (zadarmo od FS, obmedzené API) vs ORP cez
  certifikovaného poskytovateľa (lepšie API). Online Stripe predaj (e-shop) je vo všeobecnosti
  vyňatý → toto je len pre fyzickú POS. POS už eviduje platby + uzávierku, chýba vystavenie bločka.
  TODO: zvoliť VRP vs ORP, overiť aktuálne API. (potvrdiť s účtovníkom/FS)
- [ ] **Platobný terminál na POS (karta na mieste).** (1) samostatný bankový terminál — bez
  integrácie, suma ručne; (2) integrovaný/SoftPOS (Stripe Terminal, SumUp, Global Payments…) —
  POS posiela sumu cez API + potvrdenie. TODO: vybrať poskytovateľa.
- [ ] **Legal stránky** /podmienky (VOP) + /vop + súhlas s VOP/GDPR pri checkoute (over či je
  checkbox). Potrebný reálny právny text + tá istá entita. (skontrolovať právnikom)
- [ ] **Entita + fakturačné údaje.** Vyriešiť MaceT s.r.o. vs MaxiTicket s.r.o. (IČO/DIČ/IČ DPH/
  sídlo/štatutár), vyplniť PLATFORM_* v .env, nechať vzorové vyúčtovanie prejsť účtovníkom.
- [ ] **Automatické zálohovanie DB** (pravidelné; pred ostrým štartom kritické).

## B) Dôležité — úplnosť ticketingu
- [ ] **Automatické refundy cez Stripe API** (teraz manuál cez dashboard).
- [ ] **Reporty/exporty pre organizátora** — zoznam návštevníkov (CSV), predaj v čase, financie/podujatie.
- [ ] **Marketingové e-maily zákazníkom** (opt-in existuje) / newsletter.
- [ ] **Limit lístkov na objednávku/osobu** + podržanie lístkov v košíku (over čo je).
- [ ] (ak treba) **CZK pre českých organizátorov** (viacmenovosť).
- [ ] **Wallet passes** (Apple/Google) — voliteľné.

## C) Menej dôležité — polish / UX
- [ ] Dark-mode redesign staff UI.
- [ ] Plná lokalizácia receipt PDF (teraz SK).
- [ ] Asistent: rate-limit + história konverzácie.
- [ ] REFUND_PENDING filter/odznak v orders UI.
- [ ] UI na organizer.locale (české faktúry).
- [ ] Pagination zoznamu organizátorov (>100).
- [ ] SEO/meta/sitemap pre verejné stránky podujatí.
- [ ] Overiť refund-počítanie vo vyúčtovaní (len reálne platené refundy, nie nezaplatené/expirované).

## D) Na koniec — prevádzka & škálovanie
- [ ] Monitoring/alerting + error tracking (napr. Sentry).
- [ ] Rate limiting / ochrana API proti zneužitiu.
- [ ] Load test.
- [ ] Cron single-instance lock (ak budeme škálovať viac backend inštancií).
- [ ] (neskôr) white-label / custom domény per organizátor, affiliate/resellery.

## E) Samostatná vetva — Android scan app
- [ ] Crash po naskenovaní QR podujatia (real-device, logcat cez USB). App eu.maxiscan.app.

---

## Pred ostrým štartom (poradie podľa aktuálneho plánu)
1. Prepnúť Stripe na sandbox/test mód.
2. Kompletný test v Chrome (nazbieraný checklist) v sandboxe, bugy v dávkach.
3. Vyplniť PLATFORM_* + entita + legal + účtovník.
4. Wipe testovacích dát → čistá DB → späť na Stripe Live → ostrý štart (vrátane zmazania
   testovacej faktúry 20260001).
