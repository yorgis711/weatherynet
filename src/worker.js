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

        // Build API URL with required parameters
        const apiUrl = new URL('https://api.open-meteo.com/v1/forecast');
        apiUrl.searchParams.set('latitude', params.lat);
        apiUrl.searchParams.set('longitude', params.lon);
        apiUrl.searchParams.set('timezone', params.tz);
        apiUrl.searchParams.set('hourly', 'temperature_2m,precipitation_probability');
        apiUrl.searchParams.set('current', 'temperature_2m,apparent_temperature,relative_humidity_2m');
        apiUrl.searchParams.set('daily', 'sunrise,sunset');
        apiUrl.searchParams.set('forecast_days', 1);

        const response = await fetch(apiUrl);
        const responseData = await response.json();
        
        if (!response.ok || responseData.error) {
          throw new Error(responseData.reason || `API Error: ${response.status}`);
        }

        // Validate response structure
        if (!responseData.latitude || !responseData.longitude) {
          throw new Error('Invalid API response format');
        }

        // Process data
        const processedData = {
          meta: {
            colo,
            coordinates: { 
              lat: responseData.latitude,
              lon: responseData.longitude
            },
            timezone: params.tz,
            timestamp: new Date().toISOString()
          },
          current: {
            temp: `${responseData.current.temperature_2m}°C`,
            feelsLike: `${responseData.current.apparent_temperature}°C`,
            humidity: `${responseData.current.relative_humidity_2m}%`,
            sunrise: formatTime(responseData.daily.sunrise[0], params.tz),
            sunset: formatTime(responseData.daily.sunset[0], params.tz)
          },
          hourly: responseData.hourly.time.map((time, i) => ({
            time: formatTime(time, params.tz),
            temp: `${responseData.hourly.temperature_2m[i]}°C`,
            precipitation: `${responseData.hourly.precipitation_probability[i]}%`
          }))
        };

        return new Response(JSON.stringify(processedData), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });

      } catch (error) {
        console.error('Server Error:', error);
        return new Response(JSON.stringify({
          error: error.message,
          colo,
          timestamp: new Date().toISOString()
        }), { 
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
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

function formatTime(isoString, timeZone) {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch (error) {
    console.error('Time formatting error:', error);
    return '--:--';
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
