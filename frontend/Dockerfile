# Build the React app, then serve it with nginx; /api is passed to the PHP-FPM container.
FROM node:22.21.1-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# The build tools' native parts (rolldown, lightningcss, tailwind) are optional packages, which npm
# skips silently when a download fails. Retry downloads, check they load, and reinstall if not.
RUN npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && for attempt in 1 2 3; do \
         npm ci --no-audit --no-fund \
         && node -e "Promise.all(['rolldown','lightningcss','@tailwindcss/oxide'].map(m=>import(m))).then(()=>console.log('native build tools OK'),e=>{console.error(e.message.split('\\n')[0]);process.exit(1)})" \
         && break; \
         echo "npm install incomplete (attempt $attempt), retrying..."; rm -rf node_modules; \
         [ "$attempt" = 3 ] && exit 1; \
       done
COPY . .
# Same-origin API: the browser calls /api/v1 on whatever domain serves the app
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.28.0-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
# Checked every second while starting (so `up --wait` returns as soon as nginx answers), then every 30 s
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=30s --start-interval=1s CMD wget -q -O /dev/null http://127.0.0.1/up || exit 1
