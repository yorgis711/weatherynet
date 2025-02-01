const express = require('express');
const cors = require('cors'); // Import CORS middleware
const app = express();
const fetch = require('node-fetch');

// Enable CORS for specific routes
const corsOptions = {
  origin: '*', // Allow all origins (you can restrict this to specific domains)
  methods: 'GET', // Allow only GET requests
  optionsSuccessStatus: 200 // Legacy browsers compatibility
};

// HTML content (same as before)
const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Weather Forecast</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
    <style>
        /* Keep all previous CSS styles */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); min-height: 100vh; padding: 2rem; color: #2d3436; }
        .container { max-width: 1200px; margin: 0 auto; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); border-radius: 20px; box-shadow: 0 8px 32px rgba(0,0,0,0.1); padding: 2rem; }
        .header { text-align: center; margin-bottom: 2rem; }
        .header h1 { font-weight: 600; font-size: 2.5rem; color: #2d3436; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
        .forecast-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; }
        .day-card { background: white; border-radius: 15px; padding: 1.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.05); transition: transform 0.2s ease; }
        .day-card:hover { transform: translateY(-5px); }
        .date-header { font-size: 1.1rem; font-weight: 500; margin-bottom: 1rem; color: #636e72; display: flex; align-items: center; gap: 0.5rem; }
        .hourly-list { display: grid; gap: 1rem; }
        .hour-item { display: flex; justify-content: space-between; align-items: center; padding: 0.8rem; background: #f8f9fa; border-radius: 10px; }
        .time { display: flex; align-items: center; gap: 0.5rem; font-weight: 500; color: #2d3436; }
        .temperature { font-weight: 600; color: #e17055; font-size: 1.1rem; }
        .material-icons { font-size: 1.2rem; vertical-align: middle; }
        .loading { text-align: center; padding: 2rem; font-size: 1.2rem; color: #636e72; }
        .error { color: #d63031; text-align: center; padding: 2rem; display: none; }
        @media (max-width: 768px) { body { padding: 1rem; } .container { padding: 1rem; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1><span class="material-icons">cloud</span>Weather Forecast</h1>
            <p id="location-display" style="margin-top: 0.5rem; color: #636e72;">Locating...</p>
        </div>
        <div id="loading" class="loading">
            <span class="material-icons spin">autorenew</span>
            <div style="margin-top: 0.5rem;">Loading weather data...</div>
        </div>
        <div id="forecast-container" class="forecast-grid"></div>
        <div id="error" class="error"></div>
    </div>

    <script>
        const API_BASE = window.location.origin;

        async function fetchWeatherData(lat, lon) {
            try {
                const response = await fetch(`${API_BASE}/api/weather?latitude=${lat}&longitude=${lon}`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return await response.json();
            } catch (error) {
                showError(`Failed to load data: ${error.message}`);
                return null;
            }
        }

        // Keep all previous JavaScript functions
        function formatTime(time24) { /* ... */ }
        function getTimeIcon(hour) { /* ... */ }
        function createDayCard(date, hours) { /* ... */ }
        function showError(message) { /* ... */ }

        async function getLocation() {
            return new Promise((resolve, reject) => {
                if (!navigator.geolocation) {
                    fetch(`${API_BASE}/api/ipgeo`)
                        .then(response => response.json())
                        .then(data => resolve({ latitude: data.latitude, longitude: data.longitude }))
                        .catch(error => reject(new Error('Geolocation not supported and IP lookup failed')));
                } else {
                    navigator.geolocation.getCurrentPosition(
                        position => resolve({
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude
                        }),
                        async () => {
                            try {
                                const ipData = await fetch(`${API_BASE}/api/ipgeo`);
                                const data = await ipData.json();
                                resolve({ latitude: data.latitude, longitude: data.longitude });
                            } catch (error) {
                                reject(new Error('Could not retrieve location'));
                            }
                        }
                    );
                }
            });
        }

        async function init() {
            try {
                const coords = await getLocation();
                document.getElementById('location-display').textContent = 
                    `Latitude: ${coords.latitude.toFixed(2)} | Longitude: ${coords.longitude.toFixed(2)}`;

                const data = await fetchWeatherData(coords.latitude, coords.longitude);
                if (!data) return;

                document.getElementById('loading').style.display = 'none';
                const container = document.getElementById('forecast-container');
                
                const dates = {};
                data.hourly.time.forEach((timestamp, index) => {
                    const date = timestamp.split('T')[0];
                    dates[date] = dates[date] || [];
                    dates[date].push({
                        time: timestamp.split('T')[1].substring(0, 5),
                        temperature: data.hourly.temperature_2m[index]
                    });
                });

                Object.entries(dates).forEach(([date, hours]) => {
                    container.appendChild(createDayCard(date, hours));
                });
            } catch (error) {
                showError(error.message);
                document.getElementById('loading').style.display = 'none';
            }
        }

        // Add spin animation
        const style = document.createElement('style');
        style.textContent = `@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }`;
        document.head.appendChild(style);

        window.onload = init;
    </script>
</body>
</html>
`;

// Serve HTML at root path
app.get('/', (req, res) => {
    res.set('Content-Type', 'text/html');
    res.send(htmlContent);
});

// IP Geolocation endpoint with CORS
app.get('/api/ipgeo', cors(corsOptions), async (req, res) => {
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

// Weather API endpoint with CORS
app.get('/api/weather', cors(corsOptions), async (req, res) => {
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

// Security headers middleware
app.use((req, res, next) => {
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(self)'
    });
    next();
});

// Vercel configuration
module.exports = app;

// Local development
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}