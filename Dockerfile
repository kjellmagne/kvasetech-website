FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY index.html ./index.html
COPY server.js ./server.js
COPY assets/ ./assets/

EXPOSE 8080

CMD ["npm", "start"]
