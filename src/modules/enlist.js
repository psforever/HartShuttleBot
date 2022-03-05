const Discord = require('discord.js')
const {Duration} = require('@js-joda/core')
const emojis = {
  terran: '444448298657513482',
  newcon: '231260160511705088',
  vanu: '231260169676390403',
  thumbsup: '👍', // for testing
}

module.exports = async function ({client, statsEmitter, log, config, Storage}) {
  if (!config.get('enlist.channelId')) {
    log.warn('channelId not set, skipping initialization')
    return function () {}
  }
  const channel = await client.channels.fetch(config.get('enlist.channelId'))

  const store = new Storage('enlist', {subscriptions: []})
  await store.restore()
  let message = null
  let stats = await statsEmitter.fetch()

  const embedMessages = (await channel.messages.fetch({limit: 10})).filter(
    m => m.author.id === client.user.id && m.embeds.length > 0
  )
  if (embedMessages.size > 0) {
    message = embedMessages.first()
    message = await message.edit({embeds: [embed()]})
    await updateSubscriptions()
  } else {
    message = await channel.send({embeds: [embed()]})
  }

  try {
    await message.react(emojis.terran)
    await message.react(emojis.newcon)
    await message.react(emojis.vanu)
  } catch (e) {
    log.warn(e.message)
  }

  async function updateHandler(newStats) {
    if (
      newStats.empires.TR !== stats.empires.TR ||
      newStats.empires.NC !== stats.empires.NC ||
      newStats.empires.VS !== stats.empires.VS
    ) {
      stats = newStats
      message = await message.edit(embed())
    } else {
      message = await message.fetch()
    }
    await updateSubscriptions()

    if (
      store.get('subscriptions').length > 0 &&
      store.get('subscriptions').length + stats.players.length >= config.get('enlist.minPlayers')
    ) {
      const pings = store
        .get('subscriptions')
        .map(s => `<@${s.id}>`)
        .join(' ')
      await channel.send(
        `Your shuttle has arrived! ${store.get('subscriptions').length} players are ready to play and ${
          stats.players.length
        } players are already online. We hope to see you on the battlefield.\n${pings}`
      )
      for (const subscription of store.get('subscriptions')) {
        await unsubscribe(subscription)
      }
      log.info(`notified ${pings}`)
    }

    // filter out expired subscriptions
    for (const subscription of store.get('subscriptions')) {
      if (Date.now() - subscription.time > Duration.ofHours(2).toMillis()) {
        await unsubscribe(subscription)
      }
    }

    // clear notifications after 10 minutes
    const oldMessages = (await channel.messages.fetch({limit: 10})).filter(
      m =>
        m.author.id === client.user.id &&
        m.embeds.length === 0 &&
        Date.now() - m.createdTimestamp > Duration.ofMinutes(10).toMillis()
    )
    for (const [, oldMessage] of oldMessages) {
      await oldMessage.delete()
    }
  }

  function embed() {
    const newMessage = new Discord.MessageEmbed().setURL('https://play.psforever.net')

    if (stats.status !== 'UP') {
      return newMessage.setColor('#ff0000').setTitle('Server Offline')
    }

    return newMessage
      .setColor('#0099ff')
      .setAuthor({
        name: 'How to play',
        url: 'https://docs.google.com/document/d/1ZMx1NUylVZCXJNRyhkuVWT0eUKSVYu0JXsU-y3f93BY/edit',
        iconURL: 'https://psforever.net/index_files/logo_crop.png',
      })
      .setTitle('Server Online')
      .addField(
        `Online Players: ${stats.players.length}`,
        [
          ['TR', 'terran'],
          ['NC', 'newcon'],
          ['VS', 'vanu'],
        ]
          .map(v => `${stats.empires[v[0]]} <:${v[1]}:${emojis[v[1]]}>`)
          .join(' ')
      )
      .addFields({
        name: 'Want to subscribe to battle alerts?',
        value: `Direct message <@${client.user.id}> with \`!alert subscribe\` to get started.`,
      })
      .addFields({
        name: 'Want to start a battle?',
        value: `React with your faction of choice and get notified if we get to ${config.get(
          'enlist.minPlayers'
        )} enlisted and online players within the next two hours.\n`,
      })
  }

  async function updateSubscriptions() {
    const active = []
    for (const [, reaction] of message.reactions.cache) {
      await reaction.users.fetch()

      if (!Object.values(emojis).find(id => id === reaction.emoji.id)) {
        await reaction.remove()
        continue
      }

      for (const [, user] of reaction.users.cache) {
        active.push(user.id)
        if (user.id !== client.user.id && !store.get('subscriptions').find(s => s.id === user.id)) {
          if (stats.players.length < config.get('enlist.minPlayers')) {
            await subscribe(user)
          } else {
            // server has plenty of online players, go away
            await unsubscribe(user)
          }
        }
      }
    }
    for (const subscription of store.get('subscriptions')) {
      if (!active.find(uid => uid === subscription.id)) {
        await unsubscribe(subscription)
      }
    }
  }

  async function subscribe({id, tag}) {
    const subscriptions = store.get('subscriptions')
    const idx = subscriptions.findIndex(s => s.id === id)
    if (idx === -1) {
      store.set(
        'subscriptions',
        subscriptions.concat([
          {
            id,
            tag,
            time: Date.now(),
          },
        ])
      )
    } else {
      subscriptions[idx].time = Date.now()
      store.set('subscriptions', subscriptions)
    }
    log.info(`subscribed ${tag}`)
  }

  async function unsubscribe({id, tag}) {
    store.set(
      'subscriptions',
      store.get('subscriptions').filter(s => s.id !== id)
    )
    for (const [, reaction] of message.reactions.cache) {
      await reaction.users.fetch()
      for (const [, user] of reaction.users.cache) {
        if (user.id === id) {
          await reaction.users.remove(id)
        }
      }
    }
    log.info(`unsubscribed ${tag}`)
  }

  statsEmitter.on('update', updateHandler)
  return async function () {
    await store.put()
    statsEmitter.off('update', updateHandler)
  }
}
