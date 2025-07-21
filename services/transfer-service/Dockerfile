# Stage 1: Builder
# Use the full Node.js LTS image to build our application
FROM node:20 AS builder

WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application source code
COPY . .

# Stage 2: Production
# Use a slim image for a smaller footprint
FROM node:20-slim

WORKDIR /usr/src/app

# Copy dependencies and source code from the builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app .

# Expose the port the app runs on
EXPOSE 3001

# The command to run the application
CMD [ "npm", "start" ]