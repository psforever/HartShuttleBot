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
  enlist: {
    minPlayers: 20,
    channelId: "",
  },
};

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
            `Print the current configuration.`
        );
        break;
      case "config":
        if (
          !message.member.roles.cache.find(
            (role) =>
              role.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR) ||
              role.id === 152125259741528064 // Developers
          )
        ) {
          return message.reply("you do not have permission to do that.");
        }
        switch (parsed.reader.getString()) {
          case "set": {
            const path = parsed.reader.getString();
            switch (typeof immutable.get(defaultConfig, path)) {
              case "string":
                config.set(path, parsed.reader.getString());
                break;
              case "number":
                config.set(path, parseInt(parsed.reader.getString(), 10));
                break;
              default:
                throw new Error("Unknown type.");
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
