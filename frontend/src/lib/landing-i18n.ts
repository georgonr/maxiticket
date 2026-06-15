'use client';

import { useEffect, useState } from 'react';

// Krok 29: ľahká i18n pre marketingovú homepage (SK/EN). Žiadne hardcoded texty v komponentoch.
export type Lang = 'sk' | 'en';

export interface LandingMessages {
  nav: { events: string; features: string; how: string; login: string; cta: string };
  hero: { badge: string; title1: string; title2: string; subtitle: string; ctaPrimary: string; ctaSecondary: string; cardEvent: string; cardDate: string; cardPrice: string; cardBuy: string };
  features: { heading: string; sub: string; items: { title: string; desc: string }[] };
  steps: { heading: string; sub: string; items: { title: string; desc: string }[] };
  finalCta: { title: string; sub: string; button: string };
  footer: { tagline: string; product: string; company: string; links: { events: string; features: string; how: string; faq: string; organizers: string; contact: string }; rights: string };
}

const sk: LandingMessages = {
  nav: { events: 'Podujatia', features: 'Funkcie', how: 'Ako to funguje', login: 'Prihlásiť', cta: 'Začni zadarmo' },
  hero: {
    badge: 'Predaj vstupeniek pre moderných organizátorov',
    title1: 'Predávaj vstupenky,',
    title2: 'ktoré ľudia milujú.',
    subtitle: 'TicketAll je teplý, jednoduchý nástroj na predaj lístkov online – od malého koncertu po vypredanú halu. Spustíš podujatie za pár minút.',
    ctaPrimary: 'Začni zadarmo',
    ctaSecondary: 'Prezri podujatia',
    cardEvent: 'Letný hudobný večer',
    cardDate: 'Sob · 21:00 · Klub Nu Spirit',
    cardPrice: 'od 12 €',
    cardBuy: 'Kúpiť lístok',
  },
  features: {
    heading: 'Všetko pre predaj na jednom mieste',
    sub: 'Nástroje, ktoré inde platíš zvlášť – u nás v jednom.',
    items: [
      { title: 'AI podpora 24/7', desc: 'Chat asistent pomôže zákazníkom s lístkami a objednávkami kedykoľvek.' },
      { title: 'Skenovanie a check-in', desc: 'Rýchle skenovanie QR pri vstupe – funguje aj offline.' },
      { title: 'Výplaty organizátorom', desc: 'Prehľadné tržby a jednoduché výplaty z predaja.' },
      { title: 'CRM návštevníkov', desc: 'Spoznaj svojich fanúšikov a oslov ich znova.' },
      { title: 'Kupóny a zľavy', desc: 'Promo kódy, zľavy a kampane na pár klikov.' },
      { title: 'Seat mapy', desc: 'Predaj číslovaných sedadiel s vizuálnym plánikom sály.' },
    ],
  },
  steps: {
    heading: '3 kroky k spusteniu podujatia',
    sub: 'Od nápadu k predaju za pár minút.',
    items: [
      { title: 'Povedz nám o podujatí', desc: 'Názov, miesto, dátum – pridáš pár detailov a máš hotovú stránku.' },
      { title: 'Nastav typy lístkov', desc: 'Ceny, kapacity, zľavy alebo seat mapu podľa potreby.' },
      { title: 'Zdieľaj a predávaj', desc: 'Pošli odkaz, predávaj online a sleduj tržby v reálnom čase.' },
    ],
  },
  finalCta: {
    title: 'Tvoje ďalšie podujatie si zaslúži lepší predaj.',
    sub: 'Vytvor podujatie zadarmo. Platíš až keď predávaš.',
    button: 'Začni zadarmo',
  },
  footer: {
    tagline: 'Predaj vstupeniek, ktorý ti sadne.',
    product: 'Produkt',
    company: 'Spoločnosť',
    links: { events: 'Podujatia', features: 'Funkcie', how: 'Ako to funguje', faq: 'Časté otázky', organizers: 'Pre organizátorov', contact: 'Kontakt' },
    rights: 'Všetky práva vyhradené.',
  },
};

const en: LandingMessages = {
  nav: { events: 'Events', features: 'Features', how: 'How it works', login: 'Sign in', cta: 'Start free' },
  hero: {
    badge: 'Ticketing for modern organizers',
    title1: 'Sell tickets',
    title2: 'people love.',
    subtitle: 'TicketAll is a warm, simple way to sell tickets online – from a tiny gig to a sold-out arena. Launch your event in minutes.',
    ctaPrimary: 'Start free',
    ctaSecondary: 'Browse events',
    cardEvent: 'Summer Music Night',
    cardDate: 'Sat · 9:00 PM · Nu Spirit Club',
    cardPrice: 'from €12',
    cardBuy: 'Buy ticket',
  },
  features: {
    heading: 'Everything to sell, in one place',
    sub: 'Tools you pay extra for elsewhere – bundled here.',
    items: [
      { title: 'AI support 24/7', desc: 'A chat assistant helps your buyers with tickets and orders anytime.' },
      { title: 'Scanning & check-in', desc: 'Fast QR scanning at the door – works offline too.' },
      { title: 'Organizer payouts', desc: 'Clear revenue and simple payouts from your sales.' },
      { title: 'Visitor CRM', desc: 'Get to know your fans and reach them again.' },
      { title: 'Coupons & discounts', desc: 'Promo codes, discounts and campaigns in a few clicks.' },
      { title: 'Seat maps', desc: 'Sell numbered seats with a visual venue plan.' },
    ],
  },
  steps: {
    heading: '3 steps to launch your event',
    sub: 'From idea to selling in minutes.',
    items: [
      { title: 'Tell us about the event', desc: 'Name, venue, date – add a few details and your page is ready.' },
      { title: 'Set up ticket types', desc: 'Prices, capacities, discounts or a seat map as needed.' },
      { title: 'Share & sell', desc: 'Share the link, sell online and track revenue in real time.' },
    ],
  },
  finalCta: {
    title: 'Your next event deserves better selling.',
    sub: 'Create your event for free. You pay only when you sell.',
    button: 'Start free',
  },
  footer: {
    tagline: 'Ticketing that feels right.',
    product: 'Product',
    company: 'Company',
    links: { events: 'Events', features: 'Features', how: 'How it works', faq: 'FAQ', organizers: 'For organizers', contact: 'Contact' },
    rights: 'All rights reserved.',
  },
};

export const LANDING_MESSAGES: Record<Lang, LandingMessages> = { sk, en };

/** Jazyk landingu (default SK), perzistovaný v localStorage. */
export function useLandingLang() {
  const [lang, setLangState] = useState<Lang>('sk');
  useEffect(() => {
    const saved = (typeof window !== 'undefined' && localStorage.getItem('mt_lang')) as Lang | null;
    if (saved === 'sk' || saved === 'en') setLangState(saved);
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem('mt_lang', l); } catch { /* ignore */ }
  };
  return { lang, setLang, t: LANDING_MESSAGES[lang] };
}
