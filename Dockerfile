FROM node

ADD . /src

WORKDIR /src

CMD npm start