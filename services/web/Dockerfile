# syntax=docker/dockerfile:1
# The server bundle is plain JavaScript, so it is built once on the build platform and runs on every target.
FROM --platform=$BUILDPLATFORM node:26-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:26-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080
COPY --from=build /src/build ./build
COPY --from=build /src/node_modules ./node_modules
COPY --from=build /src/package.json ./package.json
USER node
EXPOSE 8080
ENTRYPOINT ["node", "build"]
