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
                })).slice(0, 24) // 24 hours
            };
            
            res.json(formattedData);
        } catch (e) {
            res.status(500).json({ error: "Failed to parse weather data" });
        }
    });
});

// UI Route (keep the same HTML/CSS as before but update these JavaScript functions)

function updatePreviewWidgets() {
    // Hourly preview (next 6 hours)
    const hourlyPreview = weatherData.hourly.slice(0, 6);
    document.getElementById('hourly-preview').innerHTML = hourlyPreview.map(hour => `
        <div class="hour-item">
            <div>${hour.time}</div>
            <div>${hour.temperature}°C</div>
            <div class="weather-icon">${getWeatherIcon(hour.weathercode)}</div>
        </div>
    `).join('');

    // Monthly preview (next 5 days)
    const monthlyPreview = weatherData.daily.slice(0, 5);
    document.getElementById('monthly-preview').innerHTML = monthlyPreview.map(day => `
        <div class="day-item">
            <div>${day.date}</div>
            <div>${day.temp_max}/${day.temp_min}°C</div>
            <div class="weather-icon">${getWeatherIcon(day.weathercode)}</div>
        </div>
    `).join('');
}

function updateHourlyModal() {
    const container = document.getElementById('hourly-forecast');
    container.innerHTML = weatherData.hourly.map(hour => `
        <div class="hour-item">
            <div>${hour.time}</div>
            <div class="temp">${hour.temperature}°C</div>
            <div class="weather-icon">${getWeatherIcon(hour.weathercode)}</div>
            <div><span class="material-icons-round">umbrella</span> ${hour.precipitation_chance}%</div>
        </div>
    `).join('');
}

function updateDailyModal() {
    const container = document.getElementById('daily-forecast');
    container.innerHTML = weatherData.daily.map(day => `
        <div class="day-item">
            <div>${day.date}</div>
            <div>${day.temp_max}/${day.temp_min}°C</div>
            <div class="weather-icon">${getWeatherIcon(day.weathercode)}</div>
            <div><span class="material-icons-round">umbrella</span> ${day.precipitation_chance}%</div>
            <div class="sun-times">
                <span class="material-icons-round">wb_sunny</span>${day.sunrise}
                <span class="material-icons-round">nights_stay</span>${day.sunset}
            </div>
        </div>
    `).join('');
}

// Add weather icons mapping
function getWeatherIcon(code) {
    const icons = {
        0: '☀️',
        1: '🌤',
        2: '⛅',
        3: '☁️',
        45: '🌫',
        48: '🌫',
        51: '🌦',
        53: '🌦',
        55: '🌧',
        56: '🌧',
        57: '🌧',
        61: '🌧',
        63: '🌧',
        65: '🌧',
        66: '🌨',
        67: '🌨',
        71: '🌨',
        73: '🌨',
        75: '🌨',
        77: '🌨',
        80: '🌦',
        81: '🌧',
        82: '🌧',
        85: '🌨',
        86: '🌨',
        95: '⛈',
        96: '⛈',
        99: '⛈'
    };
    return icons[code] || '🌤';
}
