FROM node:20-bookworm
WORKDIR /app
COPY . /app
RUN npx -y playwright@1.57.0 install --with-deps