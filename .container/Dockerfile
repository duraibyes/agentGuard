# Use Node 24
FROM node:24-alpine

# Set working directory
WORKDIR /app

# Copy package files first
COPY package.json package-lock.json* ./

# Install dependencies using npm
RUN npm install

# Copy application source
COPY . .

# Azure App Service will set PORT
ENV PORT=3000

# Expose application port
EXPOSE 3000

# Start application
CMD ["npm", "start"]