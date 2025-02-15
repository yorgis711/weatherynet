export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    const colo = request.cf.colo;

    // Handle API requests
    if (url.pathname === '/api/weather') {
      try {
        const params = {
          lat: Math.min(90, Math.max(-90, parseFloat(url.searchParams.get('lat')) || 37.7749)),
          lon: Math.min(180, Math.max(-180, parseFloat(url.searchParams.get('lon')) || -122.4194)),
          tz: url.searchParams.get('tz') || 'America/Los_Angeles'
        };

        const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${params.lat}&longitude=${params.lon}&timezone=${encodeURIComponent(params.tz)}&hourly=temperature_2m,precipitation_probability,weathercode&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weathercode&daily=sunrise,sunset&forecast_days=3`;

        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        
        const rawData = await response.json();
        if (!rawData.latitude || !rawData.longitude) throw new Error('Invalid API response');

        const processedData = {
          meta: {
            colo,
            coordinates: { lat: rawData.latitude, lon: rawData.longitude },
            timezone: params.tz,
            timestamp: new Date().toISOString()
          },
          current: processCurrentWeather(rawData.current, params.tz),
          hourly: processHourlyData(rawData.hourly, params.tz),
          daily: processDailyData(rawData.daily, params.tz)
        };

        return new Response(JSON.stringify(processedData), {
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          }
        });

      } catch (error) {
        return new Response(JSON.stringify({
          error: error.message,
          colo,
          timestamp: new Date().toISOString()
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
function processCurrentWeather(current, tz) {
  return {
    temp: `${current.temperature_2m}°C`,
    feelsLike: `${current.apparent_temperature}°C`,
    humidity: `${current.relative_humidity_2m}%`,
    precipitation: `${current.precipitation}mm`,
    weatherCode: current.weathercode,
    sunrise: formatTime(current.sunrise || new Date(), tz),
    sunset: formatTime(current.sunset || new Date(), tz)
  };
}

function processHourlyData(hourly, tz) {
  return hourly.time.map((time, i) => ({
    time: formatTime(time, tz),
    temp: `${hourly.temperature_2m[i]}°C`,
    precipitation: `${hourly.precipitation_probability[i]}%`,
    weatherCode: hourly.weathercode[i]
  }));
}

function processDailyData(daily, tz) {
  return daily.time.map((time, i) => ({
    date: formatDate(time, tz),
    sunrise: formatTime(daily.sunrise[i], tz),
    sunset: formatTime(daily.sunset[i], tz),
    tempMax: `${daily.temperature_2m_max[i]}°C`,
    tempMin: `${daily.temperature_2m_min[i]}°C`
  }));
}

function formatTime(isoString, tz) {
  try {
    return new Date(isoString).toLocaleTimeString('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch {
    return '--:--';
  }
}

function formatDate(isoString, tz) {
  try {
    return new Date(isoString).toLocaleDateString('en-US', {
      timeZone: tz,
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
    /* Full CSS */
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
      padding: 2rem 0;
      border-bottom: 1px solid #eee;
    }

    .meta-info {
      text-align: center;
      color: var(--secondary);
      margin: 1rem 0;
      font-size: 0.9rem;
    }

    .current-weather {
      background: var(--card-bg);
      padding: 2rem;
      border-radius: 1rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 2rem;
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    }

    .weather-card {
      padding: 1.5rem;
      background: var(--card-bg);
      border-radius: 0.8rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }

    .hourly-forecast {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    }

    .error {
      color: #dc3545;
      background: #ffe5e5;
      padding: 1rem;
      border-radius: 0.5rem;
      margin: 2rem 0;
    }

    .cf-info {
      position: fixed;
      bottom: 1rem;
      right: 1rem;
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Weather Dashboard</h1>
      <div class="meta-info" id="meta"></div>
    </div>

    <div id="content"></div>
  </div>

  <div class="cf-info">
    Cloudflare Data Center: <span id="cf-colo">${colo}</span>
  </div>

  <script>
    async function loadWeather() {
      try {
        let coords = await getLocation();
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const response = await fetch(\`/api/weather?lat=\${coords.latitude}&lon=\${coords.longitude}&tz=\${encodeURIComponent(tz)}\`);
        
        if (!response.ok) throw new Error(\`HTTP Error: \${response.status}\`);
        const data = await response.json();
        
        if (data.error) throw new Error(data.error);
        renderWeather(data);
        
      } catch (error) {
        showError(error);
      }
    }

    async function getLocation() {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          pos => resolve(pos.coords),
          error => {
            console.log('Using default coordinates');
            resolve({ latitude: 37.7749, longitude: -122.4194 });
          },
          { timeout: 5000 }
        );
      });
    }

    function renderWeather(data) {
      document.getElementById('meta').innerHTML = \`
        Coordinates: \${data.meta.coordinates.lat.toFixed(4)}, \${data.meta.coordinates.lon.toFixed(4)}<br>
        Timezone: \${data.meta.timezone}
      \`;

      document.getElementById('content').innerHTML = \`
        <div class="current-weather">
          <div class="weather-card">
            <h2>Current Conditions</h2>
            <p>Temperature: \${data.current.temp}</p>
            <p>Feels like: \${data.current.feelsLike}</p>
            <p>Humidity: \${data.current.humidity}</p>
            <p>Precipitation: \${data.current.precipitation}</p>
          </div>
          
          <div class="weather-card">
            <h2>Sun Cycle</h2>
            <p>Sunrise: \${data.current.sunrise}</p>
            <p>Sunset: \${data.current.sunset}</p>
          </div>
        </div>

        <h2 style="margin: 2rem 0 1rem">Hourly Forecast</h2>
        <div class="hourly-forecast">
          \${data.hourly.slice(0, 24).map(hour => \`
            <div class="weather-card">
              <div>\${hour.time}</div>
              <div style="font-size: 1.2rem; margin: 0.5rem 0">\${hour.temp}</div>
              <div>\${hour.precipitation}% precip</div>
            </div>
          \`).join('')}
        </div>
      \`;

      document.getElementById('cf-colo').textContent = data.meta.colo;
    }

    function showError(error) {
      document.getElementById('content').innerHTML = \`
        <div class="error">
          Error: \${error.message}
        </div>
      \`;
    }

    loadWeather();
  </script>
</body>
</html>`;
