const {transports, createLogger, format} = require('winston')
const Sentry = require('@sentry/node')

const log = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.colorize(), format.simple()),
  transports: [new transports.Console()],
})

if (process.env.SENTRY_DSN) {
  Sentry.init({dsn: process.env.SENTRY_DSN})
  const SentryTransport = require('winston-transport-sentry-node').default
  log.add(
    new SentryTransport({
      sentry: {
        dsn: process.env.SENTRY_DSN,
      },
      level: 'warn',
      environment: process.env.NODE_ENV || 'development',
    })
  )
}

module.exports = log
