FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

# Dependencies
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && cp -R node_modules /prod_modules
RUN npm ci

# Build
FROM deps AS builder
COPY . .
RUN npx prisma generate
RUN npm run build

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
