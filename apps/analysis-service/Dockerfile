FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/analysis-service/package.json apps/analysis-service/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN npm install

FROM deps AS build
WORKDIR /app
COPY tsconfig.base.json ./
COPY apps/analysis-service apps/analysis-service
COPY packages/shared-types packages/shared-types
RUN npm --workspace @codeguard/analysis-service run build

FROM node:24-alpine AS runner
WORKDIR /app/apps/analysis-service
ENV NODE_ENV=production
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/analysis-service/node_modules ./node_modules
COPY --from=build /app/apps/analysis-service/dist ./dist
COPY --from=build /app/apps/analysis-service/prisma ./prisma
COPY apps/analysis-service/package.json ./package.json
CMD ["node", "dist/src/main.js"]
