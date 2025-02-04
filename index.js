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
        &hourly=temperature_2m,precipitation_probability,precipitation,visibility,wind_speed_10m,wind_direction_10m
        &current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,rain,visibility,wind_speed_10m,wind_direction_10m,is_day
        &daily=sunrise,sunset,precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min
        &timezone=auto
        &forecast_days=7`.replace(/\s+/g, '');

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
                    visibility: data.current.visibility,
                    wind_speed: data.current.wind_speed_10m,
                    wind_direction: data.current.wind_direction_10m,
                    sunrise: data.daily.sunrise[0].split('T')[1].slice(0,5),
                    sunset: data.daily.sunset[0].split('T')[1].slice(0,5)
                },
                daily: data.daily.time.map((time, index) => ({
                    date: new Date(time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                    sunrise: data.daily.sunrise[index].split('T')[1].slice(0,5),
                    sunset: data.daily.sunset[index].split('T')[1].slice(0,5),
                    precipitation: data.daily.precipitation_sum[index],
                    precipitation_chance: data.daily.precipitation_probability_max[index],
                    temp_max: data.daily.temperature_2m_max[index],
                    temp_min: data.daily.temperature_2m_min[index]
                })),
                hourly: data.hourly.time.map((time, index) => ({
                    time: new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    temperature: data.hourly.temperature_2m[index],
                    precipitation_chance: data.hourly.precipitation_probability[index],
                    precipitation: data.hourly.precipitation[index],
                    visibility: data.hourly.visibility[index],
                    wind_speed: data.hourly.wind_speed_10m[index],
                    wind_direction: data.hourly.wind_direction_10m[index]
                }))
            };
            
            res.json(formattedData);
        } catch (e) {
            res.status(500).json({ error: "Failed to parse weather data" });
        }
    });
});

// UI Route (updated styles and scripts)
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Weather Dashboard</title>
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Round" rel="stylesheet">
        <style>
            /* ... (keep previous styles) ... */
            .sun-info {
                display: flex;
                gap: 1rem;
                justify-content: center;
                margin-top: 0.5rem;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <!-- ... (keep previous HTML structure) ... -->
            <div class="current-weather" id="current-weather"></div>

            <div class="widgets-container">
                <!-- ... (keep widget HTML) ... -->
            </div>

            <!-- Modals -->
            <div class="modal-overlay"></div>
            <div class="modal" id="hourly-modal">
                <h2>24-Hour Forecast</h2>
                <div class="hourly-forecast" id="hourly-forecast"></div>
                <button onclick="closeModal()" class="close-btn">Close</button>
            </div>

            <div class="modal" id="daily-modal">
                <h2>7-Day Forecast</h2>
                <div class="daily-forecast" id="daily-forecast"></div>
                <button onclick="closeModal()" class="close-btn">Close</button>
            </div>
        </div>

        <script>
            // ... (keep previous script functions) ... 

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
                        <div class="sun-info">
                            <div><span class="material-icons-round">wb_sunny</span> \${current.sunrise}</div>
                            <div><span class="material-icons-round">nights_stay</span> \${current.sunset}</div>
                        </div>
                        <div><span class="material-icons-round">water_drop</span> \${current.humidity}%</div>
                        <div><span class="material-icons-round">visibility</span> \${current.visibility} km</div>
                    </div>
                \`;
            }

            function updatePreviewWidgets() {
                // Hourly preview
                const hourlyPreview = weatherData.hourly.slice(0, 3);
                document.getElementById('hourly-preview').innerHTML = hourlyPreview.map(hour => \`
                    <div class="hour-item">
                        <div>\${hour.time}</div>
                        <div class="temp">\${hour.temperature}°C</div>
                        <div>\${hour.precipitation_chance}%</div>
                    </div>
                \`).join('');

                // Daily preview
                const dailyPreview = weatherData.daily.slice(0, 3);
                document.getElementById('daily-preview').innerHTML = dailyPreview.map(day => \`
                    <div class="day-item">
                        <div>\${day.date.split(',')[0]}</div>
                        <div class="temp">\${day.temp_max}°/\${day.temp_min}°</div>
                        <div>\${day.precipitation_chance}%</div>
                    </div>
                \`).join('');
            }

            function updateDailyModal() {
                const container = document.getElementById('daily-forecast');
                container.innerHTML = weatherData.daily.map(day => \`
                    <div class="day-item">
                        <div style="flex: 1">\${day.date}</div>
                        <div style="flex: 1" class="temp">\${day.temp_max}°/\${day.temp_min}°</div>
                        <div style="flex: 2; display: flex; gap: 1rem; justify-content: center">
                            <div>
                                <span class="material-icons-round">wb_sunny</span>
                                \${day.sunrise}
                            </div>
                            <div>
                                <span class="material-icons-round">nights_stay</span>
                                \${day.sunset}
                            </div>
                        </div>
                        <div style="flex: 1; text-align: right">
                            <div>\${day.precipitation}mm</div>
                            <div>\${day.precipitation_chance}% chance</div>
                        </div>
                    </div>
                \`).join('');
            }
        </script>
    </body>
    </html>
    `);
});

app.listen(8080, () => console.log('Server running on http://localhost:8080'));
