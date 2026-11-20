# syntax=docker/dockerfile:1

# EnQuiz API image for Google Cloud Run (roadmap 4.0, option B).
#
# Build:  docker build -t enquiz-api ./be
# Run:    docker run --rm -p 8080:8080 --env-file be/.env -e PORT=8080 enquiz-api
#
# Cloud Run injects PORT (8080). Configuration comes only from environment
# variables (see .env.example); no .env file is baked into the image.

ARG NODE_VERSION=22

# ---- build: compile TypeScript, then drop dev dependencies -----------------
FROM node:${NODE_VERSION}-slim AS build
WORKDIR /app

# mongodb-memory-server (dev/test only) downloads a MongoDB binary on install.
ENV MONGOMS_DISABLE_POSTINSTALL=1
# The project requires npm >= 11 (see README); node:22 ships npm 10.
RUN npm install -g npm@11 --no-audit --no-fund

COPY package.json package-lock.json ./
RUN npm ci

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---- runtime ---------------------------------------------------------------
FROM node:${NODE_VERSION}-slim
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# Only used with STORAGE_DRIVER=local (local testing). Cloud Run's filesystem
# is in-memory and wiped on every restart: production must use STORAGE_DRIVER=s3.
RUN mkdir -p uploads && chown node:node uploads
USER node

EXPOSE 8080
# Run node directly (not npm) so SIGTERM from Cloud Run reaches Nest's shutdown hooks.
CMD ["node", "dist/main.js"]
