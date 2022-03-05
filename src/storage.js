const Minio = require('minio')
const throttle = require('lodash.throttle')
const immutable = require('object-path-immutable')
const log = require('./log')

const minio = new Minio.Client({
  endPoint: process.env.S3_ENDPOINT.replace(/^https?:\/\//, ''),
  useSSL: process.env.S3_ENDPOINT.startsWith('https'),
  accessKey: process.env.S3_ACCESS_KEY_ID,
  secretKey: process.env.S3_ACCESS_KEY,
})

const bucketName = process.env.S3_BUCKET_NAME
const prefix = process.env.S3_PREFIX || process.env.NODE_ENV || 'development'

log.info(`bucket: ${bucketName}/${prefix}`)

module.exports = class Storage {
  constructor(key, initialValue) {
    this.key = key
    this.data = initialValue || {}
    this.changed = false
    this.put = throttle(async () => {
      await this._put()
    }, 60000)
  }

  async _put() {
    if (!this.changed) return
    try {
      await minio.putObject(bucketName, `${prefix}/${this.key}.json`, JSON.stringify(this.data))
      this.changed = false
    } catch (e) {
      log.error(`could not store ${this.key}: ${e.message}`)
    }
  }

  async restore() {
    const stream = await minio.getObject(bucketName, `${prefix}/${this.key}.json`)
    return new Promise((resolve, reject) => {
      let str = ''
      stream.on('data', data => (str += data.toString('utf-8')))
      stream.on('end', () => {
        try {
          const data = JSON.parse(str)
          for (const [key, value] of Object.entries(data)) {
            this.data[key] = value
          }
          resolve()
        } catch (e) {
          reject(e)
        }
      })
      stream.on('error', error => {
        reject(error)
      })
    })
  }

  get(path) {
    return path ? immutable.get(this.data, path) : this.data
  }

  set(path, value) {
    if (path) {
      this.data = immutable.set(this.data, path, value)
    } else {
      this.data = value
    }
    this.changed = true
    this.put()
  }
}
