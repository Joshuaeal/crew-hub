FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Inlined into the client bundle at build time
ARG NEXT_PUBLIC_SERVICE_SYNAPSE_URL
ARG NEXT_PUBLIC_MATRIX_HOMESERVER_URL
ENV NEXT_PUBLIC_SERVICE_SYNAPSE_URL=$NEXT_PUBLIC_SERVICE_SYNAPSE_URL
ENV NEXT_PUBLIC_MATRIX_HOMESERVER_URL=$NEXT_PUBLIC_MATRIX_HOMESERVER_URL

# Baked into next.config rewrites — proxy /_matrix to Synapse (avoids browser CORS). Set at build time (e.g. http://synapse:8008 in compose).
ARG MATRIX_UPSTREAM_URL
ENV MATRIX_UPSTREAM_URL=$MATRIX_UPSTREAM_URL

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache su-exec \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "server.js"]
