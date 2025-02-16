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
          .weather-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
              gap: 12px;
              margin-top: 20px
                    }
          .weather-card {
              background-color: #f5f5f5;
              border-radius: 8px;
              padding: 16px;
              box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
              transition: transform 0.3s;
          }
          .weather-card:hover {
              transform: scale(1.05);
          }
          .card-title {
              font-size: 18px;
              font-weight: 700;
              margin-bottom: 12px;
          }
          .weather-info {
              font-size: 14px;
              color: #555;
          }
          .weather-info span {
              font-weight: 500;
          }
          .loading {
              text-align: center;
              font-size: 20px;
              color: #333;
              margin-top: 50px;
          }
      </style>
  </head>
  <body>
      <header>
          <h1>Weather Glass</h1>
          <div class="search-container">
              <input type="text" id="location" placeholder="Search by city..." />
              <button onclick="fetchWeather()">Search</button>
          </div>
      </header>
      <main>
          <div id="weather-grid" class="weather-grid">
              <!-- Weather cards will appear here -->
          </div>
          <div id="loading" class="loading" style="display:none;">
              Loading weather data...
          </div>
      </main>
      <footer>
          <p>Weather data provided by Open-Meteo</p>
      </footer>
      <script>
          async function fetchWeather() {
              const location = document.getElementById('location').value;
              const weatherGrid = document.getElementById('weather-grid');
              const loading = document.getElementById('loading');

              if (!location) {
                  alert('Please enter a location.');
                  return;
              }

              // Show loading indicator
              loading.style.display = 'block';
              weatherGrid.innerHTML = '';

              try {
                  const response = await fetch(`/api/weather?location=${location}`);
                  const data = await response.json();
                  
                  // Hide loading and display weather data
                  loading.style.display = 'none';
                  if (data.error) {
                      alert('Error fetching weather data: ' + data.error);
                      return;
                  }

                  // Process and display the weather data
                  displayWeatherData(data);
              } catch (error) {
                  loading.style.display = 'none';
                  alert('An error occurred while fetching data: ' + error.message);
              }
          }

          function displayWeatherData(data) {
              const weatherGrid = document.getElementById('weather-grid');

              const currentWeatherCard = document.createElement('div');
              currentWeatherCard.classList.add('weather-card');
              currentWeatherCard.innerHTML = `
                  <div class="card-title">Current Weather</div>
                  <div class="weather-info">
                      <p>Temperature: <span>${data.current.temp}°C</span></p>
                      <p>Feels Like: <span>${data.current.feels_like}°C</span></p>
                      <p>Humidity: <span>${data.current.humidity}%</span></p>
                      <p>Wind Speed: <span>${data.current.wind_speed} km/h</span></p>
                  </div>
              `;

              const hourlyWeatherCard = document.createElement('div');
              hourlyWeatherCard.classList.add('weather-card');
              hourlyWeatherCard.innerHTML = `
                  <div class="card-title">Hourly Forecast</div>
                  <div class="weather-info">
                      ${data.hourly.slice(0, 5).map(hour => `
                          <p>${hour.time}: Temp: ${hour.temp}°C, Wind: ${hour.wind_speed} km/h</p>
                      `).join('')}
                  </div>
              `;

              const dailyWeatherCard = document.createElement('div');
              dailyWeatherCard.classList.add('weather-card');
              dailyWeatherCard.innerHTML = `
                  <div class="card-title">Daily Forecast</div>
                  <div class="weather-info">
                      ${data.daily.slice(0, 5).map(day => `
                          <p>${day.time}: Max Temp: ${day.max_temp}°C, Min Temp: ${day.min_temp}°C</p>
                      `).join('')}
                  </div>
              `;

              weatherGrid.appendChild(currentWeatherCard);
              weatherGrid.appendChild(hourlyWeatherCard);
              weatherGrid.appendChild(dailyWeatherCard);
          }
      </script>
  </body>
  </html>
 `
