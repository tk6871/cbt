FROM node:22-bookworm-slim AS workspace
WORKDIR /build
RUN npm install --global pnpm@10.34.5
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/

FROM workspace AS build
RUN pnpm --filter @cbt/api install --frozen-lockfile
COPY server/tsconfig.json server/
COPY server/src server/src
RUN pnpm --filter @cbt/api build

FROM workspace AS dependencies
RUN pnpm --filter @cbt/api install --prod --frozen-lockfile

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 CBT_CONTENT_ROOT=/app
COPY --from=dependencies /build/node_modules ./node_modules
COPY --from=dependencies /build/server/node_modules ./server/node_modules
COPY --from=build /build/server/dist ./server/dist
COPY data/*.js ./data/
COPY assets/equipment/ ./assets/equipment/
USER node
EXPOSE 8080
CMD ["node", "server/dist/main.js"]
