# Use an official Node.js runtime as a parent image
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /app

# Install dependencies needed for native Node modules (node-gyp)
# - python3 and make are required by node-gyp
# - g++ (part of build-base) is required for compiling C++ addons
# - bash was needed by the bootstrap script
# - py3-setuptools is added for Python 3.12 compatibility with node-gyp
# - git is needed for some npm/yarn package installations
# - rsync is added for copying files
RUN apk add --no-cache python3 make g++ bash py3-setuptools git rsync

# Copy all source code from the context to the working directory
COPY . .

# Set environment variables
# WARNING: Avoid hardcoding secrets like passwords directly in the Dockerfile.
# Consider using build-time arguments (--build-arg) or Docker secrets for production.
ENV REACT_APP_DEV_HOST_PROXY=http://157.90.224.29:3005
ENV WAB_PASSWORD=SEKRET
ENV PGPASSWORD=SEKRET

# First install all dependencies at the root level
RUN yarn install

# Install dependencies for platform/wab
RUN cd platform/wab && yarn install

# Ensure specific dependencies are properly installed in packages that need them
RUN cd platform/sub && yarn install

# Install dependencies for canvas-packages
RUN cd platform/canvas-packages && yarn install

# Run the bootstrap script which will build all packages
RUN yarn bootstrap

# Set the working directory for subsequent commands to the 'plasmic' subdirectory
WORKDIR /app/plasmic

# Expose the necessary ports for the application
EXPOSE 3003 3004 3005

# Define the default command to run the development server
CMD ["yarn", "dev"] 
