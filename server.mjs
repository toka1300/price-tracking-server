import express from 'express'
import fetch from 'node-fetch'

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "chrome-extension://mfodbkoihimojjaiofnfnjhkgehbeecj");
  next();
})

const parsePriceInfo = (data) => {
  const jsonMatch = data.match(/<script id="index-data" type="application\/json">\s*(.*?)\s*<\/script>/);
  if (!jsonMatch || jsonMatch.length < 2) return;
  const jsonData = jsonMatch[1];
  const parsedJson = JSON.parse(jsonData);
  return { minPrice: parsedJson?.grid?.minPrice }
}

app.get('/get-event-info', async (req, res) => {
  const eventIds = req.query.id;
  const url = `https://www.stubhub.ca/event/${eventIds}/?quantity=1`

  try {
    const response = await fetch(url);
    const data = await response.text();
    const priceObject = parsePriceInfo(data);
    res.send(priceObject);
  } catch (error) {
    res.status(500).send('Error fetching data')
  }
})

app.listen('3000', () => {
  console.log('Listening on port 3000');
});