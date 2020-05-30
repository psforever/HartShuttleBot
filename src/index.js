require("dotenv").config();
const fs = require("fs");
const Discord = require("discord.js");
const StatsEmitter = require("./statsEmitter");
const log = require("./log");
const Storage = require("./storage");

const client = new Discord.Client();
const statsEmitter = new StatsEmitter();

client.login(process.env.DISCORD_TOKEN);

client.on("ready", async () => {
  log.info(`logged in as ${client.user.tag}`);

  const args = {
    client,
    log,
    statsEmitter,
    Storage,
  };

  for (const module of fs.readdirSync(`${__dirname}/modules`)) {
    log.info(`intializing module ${module}`);
    await require(`./modules/${module}`)({
      ...args,
      log: log.child({ module }),
    });
  }
});
