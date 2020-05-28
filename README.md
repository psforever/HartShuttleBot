# PSForeverBot

A Discord bot to get people playing PSForever.

## Run

1. `npm install` to install dependencies
2. [Create an application](https://discord.com/developers/applications) if you haven't already
3. Set the `BOT_TOKEN` and  `BOT_CHANNEL_ID` environment variables (or put them in `.env`)
4. `npm start`

### Add it to your server
Open this URL (fill in `your_client_id`):
```
https://discordapp.com/oauth2/authorize?client_id=your_client_id&scope=bot
```

### Configuration

* `BOT_TOKEN`: Discord access token (required)
* `BOT_CHANNEL_ID`: Discord channel ID (required)
* `BOT_MIN_PLAYERS`: Min number of players that trigger a notification (default 20)