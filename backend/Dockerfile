# Simple Node.js/Express Dockerfile
FROM node:25-alpine
WORKDIR /app

# Install build dependencies for bcrypt and native modules
RUN apk add --no-cache python3 make g++ gcc ca-certificates

COPY package.json package-lock.json* ./
# Remove any existing node_modules and reinstall fresh
RUN rm -rf node_modules && npm install --build-from-source

COPY . .
EXPOSE 5000 9229
CMD ["node", "--inspect=0.0.0.0:9229", "src/index.js"]
