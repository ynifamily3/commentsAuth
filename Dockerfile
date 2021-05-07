FROM node:16.1.0
LABEL MAINTAINER="jongkeun.ch@gmail.com"
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8081
ENTRYPOINT ["npm", "start"];
