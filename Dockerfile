FROM node:lts-slim

ENV NODE_ENV=production

COPY . /src

WORKDIR /src

RUN npm install

CMD npm start