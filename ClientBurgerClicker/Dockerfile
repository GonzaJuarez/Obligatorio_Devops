
FROM node:18 as build
WORKDIR /src
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration=production

FROM nginx:alpine
COPY ./nginx/default.conf /etc/nginx/conf.d/default.conf

COPY --from=build /src/dist /usr/share/nginx/html

RUN mkdir -p /usr/share/nginx/html/runtime-config
RUN mv /usr/share/nginx/html/ngt-template/browser/* /usr/share/nginx/html
EXPOSE 80
