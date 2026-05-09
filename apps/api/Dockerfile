FROM node:20-alpine AS base
WORKDIR /app
COPY package.json ./
RUN npm install

FROM base AS dev
COPY tsconfig.json ./
COPY src ./src
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM base AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS prod
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
