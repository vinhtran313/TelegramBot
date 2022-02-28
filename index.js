const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();
const cron = require('node-cron');
const axios = require('axios');
const { Telegraf } = require('telegraf');
const admin = require('firebase-admin');
const currencyFormatter = require('currency-formatter');
const serviceAccount = require('./key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();
const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
app.use(bodyParser.json());

app.use(bodyParser.urlencoded({ extended: true }));
bot.start(async (ctx) => {
  ctx.reply('Welcome!');
  ctx.reply(ctx.message.chat.id);
  const data = {
    id: ctx.message.chat.id,
    name: ctx.message.chat.first_name,
  };
  const res = await db
    .collection('users')
    .doc(ctx.message.chat.id.toString())
    .set(data);
});
bot.help((ctx) => ctx.reply('Send me a sticker'));
bot.on('sticker', (ctx) => ctx.reply('👍'));
bot.hears('hi', (ctx) => ctx.reply('Hey there'));
bot.launch();

async function sendVolumeMessage() {
  const usersDb = db.collection('users');
  const snapshot = await usersDb.get();
  const users = snapshot.docs.map((doc) => doc.data());
  try {
    const BTCInfo = await axios.get(
      `${process.env.BASE_API}/fapi/v1/ticker/24hr`,
      {
        params: {
          symbol: 'BTCUSDT',
        },
      }
    );
    const BTCFundingRate = await axios.get(
      `${process.env.BASE_API}/fapi/v1/premiumIndex`,
      {
        params: {
          symbol: 'BTCUSDT',
        },
      }
    );
    users.forEach((user) => {
      bot.telegram.sendMessage(
        user.id,
        `BTC: ${currencyFormatter.format(BTCInfo.data.lastPrice, {
          symbol: '',
          decimal: '.',
          thousand: ',',
          precision: 1,
          format: '%v %s',
        })}$\nVol BTC: ${currencyFormatter.format(BTCInfo.data.volume, {
          symbol: '₿',
          decimal: '.',
          thousand: ',',
          precision: 1,
          format: '%v %s',
        })}\nVol USDT: ${currencyFormatter.format(BTCInfo.data.quoteVolume, {
          code: 'USD',
        })}\nFunding Rate: ${(
          BTCFundingRate.data.lastFundingRate * 100
        ).toFixed(2)}%`
      );
    });
    return;
  } catch (error) {
    users.forEach((user) => {
      bot.telegram.sendMessage(
        user.id,
        'Có lỗi xảy ra, chúng tôi sẽ xử lý trong phút chốc!'
      );
    });
  }
}

cron.schedule('*/5 * * * *', sendVolumeMessage);

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
