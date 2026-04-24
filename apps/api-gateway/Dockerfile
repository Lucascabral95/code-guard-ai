FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api-gateway/package.json apps/api-gateway/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN npm install

FROM deps AS build
WORKDIR /app
COPY tsconfig.base.json ./
COPY apps/api-gateway apps/api-gateway
COPY packages/shared-types packages/shared-types
RUN npm --workspace @codeguard/api-gateway run build

FROM node:24-alpine AS runner
WORKDIR /app/apps/api-gateway
ENV NODE_ENV=production
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=build /app/apps/api-gateway/dist ./dist
COPY apps/api-gateway/package.json ./package.json
CMD ["node", "dist/main.js"]
