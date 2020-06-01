const parser = require("discord-command-parser");
const {
  DiscordPrompt,
  Rejection,
  PromptNode,
  DiscordPromptRunner,
  MessageVisual,
  Errors,
} = require("discord.js-prompts");
const jsJoda = require("@js-joda/core");
require("@js-joda/timezone");
const {
  LocalTime,
  ZoneId,
  Instant,
  ChronoUnit,
  LocalDateTime,
  ZonedDateTime,
} = jsJoda;

const askPlayers = new PromptNode(
  new DiscordPrompt(
    new MessageVisual(
      `Welcome to the battle alert subscription setup process. To cancel the setup, respond with \`exit\` at any point.\n` +
        `At what player threshold do you want to receive a notification? We recommend to keep this fairly low. \`10\` is a good choice.`
    ),
    async (m, data) => {
      const players = parseInt(m.content, 10);
      if (Number.isNaN(players)) throw new Rejection("Please enter a number.");
      if (players > 500)
        throw new Rejection(
          "That seems unlikely. Please enter a lower number."
        );
      if (players < 5)
        throw new Rejection("Please enter a higher number (5 or higher).");
      return {
        ...data,
        players,
      };
    }
  )
);

const askCharacters = new PromptNode(
  new DiscordPrompt(
    new MessageVisual(
      `What are your character names? We will not alert you if you are online on any of them. Separate them with spaces.`
    ),
    async (m, data) => {
      const characters = m.content.split(" ");
      if (characters.length > 10)
        throw new Rejection("Please enter no more than 10 characters.");
      return {
        ...data,
        characters,
      };
    }
  )
);

const askTimezone = new PromptNode(
  new DiscordPrompt(
    new MessageVisual(
      `What is your time zone? Accepted values are in the form: \`US/Eastern\`, \`America/New_York\`, \`Europe/Berlin\`. ` +
        `For a complete list go to https://en.wikipedia.org/wiki/List_of_tz_database_time_zones`
    ),
    async (m, data) => {
      for (const tz of ZoneId.getAvailableZoneIds()) {
        if (tz === m.content) {
          return {
            ...data,
            timezone: m.content,
          };
        }
      }
      throw new Rejection("Invalid time zone, please try again.");
    }
  )
);
const askWeekdayTimeframes = new PromptNode(
  new DiscordPrompt(
    new MessageVisual(
      `During which time frame do you want to get notified on **weekdays**? Use the 24-hour time format. For example \`17:00-22:00\` to get notified during the evenings or \`00:00-24:00\` to get notified at any time.`
    ),
    async (m, data) => {
      let parts = m.content.split("-");
      // 24:00 doesn't technically exist so we convert it to 23:59:59
      if (parts[1] === "24:00") {
        parts = [parts[0], "23:59:59"];
      }
      try {
        let from = LocalTime.parse(parts[0]);
        let to = LocalTime.parse(parts[1]);
        from = from.toString();
        to = to.toString();
        return {
          ...data,
          timeframes: [
            [from, to],
            [from, to],
            [from, to],
            [from, to],
            [from, to],
          ],
        };
      } catch (error) {
        throw new Rejection("Invalid time format, please try again.");
      }
    }
  )
);

const askWeekendTimeframes = new PromptNode(
  new DiscordPrompt(
    new MessageVisual(
      `During which time frame do you want to get notified on **weekends**? Use the 24-hour time format. For example \`17:00-22:00\` to get notified during the evenings or \`00:00-24:00\` to get notified at any time.`
    ),
    async (m, data) => {
      let parts = m.content.split("-");
      // 24:00 doesn't technically exist so we convert it to 23:59:59
      if (parts[1] === "24:00") {
        parts = [parts[0], "23:59:59"];
      }
      try {
        let from = LocalTime.parse(parts[0]);
        let to = LocalTime.parse(parts[1]);
        from = from.toString();
        to = to.toString();
        return {
          ...data,
          timeframes: data.timeframes.concat([
            [from, to],
            [from, to],
          ]),
        };
      } catch (error) {
        throw new Rejection("Invalid time format, please try again.");
      }
    }
  )
);

const success = new PromptNode(
  new DiscordPrompt(() => {
    return new MessageVisual(
      `Your subscription is now active! To update your settings, simply run \`!alert subscribe\` again. ` +
        `To remove your subscription, run \`!alert unsubscribe\`.`
    );
  })
);

askPlayers.addChild(askCharacters);
askCharacters.addChild(askTimezone);
askTimezone.addChild(askWeekdayTimeframes);
askWeekdayTimeframes.addChild(askWeekendTimeframes);
askWeekendTimeframes.addChild(success);

module.exports = async function ({ client, log, statsEmitter, Storage }) {
  const store = new Storage("alert", { subscriptions: [] });
  await store.restore();

  async function messageHandler(message) {
    const parsed = parser.parse(message, "!", { allowBots: false });
    if (!parsed.success || parsed.command !== "alert") return;

    switch (parsed.reader.getString()) {
      case "help":
        message.reply(
          `The !alert command is used to set up a permanent subscription to online player notifications.\n` +
            `**!alert subscribe**\n` +
            `Create or update a subscription.\n` +
            `**!alert status**\n` +
            `Show your current subscription status.\n` +
            `**!alert unsubscribe**\n` +
            `Remove your subscription.`
        );
        break;
      case "status":
        status(message.author);
        break;
      case "subscribe":
        subscribe(message.author);
        break;
      case "unsubscribe":
        unsubscribe(message.author);
        break;
      default:
        message.reply("Unknown command. See `!alert help` for usage.");
    }
  }
  async function status(user) {
    const subscription = store
      .get("subscriptions")
      .find((s) => s.id === user.id);
    if (subscription) {
      user.send("You are subscribed.");
      user.send(JSON.stringify(subscription));
    } else {
      user.send("You are not subscribed.");
    }
  }

  async function subscribe(user) {
    const runner = new DiscordPromptRunner(user, {});
    const channel = await user.createDM();
    try {
      const data = await runner.run(askPlayers, channel);
      store.set(
        "subscriptions",
        store
          .get("subscriptions")
          .filter((s) => s.id !== user.id)
          .concat([
            {
              ...data,
              id: user.id,
              tag: user.tag,
              lastNotification: Date.now(),
            },
          ])
      );
    } catch (error) {
      if (error instanceof Errors.UserInactivityError) {
        channel.send("Signup timed out.");
      } else if (error instanceof Errors.UserVoluntaryExitError) {
        channel.send("Signup terminated.");
      } else {
        log.error(`error during signup dialog: ${error.message}`);
        channel.send("An unexpected error occured.");
      }
    }
  }

  async function unsubscribe(user) {
    if (!store.get("subscriptions").find((s) => s.id === user.id)) {
      return user.send("You are not subscribed.");
    }
    store.set(
      "subscriptions",
      store.get("subscriptions").filter((s) => s.id !== user.id)
    );
    user.send("You are now unsubscribed.");
  }

  async function updateHandler(stats) {
    const totalPlayers = stats.players.length;
    for (const [idx, subscription] of Object.entries(
      store.get("subscriptions")
    )) {
      const now = ZonedDateTime.now(ZoneId.of(subscription.timezone));
      const from = LocalDateTime.now()
        .truncatedTo(ChronoUnit.DAYS)
        .plusNanos(
          LocalTime.parse(
            subscription.timeframes[now.dayOfWeek().value() - 1][0]
          ).toNanoOfDay()
        )
        .atZone(ZoneId.of(subscription.timezone));
      const to = LocalDateTime.now()
        .truncatedTo(ChronoUnit.DAYS)
        .plusNanos(
          LocalTime.parse(
            subscription.timeframes[now.dayOfWeek().value() - 1][1]
          ).toNanoOfDay()
        )
        .atZone(ZoneId.of(subscription.timezone));
      if (
        subscription.players > totalPlayers ||
        LocalDateTime.ofInstant(
          Instant.ofEpochMilli(subscription.lastNotification)
        ).until(LocalDateTime.now(), ChronoUnit.HOURS) < 12 ||
        subscription.characters.find((character) =>
          stats.players.find((p) => character === p.name)
        ) ||
        from.isAfter(now) ||
        to.isBefore(now)
      ) {
        continue;
      }
      log.info(`alert ${subscription.tag}`);
      const user = await client.users.fetch(subscription.id);
      user.send(
        `${totalPlayers} players are online on PSForever. Join the battle now!\n` +
          `You subscribed to this message. To unsubscribe, reply with \`!alert unsubscribe\`.`
      );
      const subscriptions = store.get("subscriptions");
      subscriptions[idx].lastNotification = Date.now();
      store.set("subscriptions", subscriptions);
    }
  }

  statsEmitter.on("update", updateHandler);
  client.on("message", messageHandler);
  return function () {
    client.off("message", messageHandler);
    statsEmitter.off("update", updateHandler);
  };
};
