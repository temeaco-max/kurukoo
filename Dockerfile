# Cloud Run / container proving image for the existing Kurukoo application.
# Models are never downloaded during image build; configure local inference at runtime.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    KURUKOO_DISABLE_LISTEN=false \
    KURUKOO_WORKERS=1 \
    KURUKOO_DATABASE_MODE=postgres \
    KURUKOO_POSTGRES_APPLICATION_INTEGRATED=false \
    KURUKOO_JOB_MODE=in_process \
    KURUKOO_PERSISTENT_STATE_REQUIRED=true \
    DB_PATH=/app/data/kurukoo.sqlite \
    KURUKOO_METRICS_ENABLED=true \
    KURUKOO_SMOLLM2_LOCAL=false \
    SMOLLM2_MODEL=HuggingFaceTB/SmolLM2-1.7B-Instruct \
    SMOLLM2_FALLBACK_MODEL=HuggingFaceTB/SmolLM2-1.7B-Instruct \
    SMOLLM2_DTYPE=q4 \
    HF_HOME=/tmp/huggingface \
    HF_HUB_CACHE=/tmp/huggingface
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/views ./views
COPY --from=build /app/locales ./locales
COPY --from=build /app/models ./models
COPY --from=build /app/docs ./docs
RUN mkdir -p /app/data /tmp/huggingface /tmp/uploads && chown -R node:node /app
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=5 CMD node -e "fetch('http://127.0.0.1:8080/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "start"]
