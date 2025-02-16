// worker.js
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (url.pathname === "/") {
      return new Response(generateHTML(), {
        headers: { "Content-Type": "text/html" },
      });
    }

    if (url.pathname === "/api/weather") {
      const location = url.searchParams.get("location");
      const lat = url.searchParams.get("lat");
      const lon = url.searchParams.get("lon");
      return fetchWeatherData(location, lat, lon, env, ctx);
    }

    if (url.pathname === "/api/c2l") {
      const lat = url.searchParams.get("lat");
      const lon = url.searchParams.get("lon");
      return fetchCityFromCoords(lat, lon, env, ctx);
    }

    return new Response("Not Found", { status: 404 });
  },
};

async function fetchCityFromCoords(lat, lon, env, ctx) {
  const cacheKey = `reverse_geocode:${lat},${lon}`;
  const cacheTtl = 86400; // 24 hours

  try {
    const cachedData = await env.WEATHER_CACHE.get(cacheKey);
    if (cachedData) {
      return new Response(cachedData, {
        headers: { "Content-Type": "application/json" },
      });
    }

    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en&count=1`
    );
    
    if (!response.ok) throw new Error("Reverse geocoding failed");
    const data = await response.json();
    
    const result = {
      city: data.results?.[0]?.name || "Unknown",
      country: data.results?.[0]?.country_code || "",
    };

    ctx.waitUntil(
      env.WEATHER_CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: cacheTtl })
    );

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function fetchWeatherData(location, lat, lon, env, ctx) {
  let cacheKey, coords;
  const cacheTtl = 1800; // 30 minutes

  try {
    if (lat && lon) {
      coords = { lat, lon };
      cacheKey = `weather:${lat},${lon}`;
    } else {
      const geocodeResponse = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`
      );
      
      if (!geocodeResponse.ok) throw new Error("Location not found");
      const geocodeData = await geocodeResponse.json();
      
      if (!geocodeData.results?.length) throw new Error("Location not found");
      coords = {
        lat: geocodeData.results[0].latitude,
        lon: geocodeData.results[0].longitude,
        tz: geocodeData.results[0].timezone
      };
      cacheKey = `weather:${coords.lat},${coords.lon}`;
    }

    const cachedData = await env.WEATHER_CACHE.get(cacheKey);
    if (cachedData) {
      return new Response(cachedData, {
        headers: { "Content-Type": "application/json" },
      });
    }

    const weatherParams = [
      'temperature_2m', 'relative_humidity_2m', 'apparent_temperature',
      'precipitation', 'rain', 'showers', 'snowfall', 'weather_code',
      'pressure_msl', 'surface_pressure', 'wind_speed_10m', 'wind_direction_10m',
      'uv_index', 'uv_index_clear_sky', 'is_day', 'visibility', 'cape', 'pm10',
      'pm2_5', 'carbon_monoxide', 'nitrogen_dioxide', 'sulphur_dioxide', 'ozone'
    ];

    const airQualityParams = 'pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone';

    const [weatherResponse, airQualityResponse] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&hourly=${weatherParams.join(',')}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=${coords.tz || 'auto'}`),
      fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${coords.lat}&longitude=${coords.lon}&hourly=${airQualityParams}`)
    ]);

    if (!weatherResponse.ok || !airQualityResponse.ok) {
      throw new Error("Failed to fetch weather data");
    }

    const [weatherData, airQualityData] = await Promise.all([
      weatherResponse.json(),
      airQualityResponse.json()
    ]);

    const processedData = {
      location: {
        latitude: coords.lat,
        longitude: coords.lon,
      },
      current: processCurrentWeather(weatherData, airQualityData),
      hourly: processHourlyData(weatherData, airQualityData),
      daily: processDailyData(weatherData)
    };

    ctx.waitUntil(
      env.WEATHER_CACHE.put(cacheKey, JSON.stringify(processedData), { expirationTtl: cacheTtl })
    );

    return new Response(JSON.stringify(processedData), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Helper functions to process API responses
function processCurrentWeather(weatherData, airQualityData) {
  return {
    temp: weatherData.hourly.temperature_2m[0],
    feels_like: weatherData.hourly.apparent_temperature[0],
    humidity: weatherData.hourly.relative_humidity_2m[0],
    precipitation: weatherData.hourly.precipitation[0],
    rain: weatherData.hourly.rain[0],
    showers: weatherData.hourly.showers[0],
    snowfall: weatherData.hourly.snowfall[0],
    weather_code: weatherData.hourly.weather_code[0],
    pressure: weatherData.hourly.pressure_msl[0],
    wind_speed: weatherData.hourly.wind_speed_10m[0],
    wind_degree: weatherData.hourly.wind_direction_10m[0],
    uv_index: weatherData.hourly.uv_index[0],
    visibility: weatherData.hourly.visibility[0],
    cape: weatherData.hourly.cape[0],
    aqi: calculateAQI(airQualityData.hourly)
  };
}

function processHourlyData(weatherData, airQualityData) {
  return weatherData.hourly.time.map((time, index) => ({
    time,
    temp: weatherData.hourly.temperature_2m[index],
    feels_like: weatherData.hourly.apparent_temperature[index],
    humidity: weatherData.hourly.relative_humidity_2m[index],
    precipitation: weatherData.hourly.precipitation[index],
    rain: weatherData.hourly.rain[index],
    showers: weatherData.hourly.showers[index],
    snowfall: weatherData.hourly.snowfall[index],
    weather_code: weatherData.hourly.weather_code[index],
    pressure: weatherData.hourly.pressure_msl[index],
    wind_speed: weatherData.hourly.wind_speed_10m[index],
    wind_degree: weatherData.hourly.wind_direction_10m[index],
    uv_index: weatherData.hourly.uv_index[index],
    visibility: weatherData.hourly.visibility[index],
    cape: weatherData.hourly.cape[index],
    aqi: calculateAQI(airQualityData.hourly, index)
  }));
}

function processDailyData(weatherData) {
  return weatherData.daily.time.map((time, index) => ({
    time,
    max_temp: weatherData.daily.temperature_2m_max[index],
    min_temp: weatherData.daily.temperature_2m_min[index],
    weather_code: weatherData.daily.weather_code[index]
  }));
}

function calculateAQI(hourlyData, index = 0) {
  const pollutants = {
    pm2_5: hourlyData.pm2_5[index],
    pm10: hourlyData.pm10[index],
    no2: hourlyData.nitrogen_dioxide[index],
    so2: hourlyData.sulphur_dioxide[index],
    co: hourlyData.carbon_monoxide[index],
    o3: hourlyData.ozone[index]
  };
  
  // Simplified AQI calculation (replace with proper implementation)
  const aqiValues = Object.values(pollutants).filter(v => v !== undefined);
  return aqiValues.length > 0 
    ? Math.round(Math.max(...aqiValues))
    : null;
}

// Updated generateHTML() function with enhanced UI

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
          body {
              font-family: 'Inter', sans-serif;
              background: #1e1e2e;
              color: #ffffff;
              text-align: center;
              margin: 0;
              padding: 20px;
          }
          .widget {
              max-width: 600px;
              margin: auto;
              background: rgba(255,255,255,0.1);
              padding: 20px;
              border-radius: 12px;
              box-shadow: 0px 4px 10px rgba(0,0,0,0.2);
          }
          #weather-icon {
              font-size: 48px;
          }
          .weather-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
              gap: 12px;
              margin-top: 20px;
          }
          .metric-card {
              background: rgba(255,255,255,0.15);
              padding: 16px;
              border-radius: 12px;
              backdrop-filter: blur(8px);
          }
          .hourly-forecast {
              display: flex;
              overflow-x: auto;
              gap: 10px;
              padding: 12px 0;
          }
          .hourly-item {
              flex-shrink: 0;
              padding: 10px;
              border-radius: 10px;
              background: rgba(255,255,255,0.1);
          }
          .forecast {
              display: flex;
              justify-content: space-around;
              margin-top: 15px;
          }
      </style>
  </head>
  <body>
      <div class="widget" id="weather-widget">
          <div id="location-header">
              <h1 id="city-name">Loading...</h1>
              <button onclick="navigator.geolocation.getCurrentPosition(updateLocation)">📍 Use My Location</button>
          </div>
          
          <div class="current-weather">
              <div id="weather-icon">⏳</div>
              <p id="temperature">--°C</p>
              <p id="condition">Loading...</p>
          </div>

          <div class="weather-grid" id="current-metrics"></div>
          
          <h3>Hourly Forecast</h3>
          <div class="hourly-forecast" id="hourly-forecast"></div>
          
          <h3>7-Day Forecast</h3>
          <div class="forecast" id="daily-forecast"></div>
          
          <div class="performance" id="performance"></div>
      </div>

      <script>
          const weatherCodes = {
              0: { icon: '☀️', text: 'Clear sky' },
              1: { icon: '🌤', text: 'Mainly clear' },
              2: { icon: '⛅', text: 'Partly cloudy' },
              3: { icon: '☁️', text: 'Overcast' },
              45: { icon: '🌫', text: 'Fog' },
              61: { icon: '🌧', text: 'Light rain' },
              63: { icon: '🌧', text: 'Moderate rain' },
              65: { icon: '🌧', text: 'Heavy rain' },
              80: { icon: '🌦', text: 'Showers' }
          };

          async function updateLocation(position) {
              try {
                  const { latitude, longitude } = position.coords;
                  const cityResponse = await fetch(\`/api/c2l?lat=\${latitude}&lon=\${longitude}\`);
                  const cityData = await cityResponse.json();
                  
                  document.getElementById('city-name').textContent = 
                      \`\${cityData.city}\${cityData.country ? ', ' + cityData.country : ''}\`;
                  
                  fetchWeather(latitude, longitude);
              } catch (error) {
                  showError('Failed to get location');
              }
          }

          async function fetchWeather(lat, lon) {
              const startTime = Date.now();
              try {
                  const response = await fetch(\`/api/weather?lat=\${lat}&lon=\${lon}\`);
                  const data = await response.json();
                  
                  updateCurrentWeather(data);
                  updateHourlyForecast(data);
                  updateDailyForecast(data);
                  updateMetrics(data);
                  
                  document.getElementById('performance').textContent = 
                      \`Processed in \${Date.now() - startTime}ms\`;
              } catch (error) {
                  showError(error.message);
              }
          }

          function updateCurrentWeather(data) {
              const current = data.current;
              document.getElementById('temperature').textContent = \`\${Math.round(current.temp)}°C\`;
              const weather = weatherCodes[current.weather_code] || { icon: '❓', text: 'Unknown' };
              document.getElementById('weather-icon').textContent = weather.icon;
              document.getElementById('condition').textContent = weather.text;
          }

          function updateMetrics(data) {
              const metrics = [
                  { label: 'Feels Like', value: \`\${Math.round(data.current.feels_like)}°C\` },
                  { label: 'Humidity', value: \`\${data.current.humidity}%\` },
                  { label: 'Wind Speed', value: \`\${Math.round(data.current.wind_speed)} km/h\` },
                  { label: 'Precipitation', value: \`\${data.current.precipitation} mm\` },
                  { label: 'UV Index', value: data.current.uv_index },
                  { label: 'AQI', value: data.current.aqi },
                  { label: 'Pressure', value: \`\${Math.round(data.current.pressure)} hPa\` },
                  { label: 'Visibility', value: \`\${Math.round(data.current.visibility/1000)} km\` }
              ];

              document.getElementById('current-metrics').innerHTML = metrics
                  .map(m => \`
                      <div class="metric-card">
                          <p>\${m.label}</p>
                          <h3>\${m.value}</h3>
                      </div>\`
                  ).join('');
          }

          function updateHourlyForecast(data) {
              const hourlyHTML = data.hourly
                  .slice(0, 24)
                  .map(hour => \`
                      <div class="hourly-item">
                          <p>\${new Date(hour.time).getHours()}:00</p>
                          <p>\${weatherCodes[hour.weather_code]?.icon || '❓'}</p>
                          <p>\${Math.round(hour.temp)}°C</p>
                      </div>\`
                  ).join('');
              document.getElementById('hourly-forecast').innerHTML = hourlyHTML;
          }

          function updateDailyForecast(data) {
              const dailyHTML = data.daily.map(day => {
                  const date = new Date(day.time);
                  return \`
                      <div class="forecast-item">
                          <p>\${date.toLocaleDateString('en', { weekday: 'short' })}</p>
                          <p>\${weatherCodes[day.weather_code]?.icon || '❓'}</p>
                          <p>\${Math.round(day.max_temp)}°C</p>
                          <p style="color: #666;">\${Math.round(day.min_temp)}°C</p>
                      </div>\`;
              }).join('');
              document.getElementById('daily-forecast').innerHTML = dailyHTML;
          }

          function showError(message) {
              document.getElementById('condition').textContent = message;
              document.getElementById('condition').style.color = '#ff4444';
          }
      </script>
  </body>
  </html>
  `;
}
