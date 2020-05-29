const { transports, createLogger, format } = require("winston");

module.exports = createLogger({
  level: "info",
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
});
