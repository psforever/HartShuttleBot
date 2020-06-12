FROM node:lts-slim

ENV NODE_ENV=production

COPY . /src

WORKDIR /src

RUN yarn install

CMD yarn start