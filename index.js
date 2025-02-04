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
            
            // Check for API errors
            if (data.error) {
                return res.status(500).json({ error: data.reason });
            }

            // Validate required data exists
            if (!data.current || !data.hourly || !data.daily) {
                throw new Error("Invalid API response structure");
            }

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
                    sunrise: data.daily.sunrise[index]?.split('T')[1] || '--:--',
                    sunset: data.daily.sunset[index]?.split('T')[1] || '--:--',
                    temp_max: data.daily.temperature_2m_max[index] ?? 'N/A',
                    temp_min: data.daily.temperature_2m_min[index] ?? 'N/A',
                    precipitation: data.daily.precipitation_sum[index] ?? 0,
                    precipitation_chance: data.daily.precipitation_probability_max[index] ?? 0,
                    weathercode: data.daily.weathercode[index] ?? 0
                })),
                hourly: data.hourly.time.map((time, index) => ({
                    time: new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    temperature: data.hourly.temperature_2m[index] ?? 'N/A',
                    precipitation_chance: data.hourly.precipitation_probability[index] ?? 0,
                    precipitation: data.hourly.precipitation[index] ?? 0,
                    weathercode: data.hourly.weathercode[index] ?? 0
                })).slice(0, 24)
            };
            
            res.json(formattedData);
        } catch (e) {
            res.status(500).json({ error: "Failed to parse weather data: " + e.message });
        }
    });
});

// UI Route (keep the HTML/CSS from previous answer but update the JavaScript part)

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <!-- Keep all previous HTML/CSS but update the script section as shown below -->
    <script>
        async function loadWeather() {
            try {
                const coords = await getLocation();
                const response = await fetch(\`/api?lat=\${coords.latitude}&long=\${coords.longitude}\`);
                
                if (!response.ok) {
                    throw new Error(\`HTTP error! status: \${response.status}\`);
                }

                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.error);
                }

                if (!data.current || !data.hourly || !data.daily) {
                    throw new Error("Invalid data format from server");
                }

                weatherData = data;
                
                document.getElementById('location').textContent = 
                    \`Latitude: \${coords.latitude.toFixed(2)}, Longitude: \${coords.longitude.toFixed(2)}\`;

                updateCurrentWeather();
                updatePreviewWidgets();
                
            } catch (error) {
                alert('Error loading weather data: ' + error.message);
            }
        }

        function updateCurrentWeather() {
            const current = weatherData?.current;
            if (!current) return;

            const container = document.getElementById('current-weather');
            
            container.innerHTML = \`
                <div class="current-item">
                    <div class="temp">\${current.temperature ?? '--'}°C</div>
                    <div>Feels like \${current.feels_like ?? '--'}°C</div>
                </div>
                <div class="current-item">
                    <div><span class="material-icons-round">air</span> \${current.wind_speed ?? '--'} km/h</div>
                    <div class="wind-direction" style="transform: rotate(\${current.wind_direction ?? 0}deg)">⬇️</div>
                </div>
                <div class="current-item">
                    <div><span class="material-icons-round">water_drop</span> \${current.humidity ?? '--'}%</div>
                    <div><span class="material-icons-round">rainy</span> \${current.precipitation ?? '--'} mm</div>
                </div>
            \`;
        }

        // Rest of the script remains the same with null checks added
    </script>
    </html>
    `);
});

app.listen(8080, () => console.log('Server running on http://localhost:8080'));
