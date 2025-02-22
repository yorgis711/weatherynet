function formatTime(isoString, timeZone) {
  try {
    return new Date(isoString).toLocaleTimeString("en-US", { timeZone: timeZone, hour: "2-digit", minute: "2-digit", hour12: false });
  } catch (e) {
    return "--:--";
  }
}

function formatDate(isoString, timeZone) {
  try {
    return new Date(isoString).toLocaleDateString("en-US", { timeZone: timeZone, weekday: "short", month: "short", day: "numeric" });
  } catch (e) {
    return "--/--";
  }
}

const HTML = (colo) => <!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>🌤️ Weather Dashboard</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root { --primary: #2d3436; --secondary: #636e72; --background: #f0f2f5; --card-bg: #ffffff; --accent: #0984e3; --shadow: rgba(0, 0, 0, 0.1); }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: "Inter", sans-serif; background: var(--background); color: var(--primary); padding: 1rem; }
.container { max-width: 1200px; margin: 0 auto; }
.header { text-align: center; margin-bottom: 2rem; position: relative; }
.header h1 { margin-bottom: 0.5rem; }
.meta-info { font-size: 0.9rem; color: var(--secondary); display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
.widgets-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; }
.widget { background: var(--card-bg); padding: 1.5rem; border-radius: 1rem; box-shadow: 0 4px 12px var(--shadow); cursor: pointer; }
.current-conditions { background: var(--card-bg); padding: 2rem; border-radius: 1.5rem; margin-bottom: 2rem; box-shadow: 0 4px 12px var(--shadow); }
.condition { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
.condition-item { background: rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 0.75rem; text-align: center; }
.condition-value { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.25rem; }
.condition-label { color: var(--secondary); font-size: 0.9rem; }
.forecast-preview { display: flex; gap: 1rem; overflow-x: auto; padding: 1rem 0; }
.forecast-item { flex: 0 0 150px; background: var(--card-bg); padding: 1rem; border-radius: 1rem; box-shadow: 0 2px 4px var(--shadow); }
.modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.4); display: none; justify-content: center; align-items: center; z-index: 1000; }
.modal-content { background: var(--card-bg); padding: 2rem; border-radius: 1.5rem; max-width: 90%; max-height: 90vh; overflow: auto; width: 800px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
.close-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--primary); }
.refresh-btn { position: absolute; top: 1rem; right: 1rem; padding: 0.5rem 1rem; background: var(--accent); color: white; border: none; border-radius: 0.5rem; cursor: pointer; }
.forecast-details { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; }
</style>
</head>
<body>
<div class="container">
<div class="header">
<button class="refresh-btn" onclick="loadWeather(true)">🔄 Refresh</button>
<h1>🌤️ Weather Dashboard</h1>
<div class="meta-info">
<span>🏢 ${colo}</span>
<span>⏳ <span id="processing-time">-</span>ms</span>
<span>⏱ <span id="fetched-time">-</span>ms</span>
<span>🕒 <span id="current-time">-</span></span>
<span>🌐 <span id="current-timezone">-</span></span>
<span>📍 <span id="current-location">-</span></span>
</div>
</div>
<div class="current-conditions">
<h2>Current Weather</h2>
<div class="condition">
<div class="condition-item">
<div class="condition-value">🌡️ <span id="current-temp">-</span></div>
<div class="condition-label">Temperature</div>
</div>
<div class="condition-item">
<div class="condition-value">👋 <span id="current-feels">-</span></div>
<div class="condition-label">Feels Like</div>
</div>
<div class="condition-item">
<div class="condition-value">💧 <span id="current-humidity">-</span></div>
<div class="condition-label">Humidity</div>
</div>
<div class="condition-item">
<div class="condition-value">🌧️ <span id="current-precipitation">-</span></div>
<div class="condition-label">Precipitation</div>
</div>
<div class="condition-item">
<div class="condition-value">🌬️ <span id="current-wind">-</span></div>
<div class="condition-label">Wind Speed</div>
</div>
<div class="condition-item">
<div class="condition-value">🧭 <span id="current-wind-dir">-</span></div>
<div class="condition-label">Wind Direction</div>
</div>
</div>
<div class="condition">
<div class="condition-item">
<div class="condition-value">🌅 <span id="current-sunrise">-</span></div>
<div class="condition-label">Sunrise</div>
</div>
<div class="condition-item">
<div class="condition-value">🌇 <span id="current-sunset">-</span></div>
<div class="condition-label">Sunset</div>
</div>
</div>
</div>
<div class="widgets-container">
<div class="widget" onclick="openModal('hourly')">
<h3>🕒 Hourly Forecast</h3>
<div class="forecast-preview" id="hourly-preview"></div>
</div>
<div class="widget" onclick="openModal('daily')">
<h3>📆 Daily Forecast</h3>
<div class="forecast-preview" id="daily-preview"></div>
</div>
</div>
</div>
<div class="modal" id="hourly-modal">
<div class="modal-content">
<div class="modal-header">
<h2>24-Hour Forecast</h2>
<button class="close-btn" onclick="closeModal()">×</button>
</div>
<div class="forecast-details" id="hourly-details"></div>
</div>
</div>
<div class="modal" id="daily-modal">
<div class="modal-content">
<div class="modal-header">
<h2>7-Day Forecast</h2>
<button class="close-btn" onclick="closeModal()">×</button>
</div>
<div class="forecast-details" id="daily-details"></div>
</div>
</div>
<script>
let weatherData = null;
async function loadWeather(forceRefresh = false) {
  const clientStartTime = performance.now();
  try {
    const coords = await getLocation();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const apiUrl = `/api/weather?lat=${coords.latitude}&lon=${coords.longitude}&tz=${tz}${forceRefresh ? '&noCache='+Date.now() : ''}`;
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error("HTTP " + response.status);
    weatherData = await response.json();
    document.getElementById("fetched-time").textContent = Math.round(performance.now() - clientStartTime);
    document.getElementById("processing-time").textContent = weatherData.meta.processedMs;
    updateUI();
    document.getElementById("current-time").textContent = new Date().toLocaleTimeString("en-US", { timeZone: tz, hour12: false });
    document.getElementById("current-timezone").textContent = tz;
    const locationRes = await fetch(`/api/c2l?lat=${coords.latitude}&lon=${coords.longitude}${forceRefresh ? '&noCache='+Date.now() : ''}`);
    const locationData = await locationRes.json();
    document.getElementById("current-location").textContent = `${locationData.city}, ${locationData.country}`;
  } catch (error) {
    showError(error);
  }
}

function updateUI() {
  document.getElementById("current-temp").textContent = weatherData.current.temp;
  document.getElementById("current-feels").textContent = weatherData.current.feelsLike;
  document.getElementById("current-humidity").textContent = weatherData.current.humidity;
  document.getElementById("current-precipitation").textContent = weatherData.current.precipitation;
  document.getElementById("current-wind").textContent = weatherData.current.windSpeed;
  document.getElementById("current-wind-dir").textContent = weatherData.current.windDirection;
  document.getElementById("current-sunrise").textContent = weatherData.current.sunrise;
  document.getElementById("current-sunset").textContent = weatherData.current.sunset;
  
  const hourlyPreview = document.getElementById("hourly-preview");
  hourlyPreview.innerHTML = weatherData.hourly.slice(0, 3).map(hour => `
    <div class="forecast-item">
      <div>${hour.time}</div>
      <div>🌡️ ${hour.temp}</div>
      <div>💧 ${hour.precipitation}</div>
    </div>
  `).join("");
  
  const dailyPreview = document.getElementById("daily-preview");
  dailyPreview.innerHTML = weatherData.daily.slice(0, 3).map(day => `
    <div class="forecast-item">
      <div>${day.date}</div>
      <div>🌡️ ${day.tempMax}</div>
      <div>🌧️ ${day.precipitation}</div>
    </div>
  `).join("");
}

function openModal(type) {
  const modal = document.getElementById(`${type}-modal`);
  const details = document.getElementById(`${type}-details`);
  
  details.innerHTML = weatherData[type].map(item => `
    <div class="forecast-item">
      ${Object.entries(item).map(([key, value]) => `
        <div>${key === 'time' || key === 'date' ? value : `${getIcon(key)} ${value}`}</div>
      `).join('')}
    </div>
  `).join("");
  
  modal.style.display = "flex";
}

function closeModal() {
  document.querySelectorAll('.modal').forEach(modal => modal.style.display = "none");
}

function getIcon(key) {
  const icons = {
    temp: '🌡️',
    precipitation: '💧',
    windSpeed: '🌬️',
    windDirection: '🧭',
    tempMax: '⬆️',
    tempMin: '⬇️'
  };
  return icons[key] || '';
}

async function getLocation() {
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve(pos.coords),
      () => resolve({ latitude: 37.7749, longitude: -122.4194 }),
      { timeout: 5000 }
    );
  });
}

loadWeather();
</script>
</body>
</html>;

export default {
  async fetch(request, env, context) {
    const startTime = Date.now();
    const url = new URL(request.url);
    const colo = request.cf?.colo || "unknown";
    const commonHeaders = { "Cache-Control": "no-store", "Pragma": "no-cache" };

    if (url.pathname === "/api/c2l") {
      const lat = url.searchParams.get("lat");
      const lon = url.searchParams.get("lon");
      if (!lat || !lon) return new Response(JSON.stringify({ error: "Invalid coordinates" }), { status: 400 });
      
      const cacheKey = `c2l-${lat}-${lon}`;
      if (!url.searchParams.has('noCache')) {
        const cached = await env.WEATHER_CACHE.get(cacheKey);
        if (cached) return new Response(cached, { headers: { ...commonHeaders, "Content-Type": "application/json" } });
      }

      const reverseUrl = new URL("https://nominatim.openstreetmap.org/reverse");
      reverseUrl.searchParams = new URLSearchParams({ format: "json", lat, lon, zoom: "10", addressdetails: "1" });
      const response = await fetch(reverseUrl, { headers: { "User-Agent": "CloudflareWorkerWeatherApp/1.0" } });
      
      if (!response.ok) return new Response(JSON.stringify({ error: "Geocoding failed" }), { status: 500 });
      
      const data = await response.json();
      const result = {
        city: data.address?.city || data.address?.town || "Unknown",
        country: data.address?.country || "Unknown"
      };
      
      await env.WEATHER_CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: 86400 });
      return new Response(JSON.stringify(result), { headers: commonHeaders });
    }

    if (url.pathname === "/api/weather") {
      const params = {
        lat: Math.min(90, Math.max(-90, parseFloat(url.searchParams.get("lat")) || 37.7749)),
        lon: Math.min(180, Math.max(-180, parseFloat(url.searchParams.get("lon")) || -122.4194)),
        tz: url.searchParams.get("tz") || Intl.DateTimeFormat().resolvedOptions().timeZone
      };
      
      const cacheKey = `weather-${params.lat}-${params.lon}-${params.tz}`;
      if (!url.searchParams.has('noCache')) {
        const cached = await env.WEATHER_CACHE.get(cacheKey);
        if (cached) return new Response(cached, { headers: { ...commonHeaders, "Content-Type": "application/json" } });
      }

      const apiUrl = new URL("https://api.open-meteo.com/v1/forecast");
      apiUrl.searchParams = new URLSearchParams({
        latitude: params.lat,
        longitude: params.lon,
        timezone: params.tz,
        hourly: "temperature_2m,precipitation_probability,precipitation,wind_speed_10m,wind_direction_10m",
        current: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m",
        daily: "weathercode,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,precipitation_probability_max",
        forecast_days: "7"
      });

      const response = await fetch(apiUrl);
      if (!response.ok) return new Response(JSON.stringify({ error: "Weather API failed" }), { status: 500 });
      
      const data = await response.json();
      const payload = {
        meta: {
          colo,
          processedMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        },
        current: {
          temp: `${data.current.temperature_2m}°C`,
          feelsLike: `${data.current.apparent_temperature}°C`,
          humidity: `${data.current.relative_humidity_2m}%`,
          precipitation: `${data.current.precipitation}mm`,
          windSpeed: `${data.current.wind_speed_10m} km/h`,
          windDirection: data.current.wind_direction_10m,
          sunrise: formatTime(data.daily.sunrise[0], params.tz),
          sunset: formatTime(data.daily.sunset[0], params.tz)
        },
        hourly: data.hourly.time.slice(0, 24).map((time, i) => ({
          time: formatTime(time, params.tz),
          temp: `${data.hourly.temperature_2m[i]}°C`,
          precipitation: `${data.hourly.precipitation_probability[i]}%`,
          windSpeed: `${data.hourly.wind_speed_10m[i]} km/h`,
          windDirection: data.hourly.wind_direction_10m[i]
        })),
        daily: data.daily.time.slice(0, 7).map((date, i) => ({
          date: formatDate(date, params.tz),
          tempMax: `${data.daily.temperature_2m_max[i]}°C`,
          tempMin: `${data.daily.temperature_2m_min[i]}°C`,
          precipitation: `${data.daily.precipitation_sum[i]}mm`,
          precipitationChance: `${data.daily.precipitation_probability_max[i]}%`
        }))
      };

      await env.WEATHER_CACHE.put(cacheKey, JSON.stringify(payload), { expirationTtl: 1800 });
      return new Response(JSON.stringify(payload), { headers: commonHeaders });
    }

    return new Response(HTML(colo), { headers: { ...commonHeaders, "Content-Type": "text/html" } });
  }
};
