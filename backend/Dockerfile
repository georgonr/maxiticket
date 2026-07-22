FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

# Dependencies
FROM base AS deps
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps && cp -R node_modules /prod_modules
RUN npm install --legacy-peer-deps

# Build
FROM deps AS builder
COPY . .
RUN npx prisma generate
RUN npm run build

# Assety (fonty pre PDF lístkov/kupónov, logo pre faktúry) kopíruje do dist nest-cli
# podľa nest-cli.json. Keď sa to nestane, build prejde a appka sa naštartuje, ale
# generovanie PDF padne až pri prvej objednávke na ENOENT – a e-mail s lístkami
# sa ticho neodošle. Radšej zhoď build tu.
RUN set -e; \
    for f in dist/assets/fonts/BebasNeue-Regular.ttf \
             dist/assets/fonts/Geist-Regular.ttf \
             dist/assets/fonts/Geist-Bold.ttf \
             dist/assets/brand/logo-icon.png; do \
      test -s "$f" || { echo "BUILD FAIL: chýba runtime asset $f (nest-cli assets sa neskopírovali do dist)"; exit 1; }; \
    done; \
    echo "assets OK: $(find dist/assets -type f | wc -l) súborov v dist/assets"

# Runtime
FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /prod_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma
EXPOSE 3001
CMD ["node", "dist/main.js"]

# Note: font assets are bundled via nest-cli assets into dist/assets/fonts/
