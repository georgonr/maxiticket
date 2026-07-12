/**
 * Jednorazový backfill Order.cardLast4 pre existujúce PAID Stripe objednávky
 * (AI guest identity verification – fáza 1). Best-effort: dotiahne last4 zo
 * Stripe (payment_intent -> latest_charge -> card.last4). Nekartové / neresolvnuteľné
 * objednávky (mock/comp/POS, cs_ session bez charge) sa preskočia.
 *
 * Spustenie (aktívna brána = STRIPE_SANDBOX -> STRIPE_SECRET_KEY_TEST):
 *   SK=$(grep '^STRIPE_SECRET_KEY_TEST=' /opt/maxiticket/.env | cut -d= -f2-) \
 *   docker exec -e SK="$SK" -w /app infra-backend-1 node scripts/backfill-card-last4.js
 */
const Stripe = require('stripe');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.SK || 'sk_test_placeholder', { apiVersion: '2024-06-20' });

(async () => {
  const orders = await prisma.order.findMany({
    where: { paymentProvider: 'stripe', status: 'PAID', cardLast4: null, paymentRef: { startsWith: 'pi_' } },
    select: { id: true, orderNumber: true, paymentRef: true },
  });
  console.log('eligible:', orders.length);
  let done = 0;
  for (const o of orders) {
    try {
      const pi = await stripe.paymentIntents.retrieve(o.paymentRef, { expand: ['latest_charge'] });
      const last4 = pi.latest_charge?.payment_method_details?.card?.last4;
      if (last4) {
        await prisma.order.update({ where: { id: o.id }, data: { cardLast4: last4 } });
        done++;
        console.log('  OK', o.orderNumber, '->', last4);
      } else {
        console.log('  no card last4 for', o.orderNumber);
      }
    } catch (e) {
      console.log('  FAIL', o.orderNumber, '-', String(e.message).slice(0, 80));
    }
  }
  console.log('backfilled:', done, '/', orders.length);
  await prisma.$disconnect();
})();
