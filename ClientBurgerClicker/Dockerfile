# ===== STAGE 1: build =====
FROM node:18-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build --configuration=production

# ===== STAGE 2: nginx =====
FROM ghcr.io/11notes/nginx:1.28.0

COPY ./nginx/default.conf /nginx/etc/default.conf
COPY --from=build /app/dist/burger-clicker/browser/ /nginx/var/

EXPOSE 8080
