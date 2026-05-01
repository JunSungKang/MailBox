FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

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
RUN apk add --no-cache su-exec
RUN addgroup -S -g 5000 vmail && adduser -S -u 5000 -G vmail nextjs
RUN mkdir -p /app/data/mail/inbox /app/data/mail/sent /app/data/mail/bounced /app/data/tmp /app/data/drop/inbox /app/data/drop/processed /app/data/drop/failed && chown -R nextjs:vmail /app/data
COPY --from=builder /app/public ./public
COPY --from=builder /app/server.mjs ./server.mjs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=deps /app/node_modules ./node_modules
COPY docker-entrypoint.sh /usr/local/bin/mail-webmail-ui-entrypoint
RUN chmod 0755 /usr/local/bin/mail-webmail-ui-entrypoint
EXPOSE 3000
ENTRYPOINT ["mail-webmail-ui-entrypoint"]
CMD ["node", "server.mjs"]
