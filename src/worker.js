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
