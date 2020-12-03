# slaurbot

## Local Development
Requires [the Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) and [NodeJs](https://nodejs.org/en/).

Create a `.env` file with:
```
TWITCH_CHANNEL_NAME=slaurent22
TWITCH_CLIENT_ID=[redacted]
TWITCH_CLIENT_SECRET=[redacted]
REDIS_TLS_URL=[redacted]
REDIS_URL=[redacted]
```

Build
```
npm run build
```

Start
```
npm start
```
