# HartShuttleBot

A Discord bot for PSForever.

## Run

1. `npm install` to install dependencies
2. [Create an application](https://discord.com/developers/applications) if you haven't already
3. Set the config via env variables (or put them in `.env`)
4. `npm start`

## Add it to your server

Open this URL (fill in `your_client_id`):

```
https://discordapp.com/oauth2/authorize?client_id=your_client_id&scope=bot
```

## Configuration

- `DISCORD_TOKEN`: Discord access token (required)
- `S3_ACCESS_KEY_ID`: S3 access key ID (required)
- `S3_ACCESS_KEY`: S3 access key (required)
- `S3_BUCKET_NAME`: S3 bucket name (required)
- `S3_ENDPOINT`: S3 endpoint (required)
- `SENTRY_DSN`: Sentry DSN (optional)
- `API_URL`: API URL (default `https://play.psforever.net`)