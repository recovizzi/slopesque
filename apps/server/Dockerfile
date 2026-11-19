# The Slopesque server image (build from the repository's root: docker build -f apps/server/Dockerfile .).
# Multi-stage: the workspace built with pnpm, then only the server and its production dependencies, run as a user
# without privileges. Secrets come from the environment (the machine's .env), never from the image.
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc* ./
COPY patches ./patches
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
COPY packages/engines/package.json packages/engines/
RUN pnpm install --frozen-lockfile --filter @slopesque/server... --ignore-scripts=false
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/server ./apps/server
RUN pnpm --filter @slopesque/shared --filter @slopesque/engines --filter @slopesque/server run build \
 && pnpm --filter @slopesque/server deploy --prod --legacy /out

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/package.json ./
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /repo/apps/server/dist ./dist
COPY --from=build /repo/apps/server/drizzle ./drizzle
RUN printf '#!/bin/sh\nexec node /app/dist/admin.js "$@"\n' > /usr/local/bin/admin && chmod +x /usr/local/bin/admin
USER node
EXPOSE 23100
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s CMD wget -qO- http://127.0.0.1:23100/api/health > /dev/null || exit 1
CMD ["node", "dist/main.js"]
