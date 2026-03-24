
# Improved React Dockerfile for clean install

FROM node:25-alpine
WORKDIR /app

# Copy only package.json and lock file first (better cache)
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy all source files (except node_modules)
COPY . .

# Ensure public and src folders exist
RUN test -f public/index.html && test -f src/App.tsx

EXPOSE 3000
CMD ["npm", "start"]
