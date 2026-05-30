'use strict';
// PILOT seed – 1 show: Hudba / Bratislava
// Run inside backend container: node /app/scripts/seed-pilot.js

const { PrismaClient } = require('@prisma/client');
const sharp = require('sharp');
const { randomUUID } = require('crypto');
const { mkdir } = require('fs/promises');
const { join } = require('path');

const UPLOADS_DIR = '/app/uploads';
const ORGANIZER_ID = 'cmppmvw7q000tct1erm6jf0tb'; // slug "max"
const prisma = new PrismaClient();

// ── Image helpers ────────────────────────────────────────────────────────────

async function downloadImage(url) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    console.log(`    downloaded ${buf.length} bytes`);
    return buf;
  } catch (err) {
    console.warn(`    [WARN] download failed: ${err.message}`);
    return null;
  }
}

async function makeFallbackBuffer(title) {
  // SVG gradient – try first; if sharp has no SVG support fall back to solid colour
  const colours = [
    [99, 102, 241], [245, 158, 11], [16, 185, 129], [236, 72, 153],
  ];
  const [r, g, b] = colours[Math.floor(Math.random() * colours.length)];
  try {
    const safe = title.replace(/[<>&"']/g, ' ');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="rgb(${r},${g},${b})"/>
          <stop offset="100%" stop-color="rgb(${Math.max(0,r-60)},${Math.max(0,g-60)},${b})"/>
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

  const id = randomUUID();
  const fn   = `${id}.webp`;
  const fnT  = `${id}_thumb.webp`;
  const fnSq = `${id}_square.webp`;

  await Promise.all([
    sharp(rawBuffer).resize(1200, 1200, { fit: 'inside', withoutReduction: false }).webp({ quality: 85 }).toFile(join(UPLOADS_DIR, fn)),
    sharp(rawBuffer).resize(600, 400, { fit: 'cover' }).webp({ quality: 80 }).toFile(join(UPLOADS_DIR, 'thumbs', fnT)),
    sharp(rawBuffer).resize(1000, 1000, { fit: 'cover' }).webp({ quality: 85 }).toFile(join(UPLOADS_DIR, 'squares', fnSq)),
  ]);

  return {
    url:      `/v1/uploads/images/${fn}`,
    thumbUrl: `/v1/uploads/images/thumbs/${fnT}`,
    squareUrl:`/v1/uploads/images/squares/${fnSq}`,
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

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log(' PILOT SEED – Hudba / Bratislava');
  console.log('═══════════════════════════════════════════\n');

  // ── 1. Venue ────────────────────────────────────────────────────────────────
  console.log('[1] Creating venue...');
  const venue = await prisma.venue.create({
    data: {
      organizerId: ORGANIZER_ID,
      name: 'Klub Nu Spirit',
      city: 'Bratislava',
      country: 'SK',
      capacity: 500,
    },
  });
  console.log(`    id: ${venue.id}\n`);

  // ── 2. Show ─────────────────────────────────────────────────────────────────
  console.log('[2] Creating show...');
  const show = await prisma.show.create({
    data: {
      organizerId: ORGANIZER_ID,
      name: 'Hudobný večer v Bratislave',
      slug: 'test-hudobny-vecer-2026',
      description: 'Testovací hudobný večer – skvelá živá hudba v srdci Bratislavy.',
      category: 'Hudba',
      status: 'PUBLISHED',
      isPromoted: false,
    },
  });
  console.log(`    id:   ${show.id}`);
  console.log(`    slug: ${show.slug}\n`);

  // ── 3. Termin ───────────────────────────────────────────────────────────────
  console.log('[3] Creating termin...');
  const startsAt = new Date('2026-06-20T20:00:00+02:00');
  const termin = await prisma.termin.create({
    data: {
      showId:   show.id,
      venueId:  venue.id,
      startsAt,
      status:   'ON_SALE',
      visible:  true,
      capacity: 500,
    },
  });
  console.log(`    id:       ${termin.id}`);
  console.log(`    startsAt: ${termin.startsAt.toISOString()}\n`);

  // ── 4. TicketTypes ──────────────────────────────────────────────────────────
  console.log('[4] Creating ticket types...');
  const now = new Date();
  const ttStandard = await prisma.ticketType.create({
    data: {
      terminId:     termin.id,
      name:         'Štandard',
      price:        15.00,
      currency:     'EUR',
      totalQuantity: 200,
      maxPerOrder:  10,
      saleStartsAt: now,
      saleEndsAt:   startsAt,
      sortOrder:    0,
    },
  });
  const ttVip = await prisma.ticketType.create({
    data: {
      terminId:     termin.id,
      name:         'VIP',
      price:        45.00,
      currency:     'EUR',
      totalQuantity: 50,
      maxPerOrder:   4,
      saleStartsAt:  now,
      saleEndsAt:    startsAt,
      sortOrder:     1,
    },
  });
  console.log(`    [0] ${ttStandard.name} – ${ttStandard.price} EUR, qty: ${ttStandard.totalQuantity}`);
  console.log(`    [1] ${ttVip.name}      – ${ttVip.price} EUR, qty: ${ttVip.totalQuantity}\n`);

  // ── 5. Images ───────────────────────────────────────────────────────────────
  console.log('[5] Processing images (cover + 2 gallery, picsum N=1..3)...');
  const imageRecords = [];
  let failCount = 0;

  for (let i = 0; i < 3; i++) {
    const n = i + 1;
    console.log(`  [img ${i + 1}/3] picsum?random=${n}`);
    try {
      const { stored, used } = await fetchOrFallback(n, show.name);
      // Guard: must be relative
      if (!stored.url.startsWith('/v1/uploads/')) {
        console.error(`  [ANOMALY] Non-relative URL: ${stored.url} – STOPPING`);
        process.exit(1);
      }
      imageRecords.push(stored);
      if (used === 'fallback-svg') failCount++;
      console.log(`    url: ${stored.url} (${used})`);
    } catch (err) {
      failCount++;
      console.error(`  [ERROR] image ${i + 1} failed: ${err.message}`);
    }

    if (failCount > 3) {
      console.error('\n[ANOMALY] >3 image failures – STOPPING');
      await prisma.$disconnect();
      process.exit(1);
    }
  }

  if (imageRecords.length === 0) {
    console.error('[ANOMALY] 0 images processed – STOPPING');
    await prisma.$disconnect();
    process.exit(1);
  }

  // ── 6. ShowImage DB records ─────────────────────────────────────────────────
  console.log('\n[6] Saving ShowImage records...');
  for (let i = 0; i < imageRecords.length; i++) {
    const d = imageRecords[i];
    const img = await prisma.showImage.create({
      data: {
        showId:    show.id,
        url:       d.url,
        thumbUrl:  d.thumbUrl,
        squareUrl: d.squareUrl,
        isCover:   i === 0,
        sortOrder: i,
      },
    });
    console.log(`    [${i}] id:${img.id} isCover:${img.isCover} url:${img.url}`);
    if (!img.url.startsWith('/v1/uploads/')) {
      console.error(`    [ANOMALY] DB stored non-relative URL! – STOPPING`);
      await prisma.$disconnect();
      process.exit(1);
    }
  }

  // ── 7. Verification ─────────────────────────────────────────────────────────
  console.log('\n[7] Verification queries...');
  const showCount    = await prisma.show.count();
  const imageCount   = await prisma.showImage.count({ where: { showId: show.id } });
  const coverImg     = await prisma.showImage.findFirst({ where: { showId: show.id, isCover: true } });

  console.log(`    Total shows in DB:      ${showCount}`);
  console.log(`    ShowImages (this show): ${imageCount}`);

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log(' PILOT RESULT');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(` slug:        ${show.slug}`);
  console.log(` category:    ${show.category}`);
  console.log(` city:        Bratislava`);
  console.log(` date:        ${termin.startsAt.toISOString().slice(0, 10)}`);
  console.log(` ticketTypes: 2 (Štandard 15€, VIP 45€)`);
  console.log(` images:      ${imageCount}`);
  console.log(` cover url:   ${coverImg?.url ?? 'NONE'}`);
  console.log(` all relative: ${imageRecords.every(d => d.url.startsWith('/v1/uploads/'))}`);
  console.log('╚══════════════════════════════════════════════════════╝');

  await prisma.$disconnect();
  console.log('\n✓ PILOT done. Waiting for GO to seed remaining 6 shows.\n');
}

main().catch(async (err) => {
  console.error('[FATAL]', err);
  await prisma.$disconnect();
  process.exit(1);
});
