FROM node:15.5.0 as builder

ENV NODE_ENV production
RUN mkdir -p /app/multi-user-conference /app/common /app/muc-client
COPY ./ /app/
WORKDIR /app/
RUN cd /app/common && yarn install --production
RUN cd /app/client && yarn install --production
RUN cd /app/multi-user-conference && yarn install --production && yarn build

FROM nginx:1.19.6
EXPOSE 80
COPY --from=builder /app/multi-user-conference/build/ /usr/share/nginx/html/
