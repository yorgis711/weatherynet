const express = require('express');
const app = express();
const cors = require('cors');

// Use dynamic import for node-fetch
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Enable CORS for all routes
app.use(cors());

// Serve HTML at root path
app.get('/', (req, res) => {
    res.set('Content-Type', 'text/html');
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Weather Forecast</title>
        </head>
        <body>
            <h1>Weather Forecast</h1>
            <p>Check your weather forecast here.</p>
        </body>
        </html>
    `);
});

// IP Geolocation endpoint
app.get('/api/ipgeo', async (req, res) => {
    try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        res.json({
            latitude: data.latitude,
            longitude: data.longitude,
            city: data.city,
            region: data.region
        });
    } catch (error) {
        res.status(500).json({ error: 'IP Geolocation failed', details: error.message });
    }
});

// Weather API endpoint
app.get('/api/weather', async (req, res) => {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
        return res.status(400).json({ error: 'Missing coordinates' });
    }

    try {
        const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m`
        );
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Weather API failed', details: error.message });
    }
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));