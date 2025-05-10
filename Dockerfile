FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++ bash py3-setuptools git rsync

ARG USERNAME=preet665
ARG REPO_NAME=plasmic-coolify
ARG GIT_BRANCH=master

ARG DB_HOST_ARG=coolify-db
ARG DB_USER_ARG=wab
ARG DB_PASSWORD_ARG=SEKRET
ARG DB_NAME_ARG=wab
ARG DB_PORT_ARG=5432

ENV PGHOST=$DB_HOST_ARG
ENV PGPORT=$DB_PORT_ARG
ENV PGUSER=$DB_USER_ARG
ENV PGPASSWORD=$DB_PASSWORD_ARG
ENV PGDATABASE=$DB_NAME_ARG
ENV WAB_DBNAME=$DB_NAME_ARG

RUN echo "Cloning public repository ${USERNAME}/${REPO_NAME} branch ${GIT_BRANCH}..." && \
    git clone --branch ${GIT_BRANCH} --single-branch --depth 1 \
    https://github.com/${USERNAME}/${REPO_NAME}.git . && \
    echo "Cloning complete."

ENV WAB_PASSWORD=$DB_PASSWORD_ARG

RUN yarn install

RUN cd platform/wab && yarn install

RUN cd platform/sub && yarn install

RUN cd platform/canvas-packages && yarn install

RUN yarn bootstrap

WORKDIR /app/platform/wab
RUN bash tools/run.bash src/wab/server/db/DbInit.ts

WORKDIR /app/plasmic

EXPOSE 3003 3004 3005

CMD ["yarn", "dev"] 
