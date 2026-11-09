# Project-owned fallback. Never publishes or retags another project's base.
ARG NODE_DIST_IMAGE=node:24.22.2-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9
ARG UBUNTU_IMAGE=ubuntu:26.04@sha256:6a06111c3b0a8600feadb270aec771dc239bf407b25625f93f44ab00e11f4d3c
FROM ${NODE_DIST_IMAGE} AS node-dist
FROM ${UBUNTU_IMAGE}
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get dist-upgrade -y \
 && apt-get install -y --no-install-recommends ca-certificates libstdc++6 libgcc-s1 libatomic1 \
 && rm -rf /var/lib/apt/lists/*
COPY --from=node-dist /usr/local/bin/node /usr/local/bin/node
COPY --from=node-dist /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
 && node -e 'if(process.versions.node.split(".")[0]!=="24"||typeof require("node:crypto").argon2!=="function")process.exit(1)' \
 && test "$(. /etc/os-release; echo "$VERSION_ID")" = 26.04
