FROM node:20-alpine AS base
WORKDIR /app
COPY package.json ./
RUN npm install

FROM base AS dev
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY public ./public
COPY src ./src
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
