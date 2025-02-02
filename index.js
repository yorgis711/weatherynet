const express = require('express');
const app = express();
const cors = require('cors');

// Use dynamic import for node-fetch
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Enable CORS for all routes
app.use(cors());

// Serve static files (if needed)
app.use(express.static('public'));

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
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 20px;
                }
                h1 {
                    color: #333;
                }
                pre {
                    background: #f4f4f4;
                    padding: 10px;
                    border-radius: 5px;
                    max-width: 600px;
                    overflow-x: auto;
                }
            </style>
            <script>
                // Use the browser's Geolocation API to get the client's coordinates
                function getClientLocation() {
                    if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                            async (position) => {
                                const { latitude, longitude } = position.coords;
                                try {
                                    // Fetch weather data using the coordinates
                                    const response = await fetch(\`/api/weather?latitude=\${latitude}&longitude=\${longitude}\`);
                                    const data = await response.json();
                                    // Display weather data on the page
                                    document.getElementById('weather').innerText = JSON.stringify(data, null, 2);
                                } catch (error) {
                                    console.error('Error fetching weather:', error);
                                    document.getElementById('weather').innerText = 'Failed to load weather data.';
                                }
                            },
                            (error) => {
                                console.error('Geolocation error:', error);
                                document.getElementById('weather').innerText = 'Geolocation access denied or unsupported.';
                            }
                        );
                    } else {
                        console.error('Geolocation is not supported by this browser.');
                        document.getElementById('weather').innerText = 'Geolocation is not supported by your browser.';
                    }
                }

                // Call the function when the page loads
                window.onload = getClientLocation;
            </script>
        </head>
        <body>
            <h1>Weather Forecast</h1>
            <p>Your weather forecast will be displayed below:</p>
            <pre id="weather">Loading weather data...</pre>
        </body>
        </html>
    `);
});

// IP Geolocation endpoint (using the client's IP address)
app.get('/api/ipgeo', async (req, res) => {
    try {
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const response = await fetch(\`https://ipapi.co/\${clientIp}/json/\`);
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
            \`https://api.open-meteo.com/v1/forecast?latitude=\${latitude}&longitude=\${longitude}&hourly=temperature_2m\`
        );
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Weather API failed', details: error.message });
    }
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(\`Server running on http://localhost:\${PORT}\`));