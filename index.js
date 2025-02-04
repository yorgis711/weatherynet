const express = require('express');
const app = express();
const request = require('request');

app.use(express.static('public'));

// API endpoint
app.get('/api', (req, res) => {
    const lat = req.query.lat;
    const long = req.query.long;
    
    if (!lat || !long) {
        return res.status(400).json({ error: "Missing latitude or longitude parameters" });
    }

    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${long}
        &hourly=temperature_2m,precipitation_probability,precipitation,weathercode
        &daily=weathercode,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,precipitation_probability_max
        &current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m
        &timezone=auto
        &forecast_days=30`.replace(/\s+/g, '');

    request(apiUrl, (error, response, body) => {
        if (error) {
            return res.status(500).json({ error: "Failed to fetch weather data" });
        }
        
        try {
            const data = JSON.parse(body);
            const formattedData = {
                current: {
                    temperature: data.current.temperature_2m,
                    feels_like: data.current.apparent_temperature,
                    humidity: data.current.relative_humidity_2m,
                    precipitation: data.current.precipitation,
                    wind_speed: data.current.wind_speed_10m,
                    wind_direction: data.current.wind_direction_10m,
                },
                daily: data.daily.time.map((time, index) => ({
                    date: new Date(time).toLocaleDateString(),
                    sunrise: data.daily.sunrise[index].split('T')[1],
                    sunset: data.daily.sunset[index].split('T')[1],
                    temp_max: data.daily.temperature_2m_max[index],
                    temp_min: data.daily.temperature_2m_min[index],
                    precipitation: data.daily.precipitation_sum[index],
                    precipitation_chance: data.daily.precipitation_probability_max[index],
                    weathercode: data.daily.weathercode[index]
                })),
                hourly: data.hourly.time.map((time, index) => ({
                    time: new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    temperature: data.hourly.temperature_2m[index],
                    precipitation_chance: data.hourly.precipitation_probability[index],
                    precipitation: data.hourly.precipitation[index],
                    weathercode: data.hourly.weathercode[index]
                })).slice(0, 24)
            };
            
            res.json(formattedData);
        } catch (e) {
            res.status(500).json({ error: "Failed to parse weather data" });
        }
    });
});

// UI Route
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Weather Forecast</title>
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Round" rel="stylesheet">
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
                font-family: 'Segoe UI', sans-serif;
            }

            body {
                background: #f0f4f8;
                color: #2d3436;
                min-height: 100vh;
                padding: 2rem;
            }

            .container {
                max-width: 1200px;
                margin: 0 auto;
            }

            .header {
                text-align: center;
                margin-bottom: 2rem;
            }

            .current-weather {
                background: white;
                padding: 2rem;
                border-radius: 20px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                margin-bottom: 2rem;
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1rem;
            }

            .current-item {
                text-align: center;
            }

            .temp {
                font-size: 2.5rem;
                font-weight: bold;
                color: #2d3436;
            }

            .widgets-container {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 1.5rem;
                margin-bottom: 2rem;
            }

            .widget {
                background: white;
                padding: 1.5rem;
                border-radius: 15px;
                cursor: pointer;
                transition: transform 0.2s;
                box-shadow: 0 4px 6px rgba(0,0,0,0.05);
            }

            .widget:hover {
                transform: translateY(-3px);
            }

            .widget-header {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                margin-bottom: 1rem;
            }

            .modal {
                display: none;
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                padding: 2rem;
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                z-index: 1000;
                max-width: 90%;
                max-height: 90vh;
                overflow-y: auto;
            }

            .modal-overlay {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                z-index: 999;
            }

            .modal.active, .modal-overlay.active {
                display: block;
            }

            .forecast-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 1rem;
                padding: 1rem 0;
            }

            .forecast-item {
                padding: 1rem;
                background: #f8f9fa;
                border-radius: 10px;
                text-align: center;
            }

            .weather-icon {
                font-size: 1.5rem;
                margin: 0.5rem 0;
            }

            .wind-direction {
                display: inline-block;
                transition: transform 0.3s;
            }

            .loading {
                text-align: center;
                padding: 2rem;
                font-size: 1.2rem;
            }

            .material-icons-round {
                vertical-align: middle;
            }

            .close-btn {
                margin-top: 1rem;
                padding: 0.5rem 1rem;
                background: #2d3436;
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1><span class="material-icons-round">cloud</span> Weather Forecast</h1>
                <p id="location" class="location"></p>
            </div>

            <div class="current-weather" id="current-weather"></div>

            <div class="widgets-container">
                <div class="widget" onclick="showModal('hourly')">
                    <div class="widget-header">
                        <span class="material-icons-round">schedule</span>
                        <h3>24-Hour Forecast</h3>
                    </div>
                    <div class="forecast-grid" id="hourly-preview"></div>
                </div>

                <div class="widget" onclick="showModal('daily')">
                    <div class="widget-header">
                        <span class="material-icons-round">calendar_today</span>
                        <h3>30-Day Forecast</h3>
                    </div>
                    <div class="forecast-grid" id="daily-preview"></div>
                </div>
            </div>

            <div class="modal-overlay" onclick="closeModal()"></div>
            <div class="modal" id="hourly-modal">
                <h2>24-Hour Detailed Forecast</h2>
                <div class="forecast-grid" id="hourly-forecast"></div>
                <button onclick="closeModal()" class="close-btn">Close</button>
            </div>

            <div class="modal" id="daily-modal">
                <h2>30-Day Detailed Forecast</h2>
                <div class="forecast-grid" id="daily-forecast"></div>
                <button onclick="closeModal()" class="close-btn">Close</button>
            </div>
        </div>

        <script>
            let weatherData = null;

            async function getLocation() {
                return new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(
                        position => resolve(position.coords),
                        error => reject(error)
                    );
                });
            }

            async function loadWeather() {
                try {
                    const coords = await getLocation();
                    const response = await fetch(\`/api?lat=\${coords.latitude}&long=\${coords.longitude}\`);
                    weatherData = await response.json();
                    
                    document.getElementById('location').textContent = 
                        \`Latitude: \${coords.latitude.toFixed(2)}, Longitude: \${coords.longitude.toFixed(2)}\`;

                    updateCurrentWeather();
                    updatePreviewWidgets();
                    
                } catch (error) {
                    alert('Error loading weather data: ' + error.message);
                }
            }

            function updateCurrentWeather() {
                const current = weatherData.current;
                const container = document.getElementById('current-weather');
                
                container.innerHTML = \`
                    <div class="current-item">
                        <div class="temp">\${current.temperature}°C</div>
                        <div>Feels like \${current.feels_like}°C</div>
                    </div>
                    <div class="current-item">
                        <div><span class="material-icons-round">air</span> \${current.wind_speed} km/h</div>
                        <div class="wind-direction" style="transform: rotate(\${current.wind_direction}deg)">⬇️</div>
                    </div>
                    <div class="current-item">
                        <div><span class="material-icons-round">water_drop</span> \${current.humidity}%</div>
                        <div><span class="material-icons-round">rainy</span> \${current.precipitation} mm</div>
                    </div>
                \`;
            }

            function updatePreviewWidgets() {
                // Hourly preview (next 6 hours)
                document.getElementById('hourly-preview').innerHTML = 
                    weatherData.hourly.slice(0, 6).map(hour => \`
                        <div class="forecast-item">
                            <div>\${hour.time}</div>
                            <div class="temp">\${hour.temperature}°C</div>
                            <div class="weather-icon">\${getWeatherIcon(hour.weathercode)}</div>
                        </div>
                    \`).join('');

                // Daily preview (next 5 days)
                document.getElementById('daily-preview').innerHTML = 
                    weatherData.daily.slice(0, 5).map(day => \`
                        <div class="forecast-item">
                            <div>\${day.date}</div>
                            <div>\${day.temp_max}°/\${day.temp_min}°</div>
                            <div class="weather-icon">\${getWeatherIcon(day.weathercode)}</div>
                        </div>
                    \`).join('');
            }

            function showModal(type) {
                document.querySelector('.modal-overlay').classList.add('active');
                const modal = document.getElementById(\`\${type}-modal\`);
                modal.classList.add('active');

                if (type === 'hourly') {
                    updateHourlyModal();
                } else {
                    updateDailyModal();
                }
            }

            function updateHourlyModal() {
                document.getElementById('hourly-forecast').innerHTML = 
                    weatherData.hourly.map(hour => \`
                        <div class="forecast-item">
                            <div>\${hour.time}</div>
                            <div class="temp">\${hour.temperature}°C</div>
                            <div class="weather-icon">\${getWeatherIcon(hour.weathercode)}</div>
                            <div>\${hour.precipitation_chance}%</div>
                        </div>
                    \`).join('');
            }

            function updateDailyModal() {
                document.getElementById('daily-forecast').innerHTML = 
                    weatherData.daily.map(day => \`
                        <div class="forecast-item">
                            <div>\${day.date}</div>
                            <div>\${day.temp_max}°/\${day.temp_min}°</div>
                            <div class="weather-icon">\${getWeatherIcon(day.weathercode)}</div>
                            <div>\${day.precipitation_chance}%</div>
                        </div>
                    \`).join('');
            }

            function closeModal() {
                document.querySelectorAll('.modal, .modal-overlay').forEach(el => {
                    el.classList.remove('active');
                });
            }

            function getWeatherIcon(code) {
                const icons = {
                    0: '☀️', 1: '🌤', 2: '⛅', 3: '☁️', 45: '🌫', 48: '🌫',
                    51: '🌦', 53: '🌦', 55: '🌧', 56: '🌧', 57: '🌧',
                    61: '🌧', 63: '🌧', 65: '🌧', 66: '🌨', 67: '🌨',
                    71: '🌨', 73: '🌨', 75: '🌨', 77: '🌨', 80: '🌦',
                    81: '🌧', 82: '🌧', 85: '🌨', 86: '🌨', 95: '⛈',
                    96: '⛈', 99: '⛈'
                };
                return icons[code] || '🌤';
            }

            // Initialize
            window.onload = loadWeather;
        </script>
    </body>
    </html>
    `);
});

app.listen(8080, () => console.log('Server running on http://localhost:8080'));
