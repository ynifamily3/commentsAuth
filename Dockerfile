FROM node:14.15.5
LABEL MAINTAINER="jongkeun.ch@gmail.com"
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8081
ENTRYPOINT ["npm", "start"];
