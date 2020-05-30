const Discord = require("discord.js");

const emojis = {
  terran: "444448298657513482",
  newcon: "231260160511705088",
  vanu: "231260169676390403",
  thumbsup: "👍", // for testing
};

const minPlayers = parseInt(process.env.BOT_MIN_PLAYERS, 10) || 20;
const oneHourMiliseconds = 3600000;
const channelId = process.env.BOT_CHANNEL_ID;

module.exports = async function ({ client, statsEmitter, log, Storage }) {
  const channel = await client.channels.fetch(channelId);

  const store = new Storage("enlist", { subscriptions: [] });
  await store.restore();
  let message = null;
  let stats = await statsEmitter.fetch();

  const embedMessages = (await channel.messages.fetch({ limit: 10 })).filter(
    (m) => m.author.id === client.user.id && m.embeds.length > 0
  );
  if (embedMessages.size > 0) {
    message = embedMessages.first();
    message = await message.edit(embed());
    await updateSubscriptions();
  } else {
    message = await channel.send(embed());
  }
  await message.react(emojis.terran);
  await message.react(emojis.newcon);
  await message.react(emojis.vanu);

  // Update server stats and subscriptions every minute
  statsEmitter.on("update", async (newStats) => {
    if (
      newStats.empires.TR !== stats.empires.TR ||
      newStats.empires.NC !== stats.empires.NC ||
      newStats.empires.VS !== stats.empires.VS
    ) {
      stats = newStats;
      message = await message.edit(embed());
    } else {
      message = await message.fetch();
    }
    await updateSubscriptions();

    if (
      store.get("subscriptions").length > 0 &&
      store.get("subscriptions").length + stats.players.length >= minPlayers
    ) {
      const pings = store
        .get("subscriptions")
        .map((s) => `<@${s.id}>`)
        .join(" ");
      await channel.send(
        `Your shuttle has arrived! ${
          store.get("subscriptions").length
        } players are ready to play and ${
          stats.players.length
        } players are already online. ` +
          `We hope to see you on the battlefield.\n${pings}`
      );
      for (const subscription of store.get("subscriptions")) {
        await unsubscribe(subscription);
      }
      log.info(`notified ${pings}`);
    }

    // filter out expired subscriptions
    for (const subscription of store.get("subscriptions")) {
      if (Date.now() - subscription.time > oneHourMiliseconds) {
        await unsubscribe(subscription);
      }
    }

    // clear notifications after 10 minutes
    const oldMessages = (await channel.messages.fetch({ limit: 10 })).filter(
      (m) =>
        m.author.id === client.user.id &&
        m.embeds.length === 0 &&
        Date.now() - m.createdTimestamp > oneHourMiliseconds / 10
    );
    for (const [, oldMessage] of oldMessages) {
      await oldMessage.delete();
    }
  });

  function embed() {
    const newMessage = new Discord.MessageEmbed().setURL(
      "https://play.psforever.net"
    );

    if (stats.status !== "UP") {
      return newMessage.setColor("#ff0000").setTitle("Server is Offline");
    }

    return newMessage
      .setColor("#0099ff")
      .setAuthor(
        "How to play",
        "https://psforever.net/index_files/logo_crop.png",
        "https://docs.google.com/document/d/1ZMx1NUylVZCXJNRyhkuVWT0eUKSVYu0JXsU-y3f93BY/edit"
      )
      .setTitle("Server is Online")
      .setDescription(
        `**Online Players: ${stats.players.length} (${stats.empires.TR} <:terran:${emojis.terran}> ` +
          `${stats.empires.NC} <:newcon:${emojis.newcon}> ${stats.empires.VS} <:vanu:${emojis.vanu}>)**`
      )
      .addFields({
        name: "Want to start a battle?",
        value: `React with your faction of choice and we will notify you if ${minPlayers} players total do the same within the next hour.\n`,
      });
  }

  async function updateSubscriptions() {
    const active = [];
    for (const [, reaction] of message.reactions.cache) {
      await reaction.users.fetch();

      if (!Object.values(emojis).find((id) => id === reaction.emoji.id)) {
        await reaction.remove();
        continue;
      }

      for (const [, user] of reaction.users.cache) {
        active.push(user.id);
        if (
          user.id !== client.user.id &&
          !store.get("subscriptions").find((s) => s.id === user.id)
        ) {
          if (stats.players.length < minPlayers) {
            await subscribe(user);
          } else {
            // server has plenty of online players, go away
            await unsubscribe(user);
          }
        }
      }
    }
    for (const subscription of store.get("subscriptions")) {
      if (!active.find((uid) => uid === subscription.id)) {
        await unsubscribe(subscription);
      }
    }
  }

  async function subscribe({ id, tag }) {
    log.info(`subscribe ${tag}`);
    const subscriptions = store.get("subscriptions");
    const idx = subscriptions.findIndex((s) => s.id === id);
    if (idx === -1) {
      store.set(
        "subscriptions",
        subscriptions.concat([
          {
            id,
            tag,
            time: Date.now(),
          },
        ])
      );
    } else {
      subscriptions[idx].time = Date.now();
      store.set("subscriptions", subscriptions);
    }
  }

  async function unsubscribe({ id, tag }) {
    log.info(`unsubscribe ${tag}`);
    store.set(
      "subscriptions",
      store.get("subscriptions").filter((s) => s.id !== id)
    );
    for (const [, reaction] of message.reactions.cache) {
      await reaction.users.fetch();
      for (const [, user] of reaction.users.cache) {
        if (user.id === id) {
          reaction.users.remove(id);
        }
      }
    }
  }
};
