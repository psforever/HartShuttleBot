const {EventEmitter} = require('events')
const fetch = require('node-fetch')
const log = require('./log')
const cron = require('node-cron')

const API_URL = process.env.API_URL || 'https://play.psforever.net'

class StatsEmitter extends EventEmitter {
  constructor(...args) {
    super(...args)
    cron.schedule('* * * * *', async () => {
      try {
        const stats = await this.fetch()
        this.emit('update', stats)
      } catch (e) {
        log.error(e.message)
      }
    })
    /*
    setInterval(async () => {
      try {
        const stats = await this.fetch()
        this.emit('update', stats)
      } catch (e) {
        log.error(e.message)
      }
    }, 60000)
    */
  }

  async fetch() {
    const res = await fetch(`${API_URL}/api/stats`)
    return await res.json()
  }
}

module.exports = StatsEmitter
