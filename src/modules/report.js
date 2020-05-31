const parser = require("discord-command-parser");

module.exports = async function ({ client, config, log }) {
  if (!config.get("report.channelId")) {
    log.warn("channelId not set, skipping initialization");
    return function () {};
  }
  const channel = await client.channels.fetch(config.get("report.channelId"));

  async function messageHandler(message) {
    const parsed = parser.parse(message, "!", { allowBots: false });
    if (!parsed.success || parsed.command !== "report") return;

    const name = parsed.reader.getString();
    const reason = parsed.reader.getRemaining();
    if (!name || !reason) {
      return message.reply(
        `The !report command is used to report players to the support representatives.\n` +
          `**!report <playername> <reason...>**\n` +
          `Report player with <playername> for <reason...>\n` +
          `Example: \`!report NotNotNick They are an imposter\``
      );
    }

    channel.send(
      `@here Report from <@${message.author.id}> for player \`${name}\` for reason: \`${reason}\``
    );
  }

  client.on("message", messageHandler);
  return function () {
    client.off("message", messageHandler);
  };
};
