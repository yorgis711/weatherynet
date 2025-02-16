// worker.js
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (url.pathname === "/") {
      return new Response(generateHTML(), {
        headers: { "Content-Type": "text/html" },
      });
    }

    if (url.pathname === "/weather") {
      const location = url.searchParams.get("location") || "New York";
      return fetchWeatherData(location, env, ctx);
    }

    return new Response("Not Found", { status: 404 });
  },
};

async function fetchWeatherData(location, env, ctx) {
  const cacheKey = `weather:${location.toLowerCase()}`;
  const cacheTtl = 1800; // 30 minutes

  try {
    // Try to get cached response
    const cachedData = await env.WEATHER_CACHE.get(cacheKey);
    
    if (cachedData) {
      return new Response(cachedData, {
        headers: { 
          "Content-Type": "application/json",
          "CF-Cache-Status": "HIT"
        },
      });
    }

    // Geocoding first to get coordinates
    const geocodeResponse = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`
    );
    
    if (!geocodeResponse.ok) throw new Error("Location not found");
    const geocodeData = await geocodeResponse.json();
    
    if (!geocodeData.results || geocodeData.results.length === 0) {
      throw new Error("Location not found");
    }

    const { latitude, longitude, timezone } = geocodeData.results[0];

    // Fetch weather data from OpenMeteo
    const weatherResponse = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,weathercode&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=${timezone}&forecast_days=7`
    );

    if (!weatherResponse.ok) throw new Error("Weather data fetch failed");
    
    const weatherData = await weatherResponse.json();
    
    // Transform data to match expected format
    const processedData = {
      location: {
        name: geocodeData.results[0].name,
        country: geocodeData.results[0].country_code
      },
      current: {
        temp: weatherData.hourly.temperature_2m[0],
        weathercode: weatherData.hourly.weathercode[0]
      },
      daily: weatherData.daily
    };

    // Cache the processed data
    ctx.waitUntil(
      env.WEATHER_CACHE.put(
        cacheKey,
        JSON.stringify(processedData),
        { expirationTtl: cacheTtl }
      )
    );

    return new Response(JSON.stringify(processedData), {
      headers: { 
        "Content-Type": "application/json",
        "CF-Cache-Status": "MISS"
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: error.message || "Failed to fetch weather data"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

function generateHTML() {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Weather Glass</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;500;700&family=Material+Icons&display=swap" rel="stylesheet">
    <style>
      :root {
        --glass-bg: rgba(255, 255, 255, 0.25);
        --glass-border: rgba(255, 255, 255, 0.3);
        --accent: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }
      
      body {
            font-family: 'Inter', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            margin: 0;
            padding: 20px;
        }

        .widget {
            background: var(--glass-bg);
            backdrop-filter: blur(12px);
            border-radius: 28px;
            padding: 24px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            border: 1px solid var(--glass-border);
            width: 320px;
            text-align: center;
            position: relative;
            transition: transform 0.2s ease;
        }

        .widget:hover {
            transform: translateY(-2px);
        }

        .popup {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--glass-bg);
            backdrop-filter: blur(20px);
            border-radius: 32px;
            padding: 28px;
            box-shadow: 0 12px 40px rgba(0,0,0,0.15);
            border: 1px solid var(--glass-border);
            width: 90%;
            max-width: 480px;
            display: none;
            flex-direction: column;
            align-items: center;
            z-index: 1000;
        }

        .close-btn {
            position: absolute;
            top: 16px;
            right: 16px;
            cursor: pointer;
            font-size: 24px;
            color: #fff;
            background: rgba(0,0,0,0.1);
            border-radius: 50%;
            padding: 4px;
            transition: all 0.2s ease;
        }

        .close-btn:hover {
            background: rgba(0,0,0,0.2);
            transform: rotate(90deg);
        }

        .forecast {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
            gap: 12px;
            width: 100%;
            margin-top: 16px;
        }

        .forecast-item {
            background: rgba(255,255,255,0.4);
            padding: 16px;
            border-radius: 20px;
            backdrop-filter: blur(8px);
            border: 1px solid var(--glass-border);
            transition: transform 0.2s ease;
        }

        .forecast-item:hover {
            transform: translateY(-4px);
        }

        button {
            background: var(--accent);
            border: none;
            padding: 12px 24px;
            color: white;
            border-radius: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            margin-top: 16px;
            box-shadow: 0 4px 15px rgba(118, 75, 162, 0.3);
        }

        button:hover {
            opacity: 0.9;
            transform: scale(0.98);
        }

        .performance {
            position: absolute;
            bottom: -28px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 0.8em;
            color: #666;
            background: rgba(255,255,255,0.8);
            padding: 4px 12px;
            border-radius: 12px;
            white-space: nowrap;
        }

        #temperature {
            font-size: 3.5em;
            font-weight: 700;
            margin: 16px 0;
            background: var(--accent);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        #condition {
            font-size: 1.2em;
            color: #444;
            font-weight: 500;
        }


      .weather-icon {
        font-size: 2.5em;
        margin: 16px 0;
      }
    </style>
  </head>
  <body>
    <div class="widget" id="weather-widget">
      <h2>Current Weather</h2>
      <div class="weather-icon" id="weather-icon">⛅</div>
      <p id="temperature">--°C</p>
      <p id="condition">Loading...</p>
      <button onclick="openPopup()">7-Day Forecast</button>
      <div class="performance" id="performance"></div>
    </div>

    <div class="popup" id="popup">
      <span class="close-btn material-icons" onclick="closePopup()">close</span>
      <h2>7-Day Forecast</h2>
      <div class="forecast" id="forecast"></div>
    </div>

    <script>
      const weatherCodes = {
        0: { icon: '☀️', text: 'Clear sky' },
        1: { icon: '🌤', text: 'Mainly clear' },
        2: { icon: '⛅', text: 'Partly cloudy' },
        3: { icon: '☁️', text: 'Overcast' },
        45: { icon: '🌫', text: 'Fog' },
        51: { icon: '🌦', text: 'Light drizzle' },
        53: { icon: '🌧', text: 'Moderate drizzle' },
        55: { icon: '🌧', text: 'Dense drizzle' },
        61: { icon: '🌦', text: 'Light rain' },
        63: { icon: '🌧', text: 'Moderate rain' },
        65: { icon: '🌧', text: 'Heavy rain' },
        80: { icon: '🌦', text: 'Light showers' },
        81: { icon: '🌧', text: 'Moderate showers' },
        82: { icon: '🌧', text: 'Violent showers' },
        95: { icon: '⛈', text: 'Thunderstorm' },
        96: { icon: '⛈', text: 'Thunderstorm with hail' }
      };

      async function fetchWeather() {
        const startTime = Date.now();
        try {
          const response = await fetch('/weather?location=New York');
          const data = await response.json();

          if (data.error) throw new Error(data.error);

          // Update current weather
          const current = data.current;
          document.getElementById('temperature').textContent = 
            \`\${Math.round(current.temp)}°C\`;
          
          const weatherInfo = weatherCodes[current.weathercode] || { icon: '❓', text: 'Unknown' };
          document.getElementById('weather-icon').textContent = weatherInfo.icon;
          document.getElementById('condition').textContent = weatherInfo.text;

          // Update forecast
          let forecastHTML = '';
          data.daily.time.forEach((dateStr, index) => {
            const date = new Date(dateStr);
            forecastHTML += \`
              <div class="forecast-item">
                <p>\${date.toLocaleDateString('en', { weekday: 'short' })}</p>
                <div class="weather-icon" style="font-size: 1.5em">
                  \${weatherCodes[data.daily.weathercode[index]]?.icon || '❓'}
                </div>
                <p style="margin: 8px 0; font-weight: 700;">
                  \${Math.round(data.daily.temperature_2m_max[index])}°C
                </p>
                <p style="color: #666;">
                  \${Math.round(data.daily.temperature_2m_min[index])}°C
                </p>
              </div>\`;
          });
          document.getElementById('forecast').innerHTML = forecastHTML;

          // Update performance metric
          const processingTime = Date.now() - startTime;
          document.getElementById('performance').textContent = 
            \`Processed in \${processingTime}ms | \${data.location.name}, \${data.location.country}\`;
        } catch (error) {
          document.getElementById('condition').textContent = error.message;
          console.error('Fetch error:', error);
        }
      }

      function openPopup() {
        document.getElementById('popup').style.display = 'flex';
        document.body.style.overflow = 'hidden';
      }

      function closePopup() {
        document.getElementById('popup').style.display = 'none';
        document.body.style.overflow = 'auto';
      }

      fetchWeather();
    </script>
  </body>
  </html>
  `;
}
