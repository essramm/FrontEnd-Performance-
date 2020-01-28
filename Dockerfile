#
# ---- Base Node ----
# Use current Node LTS: 8.9.4(carbon) as of 2.9.2018
FROM node:carbon AS base
# set working directory
WORKDIR /root/rv-lighthouse
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package.json ./

#
# ---- Dependencies ----
FROM base AS dependencies
# install ALL node_modules, including 'devDependencies'
# update NPM
RUN npm install -g npm
RUN npm set progress=false && rm -rf ~/.npm && rm -rf node_modules && npm config set registry https://artifactory.rvapps.io/api/npm/npm-rvapps/ && npm install

#
# ---- Release -----
FROM node:carbon-slim AS app
# Create app directory
WORKDIR /usr/src/app

# --- Container Dep -------
# install Chrome
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list && apt-get update && apt-get -y install google-chrome-stable
# copy node_modules
COPY --from=dependencies /root/rv-lighthouse ./
# Bundle Stratus API app source(s)
COPY index.js ./
COPY app.js ./
COPY lumos.js ./
COPY utils.js ./
COPY tests ./tests
COPY .envStaging .

# update NPM
RUN npm install -g npm
# --- END Container Dep -------

# Expose the req port for rv-lighthouse-app
EXPOSE 8080
# Give user access
RUN groupadd -r app &&\
        useradd -r -g app -s /sbin/nologin -c "Docker image user" app
# switch to user - app
USER app
# tests
RUN npm test
# start app
CMD [ "npm", "start" ]
