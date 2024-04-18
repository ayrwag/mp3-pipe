# Use the official Node.js image with version 16.14
FROM node:21

# Set a working directory in the container
WORKDIR /app

# Install ffmpeg and ffprobe
RUN apt-get update && apt-get install -y ffmpeg

# Install pip
RUN apt-get install -y python3-pip

# Install youtube-dl as a system package and update it
RUN pip3 install --upgrade yt-dlp

# Copy package.json and package-lock.json to the container
COPY package*.json ./build

# Install npm dependencies
RUN npm install

# Copy the rest of the application code to the container
COPY ./build .

# Build the TypeScript code (results in compiled JavaScript files in dist)
RUN npm run build

# Expose the port your application will run on
EXPOSE 8080

# Specify the command to run the application
CMD ["node", "build/index.js"]
