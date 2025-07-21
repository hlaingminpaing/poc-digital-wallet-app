# Stage 1: Build the React application
FROM node:20 AS build

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application source code
COPY . .

# Build the application for production
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:1.27-alpine-slim

# Copy the built assets from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy our custom Nginx configuration
COPY nginx.k8s.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]