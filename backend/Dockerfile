FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV PORT=4000
EXPOSE 4000

# 启动时等待依赖就绪 -> 建表灌数据 -> 启动服务
CMD ["sh", "-c", "node seed.js && node server.js"]
