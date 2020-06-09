const parser = require('discord-command-parser')
const {DiscordPrompt, Rejection, PromptNode, DiscordPromptRunner, MessageVisual, Errors} = require('discord.js-prompts')
const jsJoda = require('@js-joda/core')
require('@js-joda/timezone')
const {LocalTime, ZoneId, Instant, ChronoUnit, LocalDateTime, ZonedDateTime, DayOfWeek} = jsJoda

const askPlayers = new PromptNode(
  new DiscordPrompt(
    new MessageVisual(
      `Welcome to the battle alert subscription setup. To cancel, respond with \`exit\` at any point.\n` +
        `At what player threshold do you want to receive a notification? We recommend to keep this fairly low. \`10\` is a good choice.`
    ),
    async (m, data) => {
      const players = parseInt(m.content, 10)
      if (Number.isNaN(players)) throw new Rejection('Please enter a number.')
      if (players > 500) throw new Rejection('That seems unlikely. Please enter a lower number.')
      if (players < 5) throw new Rejection('Please enter a higher number (5 or higher).')
      return {
        ...data,
        players,
      }
    }
  )
)

const askCharacters = new PromptNode(
  new DiscordPrompt(
    new MessageVisual(
      `What are your character names? We will not alert you if you are online on any of them. Separate them with spaces.`
    ),
    async (m, data) => {
      const characters = m.content.split(' ')
      if (characters.length > 10) throw new Rejection('Please enter no more than 10 characters.')
      return {
        ...data,
        characters,
      }
    }
  )
)

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
          }
        }
      }
      throw new Rejection('Invalid time zone, please try again.')
    }
  )
)
const askWeekdayTimeframes = new PromptNode(
  new DiscordPrompt(
    new MessageVisual(
      `During which time frame do you want to get notified on **weekdays**? Use the 24-hour time format. ` +
        `For example \`17:00-22:00\` to get notified during the evenings or \`00:00-24:00\` to get notified at any time.` +
        `To set a different value for each day, enter five space-separated values.`
    ),
    async (m, data) => {
      const timeframes = m.content.split(' ')
      if (timeframes.length !== 1 && timeframes.length !== 5) {
        throw new Rejection('Enter either one or five values.')
      }
      if (timeframes.length === 1) {
        for (let i = 1; i < 5; i++) {
          timeframes[i] = timeframes[0]
        }
      }
      for (let i = 0; i < 5; i++) {
        let parts = timeframes[i].split('-')
        // 24:00 doesn't technically exist so we convert it to 23:59:59
        if (parts[1] === '24:00') {
          parts = [parts[0], '23:59:59']
        }
        try {
          const from = LocalTime.parse(parts[0])
          const to = LocalTime.parse(parts[1])
          timeframes[i] = [from.toString(), to.toString()]
        } catch (error) {
          throw new Rejection('Invalid time format, please try again.')
        }
      }
      return {
        ...data,
        timeframes,
      }
    }
  )
)

const askWeekendTimeframes = new PromptNode(
  new DiscordPrompt(
    new MessageVisual(
      `During which time frame do you want to get notified on **weekends**? Use the 24-hour time format. ` +
        `For example \`17:00-22:00\` to get notified during the evenings or \`00:00-24:00\` to get notified at an  y time.` +
        `To set a different value for each day, enter two space-separated values.`
    ),
    async (m, data) => {
      const timeframes = m.content.split(' ')
      if (timeframes.length !== 1 && timeframes.length !== 2) {
        throw new Rejection('Enter either one or two values.')
      }
      if (timeframes.length === 1) {
        for (let i = 1; i < 2; i++) {
          timeframes[i] = timeframes[0]
        }
      }
      for (let i = 0; i < 2; i++) {
        let parts = timeframes[i].split('-')
        // 24:00 doesn't technically exist so we convert it to 23:59:59
        if (parts[1] === '24:00') {
          parts = [parts[0], '23:59:59']
        }
        try {
          const from = LocalTime.parse(parts[0])
          const to = LocalTime.parse(parts[1])
          timeframes[i] = [from.toString(), to.toString()]
        } catch (error) {
          throw new Rejection('Invalid time format, please try again.')
        }
      }
      return {
        ...data,
        timeframes: data.timeframes.concat(timeframes),
      }
    }
  )
)

const success = new PromptNode(
  new DiscordPrompt(() => {
    return new MessageVisual(
      `Your subscription is now active! To update your settings, simply run \`!alert subscribe\` again. ` +
        `To remove your subscription, run \`!alert unsubscribe\`, and to show your subscription status run \`!alert status\`.`
    )
  })
)

askPlayers.addChild(askCharacters)
askCharacters.addChild(askTimezone)
askTimezone.addChild(askWeekdayTimeframes)
askWeekdayTimeframes.addChild(askWeekendTimeframes)
askWeekendTimeframes.addChild(success)

module.exports = async function ({client, log, statsEmitter, Storage}) {
  const store = new Storage('alert', {subscriptions: []})
  await store.restore()

  async function messageHandler(message) {
    const parsed = parser.parse(message, '!', {allowBots: false})
    if (!parsed.success || parsed.command !== 'alert') return

    switch (parsed.reader.getString()) {
      case 'help':
        message.reply(
          `The !alert command is used to set up a permanent subscription to online player notifications. ` +
            `Alerts are sent no more than once every 12 hours and only to users who are online and not on DND. ` +
            `The following commands are available:\n\n` +
            `**!alert subscribe**\n` +
            `Create or update a subscription.\n` +
            `**!alert status**\n` +
            `Show your current subscription status.\n` +
            `**!alert debug**\n` +
            `Print debug information.\n` +
            `**!alert unsubscribe**\n` +
            `Remove your subscription.`
        )
        break
      case 'status':
        status(message.author)
        break
      case 'debug':
        debug(message.author)
        break
      case 'subscribe':
        subscribe(message.author)
        break
      case 'unsubscribe':
        unsubscribe(message.author)
        break
      default:
        message.reply('Unknown command. See `!alert help` for usage.')
    }
  }

  async function debug(user) {
    const subscription = store.get('subscriptions').find(s => s.id === user.id)
    if (subscription) {
      user.send(`\n\`\`\`json\n${JSON.stringify(subscription, null, 2)}\n\`\`\``)
    } else {
      user.send('error: You are not subscribed.')
    }
  }

  async function status(user) {
    const subscription = store.get('subscriptions').find(s => s.id === user.id)
    if (subscription) {
      user.send(
        `${
          `You are subscribed.\n` +
          `Player threshold: ${subscription.players}\n` +
          `Characters: ${subscription.characters.join(' ')}\n` +
          `Timezone: ${subscription.timezone}\n` +
          `Time frames: \n`
        }${subscription.timeframes
          .map((t, i) => {
            const day = DayOfWeek.of(i + 1).name()
            const dayString = day[0].toUpperCase() + day.slice(1).toLowerCase()
            return `    ${dayString} ${t[0]}-${t[1]}`
          })
          .join('\n')}`
      )
    } else {
      user.send('You are not subscribed.')
    }
  }

  async function subscribe(user) {
    const runner = new DiscordPromptRunner(user, {})
    const channel = await user.createDM()
    try {
      const data = await runner.run(askPlayers, channel)
      delete data.__authorID
      store.set(
        'subscriptions',
        store
          .get('subscriptions')
          .filter(s => s.id !== user.id)
          .concat([
            {
              ...data,
              id: user.id,
              tag: user.tag,
              lastNotification: Date.now(),
            },
          ])
      )
    } catch (error) {
      if (error instanceof Errors.UserInactivityError) {
        channel.send('Signup timed out.')
      } else if (error instanceof Errors.UserVoluntaryExitError) {
        channel.send('Signup terminated.')
      } else {
        log.error(`error during signup dialog: ${error.message}`)
        channel.send('An unexpected error occured.')
      }
    }
  }

  async function unsubscribe(user) {
    if (!store.get('subscriptions').find(s => s.id === user.id)) {
      return user.send('You are not subscribed.')
    }
    store.set(
      'subscriptions',
      store.get('subscriptions').filter(s => s.id !== user.id)
    )
    user.send('You are now unsubscribed.')
  }

  async function updateHandler(stats) {
    const totalPlayers = stats.players.length
    for (const [idx, subscription] of Object.entries(store.get('subscriptions'))) {
      const now = ZonedDateTime.now(ZoneId.of(subscription.timezone))
      const from = LocalDateTime.now()
        .truncatedTo(ChronoUnit.DAYS)
        .plusNanos(LocalTime.parse(subscription.timeframes[now.dayOfWeek().value() - 1][0]).toNanoOfDay())
        .atZone(ZoneId.of(subscription.timezone))
      const to = LocalDateTime.now()
        .truncatedTo(ChronoUnit.DAYS)
        .plusNanos(LocalTime.parse(subscription.timeframes[now.dayOfWeek().value() - 1][1]).toNanoOfDay())
        .atZone(ZoneId.of(subscription.timezone))
      if (
        subscription.players > totalPlayers ||
        LocalDateTime.ofInstant(Instant.ofEpochMilli(subscription.lastNotification)).until(
          LocalDateTime.now(),
          ChronoUnit.HOURS
        ) < 12 ||
        subscription.characters.find(character => stats.players.find(p => character === p.name)) ||
        from.isAfter(now) ||
        to.isBefore(now)
      ) {
        continue
      }
      const user = await client.users.fetch(subscription.id)
      if (user.presence.status === 'offline' || user.presence.status === 'dnd') continue
      user.send(
        `**${totalPlayers} players are online on PSForever. Join the battle now!**\n` +
          `You subscribed to this message. To unsubscribe, reply with \`!alert unsubscribe\`.`
      )
      const subscriptions = store.get('subscriptions')
      subscriptions[idx].lastNotification = Date.now()
      store.set('subscriptions', subscriptions)
      log.info(`alerted ${subscription.tag}`)
    }
  }

  statsEmitter.on('update', updateHandler)
  client.on('message', messageHandler)
  return async function () {
    await store.put()
    client.off('message', messageHandler)
    statsEmitter.off('update', updateHandler)
  }
}
