import express from 'express'
import fetch from 'node-fetch'

const app = express();
app.use(express.json());

const parsePriceInfo = (data) => {
  const jsonMatch = data.match(/<script id="index-data" type="application\/json">\s*(.*?)\s*<\/script>/);
  if (!jsonMatch || jsonMatch.length < 2) return;
  const jsonData = jsonMatch[1];
  const parsedJson = JSON.parse(jsonData);
  return { minPrice: parsedJson?.grid?.minPrice }
}

app.get('/fetch-url', async (req, res) => {
  const targetUrl = req.query.url;

  try {
    const response = await fetch(targetUrl);
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