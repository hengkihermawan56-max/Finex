FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends util-linux ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --chown=node:node . .
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:8787/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["flock","--no-fork","--exclusive","--nonblock","/data/engine.lock","node","src/server.mjs"]
