if (process.env.SENTRY_DSN && process.env.NODE_ENV === 'production') {
  const Sentry = require('@sentry/node')
  Sentry.init({dsn: process.env.SENTRY_DSN})
  const SentryTransport = require('winston-transport-sentry-node').default
  const log = require('./log')
  log.add(
    new SentryTransport({
      sentry: {
        dsn: process.env.SENTRY_DSN,
      },
      level: 'warn',
    })
  )
}
