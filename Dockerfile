FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --chown=node:node dist/ ./dist/
COPY --chown=node:node server.mjs ./server.mjs
COPY --chown=node:node server-advanced.mjs ./server-advanced.mjs
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
