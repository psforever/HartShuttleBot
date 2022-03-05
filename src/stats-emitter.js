const {EventEmitter} = require('events')
const fetch = require('node-fetch')
const log = require('./log')

class StatsEmitter extends EventEmitter {
  constructor(...args) {
    super(...args)
    setInterval(async () => {
      try {
        const stats = await this.fetch()
        this.emit('update', stats)
      } catch (e) {
        log.error(e.message)
      }
    }, 60000)
  }

  async fetch() {
    const res = await fetch('https://play.psforever.net/api/stats')
    return await res.json()
  }
}

module.exports = StatsEmitter
