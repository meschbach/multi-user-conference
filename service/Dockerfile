FROM node:15.5.0

RUN mkdir -p /app/service /app/common
COPY service/*.js service/*.lock service/*.json /app/service/
COPY common/*.js common/*.lock common/*.json /app/common/
WORKDIR /app/
RUN cd /app/common && yarn install --production && cd /app/service && yarn install --production
WORKDIR /app/service
CMD ["edge.js"]
