require("dotenv").config();
const parser = require("discord-command-parser");
const fs = require("fs");
const Discord = require("discord.js");
const immutable = require("object-path-immutable");
const StatsEmitter = require("./statsEmitter");
const log = require("./log");
const Storage = require("./storage");

const client = new Discord.Client();
const statsEmitter = new StatsEmitter();

client.login(process.env.DISCORD_TOKEN);

const defaultConfig = {
  permittedRoles: [],
  enlist: {
    minPlayers: 20,
    channelId: "",
  },
};
// 152125259741528064
client.on("ready", async () => {
  log.info(`logged in as ${client.user.tag}`);

  const config = new Storage("config", defaultConfig);
  await config.restore();

  client.on("message", async function (message) {
    const parsed = parser.parse(message, "!", { allowBots: false });
    if (!parsed.success || parsed.command !== "hart" || !message.member) return;

    switch (parsed.reader.getString()) {
      case "help":
        message.reply(
          `HartShuttleBot commands.\n` +
            `**!hart config set <path> <value>**\n` +
            `Set a config value.\n` +
            `**!hart config dump**\n` +
            `Print the current configuration.\n\n` +
            `Using config commands requires a role in the \`permittedRoles\` config or to be administrator.\n` +
            `Only a administrator can set \`permittedRoles\`.`
        );
        break;
      case "config":
        if (
          !message.member.roles.cache.find(
            (role) =>
              role.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR) ||
              config.get("permittedRoles").find((p) => p === role.id)
          )
        ) {
          return message.reply("you do not have permission to do that.");
        }
        switch (parsed.reader.getString()) {
          case "set": {
            const path = parsed.reader.getString();
            if (
              path === "permittedRoles" &&
              !message.member.roles.cache.find((role) =>
                role.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR)
              )
            ) {
              return message.reply("only admin can change permittedRoles.");
            }
            const value = parsed.reader.getString();
            if (value === null) {
              return message.reply("missing value.");
            }
            if (parsed.reader.getString() !== null) {
              return message.reply(
                'multiple values are not allowed. For arrays use `"one two three"`.'
              );
            }
            switch (typeof immutable.get(defaultConfig, path)) {
              case "string":
                config.set(path, value);
                break;
              case "number":
                config.set(path, parseInt(value, 10));
                break;
              case "object":
                if (Array.isArray(immutable.get(defaultConfig, path))) {
                  config.set(path, value.split(" "));
                } else {
                  return message.reply("bad value.");
                }
                break;
              default:
                return message.reply("bad value.");
            }
            message.reply("value set.");
            reloadModules();
            break;
          }
          case "dump":
            message.reply(`\n${JSON.stringify(config.get())}`);
            break;
          default:
            message.reply("Unknown command, see `!hart help`.");
        }
        break;
      default:
        message.reply("Unknown command, see `!hart help`.");
    }
  });

  const args = {
    client,
    log,
    statsEmitter,
    config,
    Storage,
  };

  const deinitializers = {};

  async function loadModules() {
    for (const file of fs.readdirSync(`${__dirname}/modules`)) {
      const module = file.split(".")[0];
      log.info(`intializing module ${module}`);
      deinitializers[module] = await require(`./modules/${file}`)({
        ...args,
        log: log.child({ module }),
      });
    }
  }

  function reloadModules() {
    console.log(deinitializers);
    for (const [module, deinitialize] of Object.entries(deinitializers)) {
      log.info(`deinitializing module ${module}`);
      deinitialize();
    }
    loadModules();
  }

  loadModules();
});
