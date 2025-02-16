export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    const colo = request.cf.colo;

    // Handle API requests
    if (url.pathname === '/api/weather') {
      try {
        // Validate and parse parameters
        const params = {
          lat: Math.min(90, Math.max(-90, parseFloat(url.searchParams.get('lat')) || 37.7749)),
          lon: Math.min(180, Math.max(-180, parseFloat(url.searchParams.get('lon')) || -122.4194)),
          tz: url.searchParams.get('tz') || Intl.DateTimeFormat().resolvedOptions().timeZone
        };

        // Build API URL with all required parameters
        const apiUrl = new URL('https://api.open-meteo.com/v1/forecast');
        apiUrl.searchParams.set('latitude', params.lat);
        apiUrl.searchParams.set('longitude', params.lon);
        apiUrl.searchParams.set('timezone', params.tz);
        apiUrl.searchParams.set('hourly', 'temperature_2m,precipitation_probability,precipitation,wind_speed_10m,wind_direction_10m');
        apiUrl.searchParams.set('current', 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m');
        apiUrl.searchParams.set('daily', 'weathercode,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,precipitation_probability_max');
        apiUrl.searchParams.set('forecast_days', 3);

        const response = await fetch(apiUrl);
        const textResponse = await response.text();
        
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        
        const rawData = JSON.parse(textResponse);
        if (!rawData.latitude || !rawData.longitude) throw new Error('Invalid API response');

        // Process data with fallbacks
        const processedData = {
          meta: {
            colo,
            coordinates: { 
              lat: rawData.latitude,
              lon: rawData.longitude
            },
            timezone: params.tz,
            timestamp: new Date().toISOString()
          },
          current: {
            temp: `${rawData.current.temperature_2m}°C`,
            feelsLike: `${rawData.current.apparent_temperature}°C`,
            humidity: `${rawData.current.relative_humidity_2m}%`,
            precipitation: `${rawData.current.precipitation ?? 0}mm`,
            windSpeed: `${rawData.current.wind_speed_10m} km/h`,
            windDirection: rawData.current.wind_direction_10m,
            sunrise: formatTime(rawData.daily.sunrise[0], params.tz),
            sunset: formatTime(rawData.daily.sunset[0], params.tz)
          },
          hourly: rawData.hourly.time.map((time, i) => ({
            time: formatTime(time, params.tz),
            temp: `${rawData.hourly.temperature_2m[i]}°C`,
            precipitation: `${rawData.hourly.precipitation_probability[i]}%`,
            windSpeed: `${rawData.hourly.wind_speed_10m[i]} km/h`,
            windDirection: rawData.hourly.wind_direction_10m[i]
          })),
          daily: rawData.daily.time.map((date, i) => ({
            date: formatDate(date, params.tz),
            tempMax: `${rawData.daily.temperature_2m_max[i]}°C`,
            tempMin: `${rawData.daily.temperature_2m_min[i]}°C`,
            precipitation: `${rawData.daily.precipitation_sum[i]}mm`,
            precipitationChance: `${rawData.daily.precipitation_probability_max[i]}%`,
            sunrise: formatTime(rawData.daily.sunrise[i], params.tz),
            sunset: formatTime(rawData.daily.sunset[i], params.tz)
          }))
        };

        return new Response(JSON.stringify(processedData), {
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300'
          }
        });

      } catch (error) {
        return new Response(JSON.stringify({
          error: error.message,
          colo
        }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Serve HTML UI
    return new Response(HTML(colo), {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache'
      }
    });
  }
};

// Helper functions
function formatTime(isoString, timeZone) {
  try {
    return new Date(isoString).toLocaleTimeString('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch {
    return '--:--';
  }
}

function formatDate(isoString, timeZone) {
  try {
    return new Date(isoString).toLocaleDateString('en-US', {
      timeZone,
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return '--/--';
  }
}

const HTML = (colo) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weather Dashboard</title>
  <style>
    /* Full CSS with modal support */
    :root {
      --primary: #2d3436;
      --secondary: #636e72;
      --background: #f8f9fa;
      --card-bg: #ffffff;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      background: var(--background);
      color: var(--primary);
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

    .widgets-container {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .widget {
      background: var(--card-bg);
      padding: 1.5rem;
      border-radius: 1rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      cursor: pointer;
      transition: transform 0.2s;
    }

    .widget:hover {
      transform: translateY(-3px);
    }

    .modal {
      display: none;
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 2rem;
      border-radius: 1rem;
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
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

    .modal.active,
    .modal-overlay.active {
      display: block;
    }

    .wind-direction {
      display: inline-block;
      transform-origin: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Weather Dashboard</h1>
      <div class="meta-info" id="meta"></div>
    </div>

    <div class="current-weather" id="current"></div>

    <div class="widgets-container">
      <div class="widget" onclick="showModal('hourly')">
        <h3>Hourly Forecast</h3>
        <div class="hourly-preview" id="hourly-preview"></div>
      </div>

      <div class="widget" onclick="showModal('daily')">
        <h3>7-Day Forecast</h3>
        <div class="daily-preview" id="daily-preview"></div>
      </div>
    </div>

    <div class="modal-overlay" onclick="closeModal()"></div>
    <div class="modal" id="hourly-modal">
      <h2>24-Hour Forecast</h2>
      <div class="hourly-forecast" id="hourly-forecast"></div>
      <button onclick="closeModal()">Close</button>
    </div>

    <div class="modal" id="daily-modal">
      <h2>7-Day Forecast</h2>
      <div class="daily-forecast" id="daily-forecast"></div>
      <button onclick="closeModal()">Close</button>
    </div>
  </div>

  <script>
    let weatherData = null;

    async function loadWeather() {
      try {
        const coords = await getLocation();
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const response = await fetch(`/api/weather?lat=${coords.latitude}&lon=${coords.longitude}&tz=${encodeURIComponent(tz)}`);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        weatherData = await response.json();
        updateUI();
        
      } catch (error) {
        showError(error);
      }
    }

    function updateUI() {
      // Current weather
      document.getElementById('current').innerHTML = `
        <div class="current-card">
          <h2>Current Conditions</h2>
          <p>Temperature: ${weatherData.current.temp}</p>
          <p>Feels like: ${weatherData.current.feelsLike}</p>
          <p>Humidity: ${weatherData.current.humidity}</p>
          <p>Precipitation: ${weatherData.current.precipitation}</p>
          <p>Wind: ${weatherData.current.windSpeed} 
            <span class="wind-direction" style="transform: rotate(${weatherData.current.windDirection}deg)">→</span>
          </p>
          <p>Sunrise: ${weatherData.current.sunrise}</p>
          <p>Sunset: ${weatherData.current.sunset}</p>
        </div>
      `;

      // Hourly preview
      document.getElementById('hourly-preview').innerHTML = 
        weatherData.hourly.slice(0, 3).map(hour => `
          <div class="hour-item">
            <div>${hour.time}</div>
            <div>${hour.temp}</div>
            <div>${hour.precipitation}%</div>
          </div>
        `).join('');

      // Daily preview
      document.getElementById('daily-preview').innerHTML = 
        weatherData.daily.slice(0, 3).map(day => `
          <div class="day-item">
            <div>${day.date}</div>
            <div>${day.tempMax}/${day.tempMin}</div>
            <div>${day.precipitationChance}%</div>
          </div>
        `).join('');

      // Update meta info
      document.getElementById('meta').innerHTML = `
        Coordinates: ${weatherData.meta.coordinates.lat.toFixed(4)}, 
        ${weatherData.meta.coordinates.lon.toFixed(4)}<br>
        Timezone: ${weatherData.meta.timezone}<br>
        Data Center: ${weatherData.meta.colo}
      `;
    }

    function showModal(type) {
      document.querySelector('.modal-overlay').classList.add('active');
      document.getElementById(`${type}-modal`).classList.add('active');
      
      if (type === 'hourly') {
        document.getElementById('hourly-forecast').innerHTML = 
          weatherData.hourly.map(hour => `
            <div class="hour-item">
              <div>${hour.time}</div>
              <div>${hour.temp}</div>
              <div>${hour.precipitation}%</div>
              <div>${hour.windSpeed}</div>
            </div>
          `).join('');
      } else {
        document.getElementById('daily-forecast').innerHTML = 
          weatherData.daily.map(day => `
            <div class="day-item">
              <div>${day.date}</div>
              <div>${day.tempMax}/${day.tempMin}</div>
              <div>${day.precipitation}mm</div>
              <div>${day.precipitationChance}%</div>
            </div>
          `).join('');
      }
    }

    function closeModal() {
      document.querySelectorAll('.modal, .modal-overlay').forEach(el => {
        el.classList.remove('active');
      });
    }

    async function getLocation() {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          pos => resolve(pos.coords),
          error => resolve({ latitude: 37.7749, longitude: -122.4194 }),
          { timeout: 5000 }
        );
      });
    }

    function showError(error) {
      document.getElementById('content').innerHTML = `
        <div class="error">
          Error: ${error.message}
        </div>
      `;
    }

    loadWeather();
  </script>
</body>
</html>`;
