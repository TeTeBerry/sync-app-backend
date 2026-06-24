# Default: DaoCloud mirror (CN). Override: docker build --build-arg NODE_IMAGE=node:20-alpine .
ARG NODE_IMAGE=docker.m.daocloud.io/library/node:20-alpine

FROM ${NODE_IMAGE} AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages ./packages

# husky prepare is dev-only; skip lifecycle scripts in the image build.
ENV HUSKY=0
RUN npm ci --legacy-peer-deps

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY scripts/sync-contract-dist.mjs ./scripts/sync-contract-dist.mjs
COPY src ./src

RUN npm run build

FROM ${NODE_IMAGE} AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# tini reaps zombie processes when the Node process exits.
RUN apk add --no-cache tini

COPY package.json package-lock.json ./
COPY --from=build /app/packages ./packages

ENV HUSKY=0
RUN npm ci --omit=dev --legacy-peer-deps --ignore-scripts && npm cache clean --force

COPY --from=build /app/dist ./dist

RUN mkdir -p uploads && chown -R node:node /app

USER node

EXPOSE 3000

VOLUME ["/app/uploads"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/src/main.js"]
