FROM node:20-alpine

# System dependencies + Doppler CLI + signal handling
RUN apk add --no-cache tini wget curl bash ca-certificates && \
    curl -Ls --tlsv1.2 --proto "=https" --retry 3 https://cli.doppler.com/install.sh | sh

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Workspace manifests first for better build cache reuse
COPY package*.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json

# Keep full dependency tree available for build + runtime parity
RUN npm ci && npm cache clean --force

COPY . .

# Builds both client and server into dist/
RUN npm run build

RUN mkdir -p /app/logs /home/nodejs/.doppler && \
    chown -R nodejs:nodejs /app /home/nodejs/.doppler

USER nodejs

ENV NODE_ENV=production \
    PORT=5000

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider "http://localhost:${PORT}/api/health" || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "run", "start"]
