# The server image of web. build-and-push.sh runs `next build` on the host
# first, so the image only copies the result and runs it. Nothing in it is
# compiled, so one build serves every image platform.
FROM node:24.15.0-alpine
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
# The standalone server: server.js plus only the node_modules it needs.
COPY --chown=node:node .next/standalone/ ./
# The files under /_next/static. In a vector with web-static the bucket
# serves them and these copies stay unused. In a vector without web-static
# the server answers /_next/static itself from here.
COPY --chown=node:node .next/static/ ./services/web/.next/static/
USER node
EXPOSE 3000
CMD ["node", "services/web/server.js"]
