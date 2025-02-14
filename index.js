const express = require('express');
const app = express();
const request = require('request');

app.use(express.static('public'));

// Weather API endpoint
app.get('/api/weather', (req, res) => {
    const startTime = Date.now();
    let lat = parseFloat(req.query.lat) || 0;
    let lon = parseFloat(req.query.lon) || 0;
    const tz = req.query.tz || 'Etc/GMT';

    // Validate coordinates
    lat = isNaN(lat) ? 0 : Math.max(-90, Math.min(90, lat));
    lon = isNaN(lon) ? 0 : Math.max(-180, Math.min(180, lon));

    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=${encodeURIComponent(tz)}` +
        '&hourly=temperature_2m,precipitation_probability,precipitation,visibility,wind_speed_10m,wind_direction_10m' +
        '&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,rain,visibility,wind_speed_10m,wind_direction_10m,is_day' +
        '&daily=sunrise,sunset,precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min' +
        '&forecast_days=7';

    request(apiUrl, (error, response, body) => {
        const processingTime = Date.now() - startTime;
        
        if (error) {
            return res.status(500).json({ 
                error: "Failed to fetch weather data",
                processing_ms: processingTime
            });
        }

        try {
            const data = JSON.parse(body);
            const now = new Date().toLocaleString('en-US', { 
                timeZone: tz,
                hour12: false,
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });

            const formatTime = (isoString, timeZone) => {
                try {
                    const date = new Date(isoString);
                    return date.toLocaleTimeString('en-US', {
                        timeZone,
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    });
                } catch {
                    return '--:--';
                }
            };

            const responseData = {
                meta: {
                    processing_ms: processingTime,
                    current_time: now,
                    timezone: tz,
                    coordinates: { lat, lon }
                },
                current: {
                    temperature: `${data.current?.temperature_2m ?? 'N/A'}°C`,
                    feels_like: `${data.current?.apparent_temperature ?? 'N/A'}°C`,
                    humidity: `${data.current?.relative_humidity_2m ?? 'N/A'}%`,
                    precipitation: `${data.current?.precipitation ?? 0} mm`,
                    visibility: `${((data.current?.visibility ?? 0) / 1000).toFixed(1)} km`,
                    wind: {
                        speed: `${data.current?.wind_speed_10m ?? 'N/A'} km/h`,
                        direction: data.current?.wind_direction_10m ?? 0
                    },
                    sunrise: formatTime(data.daily?.sunrise?.[0], tz),
                    sunset: formatTime(data.daily?.sunset?.[0], tz)
                },
                daily: (data.daily?.time ?? []).map((time, i) => ({
                    date: new Date(time).toLocaleDateString('en-US', {
                        timeZone: tz,
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                    }),
                    temp_max: `${data.daily?.temperature_2m_max?.[i] ?? 'N/A'}°C`,
                    temp_min: `${data.daily?.temperature_2m_min?.[i] ?? 'N/A'}°C`,
                    precipitation: `${data.daily?.precipitation_sum?.[i] ?? 0} mm`,
                    precipitation_chance: `${data.daily?.precipitation_probability_max?.[i] ?? 0}%`,
                    sunrise: formatTime(data.daily?.sunrise?.[i], tz),
                    sunset: formatTime(data.daily?.sunset?.[i], tz)
                })),
                hourly: (data.hourly?.time ?? []).map((time, i) => ({
                    time: new Date(time).toLocaleTimeString([], {
                        timeZone: tz,
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    }),
                    temperature: `${data.hourly?.temperature_2m?.[i] ?? 'N/A'}°C`,
                    precipitation: `${data.hourly?.precipitation?.[i] ?? 0} mm`,
                    precipitation_chance: `${data.hourly?.precipitation_probability?.[i] ?? 0}%`,
                    visibility: `${((data.hourly?.visibility?.[i] ?? 0) / 1000).toFixed(1)} km`,
                    wind: {
                        speed: `${data.hourly?.wind_speed_10m?.[i] ?? 'N/A'} km/h`,
                        direction: data.hourly?.wind_direction_10m?.[i] ?? 0
                    }
                }))
            };

            res.json(responseData);
        } catch (e) {
            res.status(500).json({
                error: "Failed to parse weather data",
                processing_ms: processingTime
            });
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
        <title>Weather Dashboard</title>
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

            .meta-info {
                text-align: center;
                margin: 1rem 0;
                color: #666;
                font-size: 0.9rem;
                line-height: 1.4;
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
                display: flex;
                flex-direction: column;
                justify-content: center;
            }

            .temp {
                font-size: 2.5rem;
                font-weight: bold;
                color: #2d3436;
            }

            .sun-info {
                display: flex;
                justify-content: center;
                gap: 1.5rem;
                margin-top: 0.5rem;
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
                overflow: hidden;
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

            .hourly-preview, .daily-preview {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                gap: 1rem;
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
                width: 90%;
                max-width: 800px;
                min-width: 300px;
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

            .hourly-forecast {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                gap: 1rem;
                margin: 1rem 0;
            }

            .hour-item {
                padding: 1rem;
                background: #f8f9fa;
                border-radius: 10px;
                text-align: center;
            }

            .daily-forecast {
                display: grid;
                gap: 1rem;
            }

            .day-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0.8rem;
                background: #f8f9fa;
                border-radius: 10px;
                gap: 0.5rem;
                flex-wrap: wrap;
            }

            .day-item > div {
                flex: 1 1 120px;
                min-width: 0;
                padding: 0.3rem;
                word-break: break-word;
                white-space: normal;
                overflow: visible;
                text-overflow: clip;
            }

            .wind-direction {
                display: inline-block;
                transition: transform 0.3s;
            }

            .close-btn {
                margin-top: 1.5rem;
                padding: 0.8rem 2rem;
                background: #2d3436;
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                display: block;
                margin-left: auto;
                margin-right: auto;
                transition: opacity 0.2s;
            }

            .close-btn:hover {
                opacity: 0.9;
            }

            .material-icons-round {
                vertical-align: middle;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1><span class="material-icons-round">cloud</span> Weather Dashboard</h1>
                <div class="meta-info" id="meta"></div>
            </div>

            <div class="current-weather" id="current-weather"></div>

            <div class="widgets-container">
                <div class="widget" onclick="showModal('hourly')">
                    <div class="widget-header">
                        <span class="material-icons-round">schedule</span>
                        <h3>Hourly Forecast</h3>
                    </div>
                    <div class="hourly-preview" id="hourly-preview"></div>
                </div>

                <div class="widget" onclick="showModal('daily')">
                    <div class="widget-header">
                        <span class="material-icons-round">calendar_today</span>
                        <h3>7-Day Forecast</h3>
                    </div>
                    <div class="daily-preview" id="daily-preview"></div>
                </div>
            </div>

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
            let weatherData = null;

            async function getLocation() {
                return new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(
                        position => resolve(position.coords),
                        error => reject(error),
                        { timeout: 5000 }
                    );
                });
            }

            async function loadWeather() {
                try {
                    let coords = { latitude: 0, longitude: 0 };
                    let tz = 'Etc/GMT';
                    
                    try {
                        coords = await getLocation();
                        tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    } catch (error) {
                        console.log('Using default coordinates and timezone');
                    }

                    const apiUrl = `/api/weather?lat=${coords.latitude}&lon=${coords.longitude}&tz=${encodeURIComponent(tz)}`;
                    const response = await fetch(apiUrl);
                    weatherData = await response.json();
                    
                    // Update meta info
                    document.getElementById('meta').innerHTML = `
                        Local Time: ${weatherData.meta.current_time}<br>
                        Coordinates: ${weatherData.meta.coordinates.lat.toFixed(2)}, 
                                    ${weatherData.meta.coordinates.lon.toFixed(2)}<br>
                        Processed in ${weatherData.meta.processing_ms}ms
                    `;

                    updateCurrentWeather();
                    updatePreviewWidgets();
                    
                } catch (error) {
                    alert('Error loading weather data: ' + error.message);
                }
            }

            function updateCurrentWeather() {
                const current = weatherData.current;
                const container = document.getElementById('current-weather');
                
                container.innerHTML = `
                    <div class="current-item">
                        <div class="temp">${current.temperature}</div>
                        <div>Feels like ${current.feels_like}</div>
                    </div>
                    <div class="current-item">
                        <div><span class="material-icons-round">air</span> ${current.wind.speed}</div>
                        <div class="wind-direction" style="transform: rotate(${current.wind.direction}deg)">⬇️</div>
                    </div>
                    <div class="current-item">
                        <div class="sun-info">
                            <div><span class="material-icons-round">wb_sunny</span> ${current.sunrise}</div>
                            <div><span class="material-icons-round">nights_stay</span> ${current.sunset}</div>
                        </div>
                        <div><span class="material-icons-round">water_drop</span> ${current.humidity}</div>
                        <div><span class="material-icons-round">visibility</span> ${current.visibility}</div>
                    </div>
                `;
            }

            function updatePreviewWidgets() {
                const hourlyPreview = weatherData.hourly.slice(0, 3);
                document.getElementById('hourly-preview').innerHTML = hourlyPreview.map(hour => `
                    <div class="hour-item">
                        <div>${hour.time}</div>
                        <div class="temp">${hour.temperature}</div>
                        <div>${hour.precipitation_chance}</div>
                    </div>
                `).join('');

                const dailyPreview = weatherData.daily.slice(0, 3);
                document.getElementById('daily-preview').innerHTML = dailyPreview.map(day => `
                    <div class="day-item">
                        <div>${day.date.split(',')[0]}</div>
                        <div class="temp">${day.temp_max}/${day.temp_min}</div>
                        <div>${day.precipitation_chance}</div>
                    </div>
                `).join('');
            }

            function showModal(type) {
                document.querySelector('.modal-overlay').classList.add('active');
                const modal = document.getElementById(`${type}-modal`);
                modal.classList.add('active');

                if (type === 'hourly') {
                    updateHourlyModal();
                } else {
                    updateDailyModal();
                }
            }

            function updateHourlyModal() {
                const container = document.getElementById('hourly-forecast');
                container.innerHTML = weatherData.hourly.slice(0, 24).map(hour => `
                    <div class="hour-item">
                        <div>${hour.time}</div>
                        <div class="temp">${hour.temperature}</div>
                        <div><span class="material-icons-round">umbrella</span> ${hour.precipitation}</div>
                        <div><span class="material-icons-round">air</span> ${hour.wind.speed}</div>
                    </div>
                `).join('');
            }

            function updateDailyModal() {
                const container = document.getElementById('daily-forecast');
                container.innerHTML = weatherData.daily.map(day => `
                    <div class="day-item">
                        <div>${day.date}</div>
                        <div class="temp">${day.temp_max}/${day.temp_min}</div>
                        <div><span class="material-icons-round">wb_sunny</span> ${day.sunrise}</div>
                        <div><span class="material-icons-round">nights_stay</span> ${day.sunset}</div>
                        <div>${day.precipitation}</div>
                        <div>${day.precipitation_chance}</div>
                    </div>
                `).join('');
            }

            function closeModal() {
                document.querySelectorAll('.modal, .modal-overlay').forEach(el => {
                    el.classList.remove('active');
                });
            }

            window.onload = loadWeather;
            document.querySelector('.modal-overlay').addEventListener('click', closeModal);
        </script>
    </body>
    </html>
    `);
});

app.listen(8080, () => console.log('Server running on http://localhost:8080'));
