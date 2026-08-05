FROM node:25-alpine AS build
WORKDIR /src
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --no-audit --no-fund
COPY src ./src
RUN npx tsc -p . && npm prune --omit=dev

FROM node:25-alpine
WORKDIR /app
COPY --from=build /src/node_modules ./node_modules
COPY --from=build /src/dist ./dist
COPY --from=build /src/package.json ./package.json
USER node
EXPOSE 8080
ENTRYPOINT ["node", "dist/index.js"]
