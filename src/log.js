const {transports, createLogger, format} = require('winston')

module.exports = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.colorize(), format.simple()),
  transports: [new transports.Console()],
})
