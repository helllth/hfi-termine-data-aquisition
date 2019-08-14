FROM node
RUN apt-get update -y
RUN apt-get install -y locales

ENV LOCALE de_DE
ENV ENCODING UTF-8

RUN locale-gen ${LOCALE}.${ENCODING}
ENV LANG ${LOCALE}.${ENCODING}
ENV LANGUAGE ${LOCALE}.${ENCODING}
ENV LC_ALL ${LOCALE}.${ENCODING}
ENV TZ Europe/Berlin

RUN echo "LC_ALL=${LOCALE}.${ENCODING}" >> /etc/environment
RUN echo "${LOCALE}.${ENCODING} ${ENCODING}" >> /etc/locale.gen
RUN echo "LANG=${LOCALE}.${ENCODING}" > /etc/locale.conf

RUN locale-gen --purge

WORKDIR /app

# Install app dependencies
COPY package.json .
# For npm@5 or later, copy package-lock.json as well
# COPY package.json package-lock.json .

RUN yarn install

# Bundle app source
COPY .babelrc .
COPY *.js ./


# Configure cron
COPY dummycrontab /etc/cron/crontab

COPY entrypoint.sh /
COPY singlerun.sh /

RUN chmod +x /entrypoint.sh
RUN chmod +x /singlerun.sh

ENV LIMIT 10000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["--single-run"]