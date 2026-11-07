FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM deps AS production-deps
RUN npm prune --omit=dev

FROM node:24-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV MAILDIR_IMPORT_DIR=/mailboxes/mailbox/Maildir
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV MAIL_DATA_DIR=/app/data
ENV MAILDIR_IMPORT_DIR=/mailboxes/mailbox/Maildir
RUN rm -rf /usr/local/lib/node_modules /opt/yarn* /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/yarn /usr/local/bin/yarnpkg \
  && apk upgrade --no-cache \
  && apk add --no-cache su-exec
RUN addgroup -S -g 5000 vmail && adduser -S -u 5000 -G vmail nextjs
RUN mkdir -p /app/data/mail/inbox /app/data/mail/sent /app/data/mail/bounced /app/data/tmp /app/data/drop/inbox /app/data/drop/processed /app/data/drop/failed && chown -R nextjs:vmail /app/data
COPY --from=builder /app/public ./public
COPY --from=builder /app/server.mjs ./server.mjs
COPY --from=builder /app/smtp-transport.mjs ./smtp-transport.mjs
COPY --from=builder /app/smtp-bootstrap.mjs ./smtp-bootstrap.mjs
COPY --from=builder /app/auth-core.mjs ./auth-core.mjs
COPY --from=builder /app/account-core.mjs ./account-core.mjs
COPY --from=builder /app/account-store.mjs ./account-store.mjs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=production-deps /app/node_modules ./node_modules
COPY docker-entrypoint.sh /usr/local/bin/mailbox-webmail-ui-entrypoint
RUN chmod 0755 /usr/local/bin/mailbox-webmail-ui-entrypoint
EXPOSE 3000
ENTRYPOINT ["mailbox-webmail-ui-entrypoint"]
CMD ["node", "server.mjs"]
