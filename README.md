# slaurbot

I am the custom bot for [slaurent22](https://twitch.tv/slaurent22) on Twitch.

## Local Development
Requires [the Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) and [NodeJs](https://nodejs.org/en/).

Create a `.env` file with:
```
TWITCH_CHANNEL_NAME=slaurent22
TWITCH_CLIENT_ID=[redacted]
TWITCH_CLIENT_SECRET=[redacted]
REDIS_URL=[redacted]
DISCORD_BOT_TOKEN=[redacted]
```

Build
```
npm run build
```

Start
```
npm start
```
