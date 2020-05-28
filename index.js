const Discord = require("discord.js");
const schedule = require("node-schedule");
const fetch = require("node-fetch");
const client = new Discord.Client();
require("dotenv").config();

const emojis = {
  newcon: "231260160511705088",
  terran: "444448298657513482",
  vanu: "231260169676390403",
  thumbsup: "👍", // for testing
};

const minPlayers = parseInt(process.env.BOT_MIN_PLAYERS, 10) || 20;
const oneHourMiliseconds = 3600000;
const channelId = process.env.BOT_CHANNEL_ID;

let subscribers = [];
let lastNotification = 0;

client.login(process.env.BOT_TOKEN);

client.on("ready", async () => {
  console.info(`Logged in as ${client.user.tag}`);

  const channel = await client.channels.fetch(channelId);
  let serverStats = await fetchServerStats();

  let message = null;
  const ownMessages = (await channel.messages.fetch({ limit: 10 })).filter(
    (m) => m.author.id === client.user.id && m.embeds.length > 0
  );

  if (ownMessages.size > 0) {
    message = ownMessages.first();
    message.edit(embed());

    // restore existing subscriptions
    for (const [, reaction] of message.reactions.cache) {
      await reaction.users.fetch();
      for (const [, user] of reaction.users.cache) {
        if (user.id !== client.user.id) {
          subscribe(user);
        }
      }
    }
  } else {
    message = await channel.send(embed());
  }
  await watchReactions();

  function embed() {
    const newMessage = new Discord.MessageEmbed().setThumbnail(
      "https://psforever.net/index_files/logo_crop.png"
    );

    if (serverStats.status !== "UP") {
      return newMessage.setColor("#ff0000").setTitle("Server is Offline");
    }

    return newMessage
      .setColor("#0099ff")
      .setTitle("Server is Online")
      .setURL("https://play.psforever.net")
      .setDescription(
        `**Online Players: ${serverStats.players.length}** (${serverStats.empires.TR} <:terran:${emojis.terran}> ${serverStats.empires.NC} <:newcon:${emojis.newcon}> ${serverStats.empires.VS} <:vanu:${emojis.vanu}>)`
      )
      .addFields(
        {
          name: "How to play",
          value:
            "[PSForever setup guide](https://docs.google.com/document/d/1ZMx1NUylVZCXJNRyhkuVWT0eUKSVYu0JXsU-y3f93BY/edit)",
        },
        {
          name: "Not enough players?",
          value: `React with your empire icon and we will notify you if more than ${minPlayers} players express interest within the next hour.`,
        }
      );
  }

  async function checkNotification() {
    if (
      subscribers.length > 0 &&
      subscribers.length + serverStats.players.length >= minPlayers &&
      Date.now() - lastNotification > oneHourMiliseconds
    ) {
      lastNotification = Date.now();
      const pings = subscribers.map((s) => `<@${s.id}>`).join("");
      await channel.send(
        `We have ${subscribers.length} people wanting to play and ${serverStats.players.length} already online. Please login now and have fun!\n${pings}`
      );
    }
  }

  async function watchReactions() {
    await message.react(emojis.terran);
    await message.react(emojis.newcon);
    await message.react(emojis.vanu);

    const filter = (reaction, user) => !user.bot; // TODO !!Object.values(emojis).find(e => e === reaction.emoji.name)
    const collector = message.createReactionCollector(filter, {
      time: oneHourMiliseconds,
    });
    collector.on("collect", (reaction, user) => {
      subscribe(user);
    });
  }

  async function subscribe(user) {
    // filter out expired subscriptions
    subscribers = subscribers.filter(
      (s) => Date.now() - s.time < oneHourMiliseconds
    );
    const existing = subscribers.find((s) => s.id === user.id);
    if (existing) {
      console.info(`refreshed subscription for ${user.tag}`);
      existing.time = Date.now();
    } else {
      console.info(`added subscription for ${user.tag}`);
      subscribers.push({
        id: user.id,
        time: Date.now(),
      });
    }
    await checkNotification();
  }

  // Update server stats every 5 minutes
  schedule.scheduleJob("*/5 * * * *", async () => {
    serverStats = await fetchServerStats();
    message.edit(embed());
    await checkNotification();
  });

  // Post new message every hour
  schedule.scheduleJob("0 * * * *", async function () {
    message = await channel.send(embed());
    console.info("posted new message");
    await watchReactions();
    // delete old messages
    const oldMessages = (await channel.messages.fetch({ limit: 100 })).filter(
      (m) =>
        m.author.id === client.user.id &&
        Date.now() - m.createdTimestamp > oneHourMiliseconds * 0.9
    );
    for (const [, oldMessage] of oldMessages) {
      await oldMessage.delete();
      console.info("deleted old message");
    }
  });
});

async function fetchServerStats() {
  const res = await fetch("https://play.psforever.net/api/stats");
  return await res.json();
}
