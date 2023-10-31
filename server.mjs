import express from 'express'
import fetch from 'node-fetch'
import nodemailer from 'nodemailer'
import { config } from 'dotenv-safe'

const app = express();
config();
app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
})

const usdToCAD = async () => {
  const resp = await fetch('https://api.exchangerate-api.com/v4/latest/usd');
  const json = await resp.json();
  const cad = json.rates.CAD
  return cad;
}


const parseEventInfo = async (data) => {
  const jsonMatch = data.match(/<script id="index-data" type="application\/json">\s*(.*?)\s*<\/script>/);
  if (!jsonMatch || jsonMatch.length < 2) return;
  const jsonData = jsonMatch[1];
  const parsedJson = JSON.parse(jsonData);
  const cad = await usdToCAD()
  const eventObject = {
    name: parsedJson.eventName,
    url: parsedJson.header.profileUrl.url,
    venue: parsedJson.venueName,
    date: parsedJson.formattedEventDateTime,
    minPrice: Math.round(parsedJson.grid.minPrice * cad),
    minPriceUsd: Math.round(parsedJson.grid.minPrice),
    id: parsedJson.eventId,
  };
  return eventObject
}

app.post('/email-user', async (req, res) => {
  const { email, date, name, url } = req.body;
  const mailer = 'stubhub.price.alert@gmail.com';
  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: mailer,
      pass: process.env.PASSWORD
    }
  })

  await transporter.sendMail({
    from: `"StubHub Price Alert" <${mailer}>`,
    to: email,
    subject: `Price Drop on your ${name} tickets!`,
    html: `
        <p>Hey There!</p>
        <p>Your ${name} tickets on ${date} have dropped below the price alert you set :)</p>
        <p><a href="${url}">Click here</a> to go buy your tickets before they get snapped up!</p>
    `
});
  res.set('Content-Type', 'text/html')
  res.send('Email sent!')
})

app.get('/get-event-info', async (req, res) => {
  console.log('Request from: ', req);
  const results = [];
  const eventIds = req.query.id.split(',');

  try {
    await Promise.all(eventIds.map(async (id) => {
      const url = `https://www.stubhub.ca/event/${id}/?quantity=2`;
      console.log(`Fetching: https://www.stubhub.ca/event/${id}/?quantity=2`);
      const response = await fetch(url);
      const data = await response.text();
      const priceObject = await parseEventInfo(data);
      console.log(priceObject);
      results.push(priceObject);
    }))
    res.send(results);
  } catch (error) {
    res.status(500).send('Error fetching data')
  }
})

app.listen('3000', () => {
  console.log('Listening on port 3000');
});