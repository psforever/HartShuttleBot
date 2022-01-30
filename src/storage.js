const AWS = require('aws-sdk')
const debounce = require('debounce')
const immutable = require('object-path-immutable')
const log = require('./log')

AWS.config.credentials = new AWS.Credentials({
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_ACCESS_KEY,
})
const s3 = new AWS.S3({
  endpoint: process.env.S3_ENDPOINT,
})

const bucketName = process.env.S3_BUCKET_NAME
const prefix = process.env.S3_PREFIX || process.env.NODE_ENV || 'development'

log.info(`bucket prefix: ${prefix}`)

module.exports = class Storage {
  constructor(key, initialValue) {
    this.key = key
    this.data = initialValue || {}
    this.changed = false
    this.debouncePut = debounce(async () => {
      await this.put()
    }, 10000)
  }

  async put() {
    if (!this.changed) return
    try {
      await s3
        .putObject({
          Bucket: bucketName,
          Key: `${prefix}/${this.key}.json`,
          Body: JSON.stringify(this.data),
        })
        .promise()
      this.changed = false
    } catch (e) {
      log.error(`could not store ${this.key}: ${e.message}`)
    }
  }

  async restore() {
    try {
      const res = await s3
        .getObject({
          Bucket: bucketName,
          Key: `${prefix}/${this.key}.json`,
        })
        .promise()
      const data = JSON.parse(res.Body.toString('utf-8'))
      for (const [key, value] of Object.entries(data)) {
        this.data[key] = value
      }
    } catch (e) {
      log.warn(`could not restore ${this.key}: ${e.message}`)
    }
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
    this.debouncePut()
  }
}
