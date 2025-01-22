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

const parseEventInfo = async (data, country) => {
  const jsonMatch = data.match(/<script id="index-data" type="application\/json">\s*(.*?)\s*<\/script>/);
  if (!jsonMatch || jsonMatch.length < 2) return;
  const jsonData = jsonMatch[1];
  const parsedJson = JSON.parse(jsonData);
  // console.log(parsedJson)
  const cad = await usdToCAD()
  const eventObject = {
    name: parsedJson.eventName,
    url: parsedJson.eventUrl,
    venue: parsedJson.venueName,
    date: parsedJson.formattedEventDateTime,
    minPrice: Math.round(parsedJson.grid.minPrice * cad),
    minPriceUsd: Math.round(parsedJson.grid.minPrice),
    id: parsedJson.eventId,
    countryDomain: country
  };
  return eventObject
}

app.post('/email-user', async (req, res) => {
  const { email, date, name, url } = req.body;
  console.log('sending email for:', name)
  const mailer = 'stubhub.alerts@gmail.com';
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

async function retryFetch(url, country, retries = 3, delay = 100) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        console.log('response is not ok!')
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.text();
      const priceObject = await parseEventInfo(data, country);
      console.log(priceObject)

      if (priceObject) {
        return priceObject;
      } else {
        throw new Error('Price object is undefined');
      }
    } catch (error) {
      console.error(`Attempt ${attempt} failed for URL ${url}: ${error.message}`);
      
      if (attempt < retries) {
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw new Error(`Failed after ${retries} attempts: ${error.message}`);
      }
    }
  }
}

app.get('/get-event-info', async (req, res) => {
  const results = [];
  const eventIds = req.query.id.split(',');
  const country = req.query.country;

  try {
    await Promise.all(eventIds.map(async (id) => {
      const url = `https://www.stubhub.${country}/event/${id}/?quantity=0`;

      try {
        const priceObject = await retryFetch(url, country);
        results.push(priceObject);
      } catch (fetchError) {
        console.error(`Failed to fetch data for event ID ${id}: ${fetchError.message}`);
        results.push({ id, error: fetchError.message });
      }
    }))
    res.send(results);
  } catch (error) {
    console.log('Got an error:', error)
    res.status(500).send('Error fetching data')
  }
})

app.listen('3000', () => {
  console.log('Listening on port 3000');
});