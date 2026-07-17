FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching).
COPY package*.json ./
RUN npm install --omit=dev

# App source.
COPY . .

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "src/server.js"]
