# syntax=docker/dockerfile:1.7
# feedback: production image for the self-hosted platform (Dokploy).
# Plan: docs/plans/2026-11-20-vps-self-hosting-migration. Install scripts are skipped:
# no dependency needs them at runtime (sharp ships prebuilt musl binaries).
FROM node:24-alpine AS base
WORKDIR /app
RUN command -v yarn >/dev/null || npm i -g yarn@1.22.22

FROM base AS prod-deps
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production --ignore-scripts --network-timeout 600000 && yarn cache clean

FROM base AS build
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --ignore-scripts --network-timeout 600000
COPY . .
RUN yarn build

FROM node:24-alpine
ENV NODE_ENV=production PORT=3011 HEALTH_PATH=/feedback/health
WORKDIR /app
RUN apk add --no-cache tini
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
USER node
EXPOSE 3011
HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=4 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+process.env.HEALTH_PATH).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
