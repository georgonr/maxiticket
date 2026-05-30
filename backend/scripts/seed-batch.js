'use strict';
// BATCH seed – 6 shows: Divadlo, Šport, Festival, Konferencia, Tanec, Komédia
// Run inside backend container: node /app/scripts/seed-batch.js

const { PrismaClient } = require('@prisma/client');
const sharp = require('sharp');
const { randomUUID } = require('crypto');
const { mkdir } = require('fs/promises');
const { join } = require('path');

const UPLOADS_DIR = '/app/uploads';
const ORGANIZER_ID = 'cmppmvw7q000tct1erm6jf0tb'; // slug "max"
const prisma = new PrismaClient();

// ── Image helpers ─────────────────────────────────────────────────────────────

async function downloadImage(url) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    console.log(`      downloaded ${buf.length} bytes`);
    return buf;
  } catch (err) {
    console.warn(`      [WARN] download failed: ${err.message}`);
    return null;
  }
}

async function makeFallbackBuffer(title) {
  const colours = [
    [99, 102, 241], [245, 158, 11], [16, 185, 129], [236, 72, 153],
    [59, 130, 246], [239, 68, 68],
  ];
  const [r, g, b] = colours[Math.floor(Math.random() * colours.length)];
  try {
    const safe = title.replace(/[<>&"']/g, ' ');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="rgb(${r},${g},${b})"/>
          <stop offset="100%" stop-color="rgb(${Math.max(0, r - 60)},${Math.max(0, g - 60)},${b})"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="1200" fill="url(#g)"/>
      <text x="600" y="600" font-family="Arial,sans-serif" font-size="72" font-weight="bold"
        fill="white" text-anchor="middle" dominant-baseline="middle">${safe}</text>
    </svg>`;
    return await sharp(Buffer.from(svg), { density: 150 }).png().toBuffer();
  } catch {
    return sharp({
      create: { width: 1200, height: 1200, channels: 3, background: { r, g, b } },
    }).png().toBuffer();
  }
}

async function processAndSave(rawBuffer) {
  await mkdir(UPLOADS_DIR, { recursive: true });
  await mkdir(join(UPLOADS_DIR, 'thumbs'), { recursive: true });
  await mkdir(join(UPLOADS_DIR, 'squares'), { recursive: true });

  const id  = randomUUID();
  const fn   = `${id}.webp`;
  const fnT  = `${id}_thumb.webp`;
  const fnSq = `${id}_square.webp`;

  await Promise.all([
    sharp(rawBuffer).resize(1200, 1200, { fit: 'inside', withoutReduction: false }).webp({ quality: 85 }).toFile(join(UPLOADS_DIR, fn)),
    sharp(rawBuffer).resize(600, 400,   { fit: 'cover' }).webp({ quality: 80 }).toFile(join(UPLOADS_DIR, 'thumbs', fnT)),
    sharp(rawBuffer).resize(1000, 1000, { fit: 'cover' }).webp({ quality: 85 }).toFile(join(UPLOADS_DIR, 'squares', fnSq)),
  ]);

  return {
    url:       `/v1/uploads/images/${fn}`,
    thumbUrl:  `/v1/uploads/images/thumbs/${fnT}`,
    squareUrl: `/v1/uploads/images/squares/${fnSq}`,
  };
}

async function fetchOrFallback(picsumN, fallbackTitle) {
  let buf = await downloadImage(`https://picsum.photos/1200/1200?random=${picsumN}`);
  let used = 'picsum';
  if (!buf) {
    buf = await makeFallbackBuffer(fallbackTitle);
    used = 'fallback-svg';
  }
  const stored = await processAndSave(buf);
  return { stored, used };
}

// ── Show builder ──────────────────────────────────────────────────────────────

async function seedShow({ name, slug, description, category, venueName, venueCity,
  venueCapacity, startsAtISO, ticketTypes, picsumNs }) {

  console.log(`\n${'─'.repeat(60)}`);
  console.log(` ${category.toUpperCase()} – ${name}`);
  console.log(`${'─'.repeat(60)}`);

  // Venue
  console.log('  [1] venue...');
  const venue = await prisma.venue.create({
    data: { organizerId: ORGANIZER_ID, name: venueName, city: venueCity, country: 'SK', capacity: venueCapacity },
  });
  console.log(`      id: ${venue.id}`);

  // Show
  console.log('  [2] show...');
  const show = await prisma.show.create({
    data: { organizerId: ORGANIZER_ID, name, slug, description, category, status: 'PUBLISHED', isPromoted: false },
  });
  console.log(`      id:   ${show.id}`);
  console.log(`      slug: ${show.slug}`);

  // Termin
  console.log('  [3] termin...');
  const startsAt = new Date(startsAtISO);
  const termin = await prisma.termin.create({
    data: { showId: show.id, venueId: venue.id, startsAt, status: 'ON_SALE', visible: true, capacity: venueCapacity },
  });
  console.log(`      startsAt: ${termin.startsAt.toISOString()}`);

  // TicketTypes
  console.log('  [4] ticket types...');
  const now = new Date();
  for (let i = 0; i < ticketTypes.length; i++) {
    const tt = ticketTypes[i];
    const created = await prisma.ticketType.create({
      data: {
        terminId: termin.id,
        name: tt.name,
        price: tt.price,
        currency: 'EUR',
        totalQuantity: tt.qty,
        maxPerOrder: tt.maxPerOrder ?? 10,
        saleStartsAt: now,
        saleEndsAt: startsAt,
        sortOrder: i,
      },
    });
    console.log(`      [${i}] ${created.name} – ${created.price} EUR qty:${created.totalQuantity}`);
  }

  // Images
  console.log(`  [5] images (${picsumNs.length})...`);
  const imageRecords = [];
  let failCount = 0;

  for (let i = 0; i < picsumNs.length; i++) {
    const n = picsumNs[i];
    console.log(`    [img ${i + 1}/${picsumNs.length}] picsum?random=${n}`);
    try {
      const { stored, used } = await fetchOrFallback(n, name);
      if (!stored.url.startsWith('/v1/uploads/')) {
        console.error(`    [ANOMALY] Non-relative URL: ${stored.url} – STOPPING`);
        process.exit(1);
      }
      imageRecords.push(stored);
      if (used === 'fallback-svg') failCount++;
      console.log(`      url: ${stored.url} (${used})`);
    } catch (err) {
      failCount++;
      console.error(`    [ERROR] image ${i + 1}: ${err.message}`);
    }
    if (failCount > picsumNs.length) {
      console.error('    [ANOMALY] all images failed – STOPPING');
      await prisma.$disconnect();
      process.exit(1);
    }
  }

  if (imageRecords.length === 0) {
    console.error('  [ANOMALY] 0 images – STOPPING');
    await prisma.$disconnect();
    process.exit(1);
  }

  // ShowImage records
  console.log('  [6] saving ShowImage records...');
  for (let i = 0; i < imageRecords.length; i++) {
    const d = imageRecords[i];
    const img = await prisma.showImage.create({
      data: { showId: show.id, url: d.url, thumbUrl: d.thumbUrl, squareUrl: d.squareUrl, isCover: i === 0, sortOrder: i },
    });
    if (!img.url.startsWith('/v1/uploads/')) {
      console.error(`    [ANOMALY] DB stored non-relative URL! – STOPPING`);
      await prisma.$disconnect();
      process.exit(1);
    }
    console.log(`      [${i}] isCover:${img.isCover} url:${img.url}`);
  }

  console.log(`  ✓ done: ${slug} (${imageRecords.length} images)`);
  return show;
}

// ── Show definitions ──────────────────────────────────────────────────────────

const SHOWS = [
  {
    name:         'Divadelná noc v Košiciach',
    slug:         'test-divadlo-noc-2026',
    description:  'Testovacia divadelná noc – klasická dráma v historickom divadle.',
    category:     'Divadlo',
    venueName:    'Štátne divadlo Košice',
    venueCity:    'Košice',
    venueCapacity: 350,
    startsAtISO:  '2026-07-05T19:00:00+02:00',
    ticketTypes: [
      { name: 'Parket',   price: 20.00, qty: 200 },
      { name: 'Lóža',     price: 55.00, qty: 50, maxPerOrder: 4 },
    ],
    picsumNs: [4, 5, 6],
  },
  {
    name:         'Futbalový zápas – Slovan vs. Spartak',
    slug:         'test-sport-futbal-2026',
    description:  'Testovací futbalový zápas – najlepší slovenský futbal naživo.',
    category:     'Šport',
    venueName:    'Štadión Tehelné pole',
    venueCity:    'Bratislava',
    venueCapacity: 3000,
    startsAtISO:  '2026-07-12T18:00:00+02:00',
    ticketTypes: [
      { name: 'Sezóna',   price:  8.00, qty: 1500, maxPerOrder: 20 },
      { name: 'Tribúna',  price: 20.00, qty: 1000, maxPerOrder: 10 },
      { name: 'VIP box',  price: 80.00, qty:  100, maxPerOrder:  4 },
    ],
    picsumNs: [7, 8, 9],
  },
  {
    name:         'Letný festival Trenčín',
    slug:         'test-festival-leto-2026',
    description:  'Testovací letný festival – tri dni hudby pod holým nebom.',
    category:     'Festival',
    venueName:    'Trenčín Open Air',
    venueCity:    'Trenčín',
    venueCapacity: 5000,
    startsAtISO:  '2026-07-25T14:00:00+02:00',
    ticketTypes: [
      { name: 'Jednodenné',       price: 35.00, qty: 2000, maxPerOrder: 10 },
      { name: 'Celofestivalové',  price: 90.00, qty: 1000, maxPerOrder:  6 },
    ],
    picsumNs: [10, 11, 12],
  },
  {
    name:         'TechBratislava 2026',
    slug:         'test-konferencia-tech-2026',
    description:  'Testovacia technologická konferencia – AI, cloud a budúcnosť softvéru.',
    category:     'Konferencia',
    venueName:    'Incheba Expo Bratislava',
    venueCity:    'Bratislava',
    venueCapacity: 800,
    startsAtISO:  '2026-08-10T09:00:00+02:00',
    ticketTypes: [
      { name: 'Vstup',           price: 60.00, qty: 600, maxPerOrder: 5 },
      { name: 'Vstup + Workshop', price: 120.00, qty: 100, maxPerOrder: 2 },
    ],
    picsumNs: [13, 14],
  },
  {
    name:         'Tanečná šou – Flamenko & Salsa',
    slug:         'test-tanec-show-2026',
    description:  'Testovacia tanečná šou – vášeň a rytmus flamenka a salsy.',
    category:     'Tanec',
    venueName:    'Dom kultúry Žilina',
    venueCity:    'Žilina',
    venueCapacity: 400,
    startsAtISO:  '2026-08-22T20:00:00+02:00',
    ticketTypes: [
      { name: 'Štandard', price: 18.00, qty: 300 },
      { name: 'Premium',  price: 40.00, qty:  80, maxPerOrder: 4 },
    ],
    picsumNs: [15, 16, 17],
  },
  {
    name:         'Stand-up Komédia Night',
    slug:         'test-komedia-night-2026',
    description:  'Testovací stand-up večer – smiech zaručený, hanba zakázaná.',
    category:     'Komédia',
    venueName:    'Klub Nová scéna',
    venueCity:    'Bratislava',
    venueCapacity: 250,
    startsAtISO:  '2026-09-06T21:00:00+02:00',
    ticketTypes: [
      { name: 'Základný',    price: 12.00, qty: 150 },
      { name: 'VIP',         price: 30.00, qty:  60, maxPerOrder: 4 },
      { name: 'VIP + Drink', price: 50.00, qty:  25, maxPerOrder: 2 },
    ],
    picsumNs: [18, 19, 20],
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('  BATCH SEED – 6 shows (Divadlo/Šport/Festival/Konf/Tanec/Kom)');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const createdSlugs = [];

  for (const def of SHOWS) {
    const show = await seedShow(def);
    createdSlugs.push(show.slug);
  }

  // ── Final verification ────────────────────────────────────────────────────
  console.log('\n\n══════════════════════════════════════════════════════════');
  console.log(' BATCH VERIFICATION');
  console.log('══════════════════════════════════════════════════════════');

  const showCount  = await prisma.show.count();
  const imageCount = await prisma.showImage.count();

  // 3 random imageUrl checks
  const samples = await prisma.showImage.findMany({ take: 3, orderBy: { createdAt: 'desc' } });
  const allRelative = samples.every(s => s.url.startsWith('/v1/uploads/'));

  console.log(`\n  Total Show count:      ${showCount}  (expected 7)`);
  console.log(`  Total ShowImage count: ${imageCount}  (expected 15-21)`);
  console.log(`  Sample imageUrl checks (last 3):`);
  for (const s of samples) {
    const ok = s.url.startsWith('/v1/uploads/') ? '✓' : '✗ ANOMALY';
    console.log(`    ${ok}  ${s.url}`);
  }
  console.log(`  All samples relative:  ${allRelative}`);

  const showOk  = showCount === 7;
  const imageOk = imageCount >= 15 && imageCount <= 21;
  const urlOk   = allRelative;

  console.log('\n  Created slugs:');
  for (const s of createdSlugs) console.log(`    • ${s}`);

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log(`  shows=7?      ${showOk  ? '✓ PASS' : '✗ FAIL (' + showCount + ')'}`);
  console.log(`  images 15-21? ${imageOk ? '✓ PASS' : '✗ FAIL (' + imageCount + ')'}`);
  console.log(`  URLs relative?${urlOk   ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  OVERALL: ${showOk && imageOk && urlOk ? '✓ ALL PASS' : '✗ FAILURES DETECTED'}`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (!(showOk && imageOk && urlOk)) {
    await prisma.$disconnect();
    process.exit(1);
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('[FATAL]', err);
  await prisma.$disconnect();
  process.exit(1);
});
