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
const HTML = (colo) => `<!DOCTYPE html>
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
.header { text-align: center; margin-bottom: 2rem; }
.header h1 { margin-bottom: 0.5rem; }
.meta-info { font-size: 0.9rem; color: var(--secondary); display: flex; gap: 1rem; align-items: center; flex-wrap: nowrap; }
.meta-info span { white-space: nowrap; }
.widgets-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; }
.widget { background: var(--card-bg); padding: 1.5rem; border-radius: 1rem; box-shadow: 0 4px 12px var(--shadow); transition: transform 0.2s ease; }
.widget:hover { transform: translateY(-3px); }
.current-conditions { background: var(--card-bg); padding: 2rem; border-radius: 1.5rem; margin-bottom: 2rem; box-shadow: 0 4px 12px var(--shadow); }
.condition { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
.condition-item { background: rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 0.75rem; text-align: center; }
.condition-value { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.25rem; }
.condition-label { color: var(--secondary); font-size: 0.9rem; }
.forecast-preview { display: flex; gap: 1rem; overflow-x: auto; padding: 1rem 0; cursor: pointer; }
.forecast-item { flex: 0 0 150px; background: var(--card-bg); padding: 1rem; border-radius: 1rem; box-shadow: 0 2px 4px var(--shadow); }
.modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.4); display: none; justify-content: center; align-items: center; }
.modal-content { background: var(--card-bg); padding: 2rem; border-radius: 1.5rem; max-width: 90%; max-height: 90vh; overflow: auto; position: relative; }
.close-btn { position: absolute; right: 1rem; top: 1rem; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--primary); }
.refresh-btn { margin-top: 1rem; padding: 0.5rem 1rem; background: var(--accent); color: #fff; border: none; border-radius: 0.5rem; cursor: pointer; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>🌤️ Weather Dashboard</h1>
    <button class="refresh-btn" onclick="refreshWeather()">Refresh</button>
    <div class="meta-info">
      <span>🏢 Data Center: ${colo}</span>
      <span>⏳ Processing Time: <span id="processing-time">-</span>ms</span>
      <span>⏱ Fetched in: <span id="fetched-time">-</span>ms</span>
      <span>🕒 Time: <span id="current-time">-</span></span>
      <span>🌐 Timezone: <span id="current-timezone">-</span></span>
      <span>🏙 City: <span id="current-city">-</span>, Country: <span id="current-country">-</span></span>
    </div>
  </div>
  <div class="current-conditions" id="current-conditions">
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
    <div class="widget">
      <h3>🕒 Hourly Forecast (Next 3 Hours)</h3>
      <div class="forecast-preview" id="hourly-preview" onclick="openModal('hourly')"></div>
    </div>
    <div class="widget">
      <h3>📆 Daily Forecast (Next 3 Days)</h3>
      <div class="forecast-preview" id="daily-preview" onclick="openModal('daily')"></div>
    </div>
  </div>
</div>
<div class="modal" id="hourly-modal">
  <div class="modal-content">
    <button class="close-btn" onclick="closeModal('hourly')">×</button>
    <h2>🕒 24-Hour Forecast</h2>
    <div class="forecast-details" id="hourly-details"></div>
  </div>
</div>
<div class="modal" id="daily-modal">
  <div class="modal-content">
    <button class="close-btn" onclick="closeModal('daily')">×</button>
    <h2>📆 7-Day Forecast</h2>
    <div class="forecast-details" id="daily-details"></div>
  </div>
</div>
<script>
let weatherData = null;
async function loadWeather(noCache) {
  const clientStartTime = performance.now();
  try {
    const coords = await getLocation();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const weatherUrl = "/api/weather?lat=" + coords.latitude + "&lon=" + coords.longitude + "&tz=" + tz + (noCache ? "&noCache=true" : "");
    const response = await fetch(weatherUrl);
    if (!response.ok) throw new Error("HTTP " + response.status);
    weatherData = await response.json();
    const fetchTime = Math.round(performance.now() - clientStartTime);
    document.getElementById("fetched-time").textContent = fetchTime;
    document.getElementById("processing-time").textContent = weatherData.meta.processedMs;
    updateUI();
    document.getElementById("current-time").textContent = new Date().toLocaleTimeString("en-US", { timeZone: tz, hour12: false });
    document.getElementById("current-timezone").textContent = tz;
    const c2lUrl = "/api/c2l?lat=" + coords.latitude + "&lon=" + coords.longitude + (noCache ? "&noCache=true" : "");
    const res = await fetch(c2lUrl);
    const data = await res.json();
    document.getElementById("current-city").textContent = data.city;
    document.getElementById("current-country").textContent = data.country;
  } catch (error) {
    showError(error);
  }
}
function refreshWeather() {
  loadWeather(true);
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
  var hourlyPreview = document.getElementById("hourly-preview");
  hourlyPreview.innerHTML = weatherData.hourly.slice(0, 3).map(function(hour) {
    return '<div class="forecast-item">' +
           '<div>' + hour.time + '</div>' +
           '<div>🌡️ ' + hour.temp + '</div>' +
           '<div>💧 ' + hour.precipitation + '</div>' +
           '<div>🧭 ' + hour.windDirection + '</div>' +
           '</div>';
  }).join("");
  var dailyPreview = document.getElementById("daily-preview");
  dailyPreview.innerHTML = weatherData.daily.slice(0, 3).map(function(day) {
    return '<div class="forecast-item">' +
           '<div>' + day.date + '</div>' +
           '<div>🌡️ ' + day.tempMax + '</div>' +
           '<div>🌡️ ' + day.tempMin + '</div>' +
           '<div>🌧️ ' + day.precipitationChance + '</div>' +
           '</div>';
  }).join("");
  var metaInfo = document.querySelector(".meta-info");
  metaInfo.innerHTML = '<span>🏢 Data Center: ' + weatherData.meta.colo + '</span>' +
                       '<span>⏳ Processing Time: ' + weatherData.meta.processedMs + 'ms</span>' +
                       '<span>⏱ Fetched in: <span id="fetched-time">' + document.getElementById("fetched-time").textContent + '</span>ms</span>' +
                       '<span>🕒 Time: <span id="current-time">' + document.getElementById("current-time").textContent + '</span></span>' +
                       '<span>🌐 Timezone: <span id="current-timezone">' + document.getElementById("current-timezone").textContent + '</span></span>' +
                       '<span>🏙 City: <span id="current-city">' + document.getElementById("current-city").textContent + '</span>, Country: <span id="current-country">' + document.getElementById("current-country").textContent + '</span></span>';
}
function getLocation() {
  return new Promise(function(resolve, reject) {
    navigator.geolocation.getCurrentPosition(function(pos) { resolve(pos.coords); }, function(error) { resolve({ latitude: 37.7749, longitude: -122.4194 }); }, { timeout: 5000 });
  });
}
function showError(error) {
  console.error("Error:", error);
  alert("An error occurred: " + error.message);
}
function showHourlyForecast() {
  var details = document.getElementById("hourly-details");
  details.innerHTML = weatherData.hourly.map(function(hour) {
    return '<div class="forecast-item">' +
           '<div>' + hour.time + '</div>' +
           '<div>🌡️ ' + hour.temp + '</div>' +
           '<div>💧 ' + hour.precipitation + '</div>' +
           '<div>🌬️ ' + hour.windSpeed + '</div>' +
           '<div>🧭 ' + hour.windDirection + '</div>' +
           '</div>';
  }).join("");
}
function showDailyForecast() {
  var details = document.getElementById("daily-details");
  details.innerHTML = weatherData.daily.map(function(day) {
    return '<div class="forecast-item">' +
           '<div>' + day.date + '</div>' +
           '<div>🌡️ ' + day.tempMax + '</div>' +
           '<div>🌡️ ' + day.tempMin + '</div>' +
           '<div>🌧️ ' + day.precipitation + '</div>' +
           '<div>🌧️ ' + day.precipitationChance + '</div>' +
           '<div>🌅 ' + day.sunrise + '</div>' +
           '<div>🌇 ' + day.sunset + '</div>' +
           '</div>';
  }).join("");
}
function openModal(type) {
  if (type === "hourly") {
    showHourlyForecast();
    document.getElementById("hourly-modal").style.display = "flex";
  } else {
    showDailyForecast();
    document.getElementById("daily-modal").style.display = "flex";
  }
}
function closeModal(type) {
  if (type === "hourly") {
    document.getElementById("hourly-modal").style.display = "none";
  } else {
    document.getElementById("daily-modal").style.display = "none";
  }
}
loadWeather();
</script>
</body>
</html>`;
export default {
  async fetch(request, env, context) {
    const startTime = Date.now();
    const url = new URL(request.url);
    const colo = request.cf && request.cf.colo ? request.cf.colo : "unknown";
    const commonHeaders = {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    };
    if (url.pathname === "/api/c2l") {
      const lat = url.searchParams.get("lat");
      const lon = url.searchParams.get("lon");
      if (!lat || !lon) {
        return new Response(JSON.stringify({ error: "lat and lon required", meta: { processedMs: Date.now() - startTime, colo: colo } }), { status: 400, headers: { ...commonHeaders, "Content-Type": "application/json" } });
      }
      if (!url.searchParams.has("noCache")) {
        const c2lKey = "c2l-" + lat + "-" + lon;
        const cachedC2l = await env.WEATHER_CACHE.get(c2lKey);
        if (cachedC2l) {
          const data = JSON.parse(cachedC2l);
          return new Response(JSON.stringify({ ...data, meta: { processedMs: Date.now() - startTime, colo: colo } }), { headers: { ...commonHeaders, "Content-Type": "application/json" } });
        }
      }
      const reverseUrl = new URL("https://nominatim.openstreetmap.org/reverse");
      reverseUrl.searchParams.set("format", "json");
      reverseUrl.searchParams.set("lat", lat);
      reverseUrl.searchParams.set("lon", lon);
      reverseUrl.searchParams.set("zoom", "10");
      reverseUrl.searchParams.set("addressdetails", "1");
      const reverseRes = await fetch(reverseUrl.toString(), { headers: { "User-Agent": "CloudflareWorkerWeatherApp/1.0" } });
      if (!reverseRes.ok) {
        return new Response(JSON.stringify({ error: "Reverse geocoding failed", meta: { processedMs: Date.now() - startTime, colo: colo } }), { status: reverseRes.status, headers: { ...commonHeaders, "Content-Type": "application/json" } });
      }
      const reverseData = await reverseRes.json();
      let city = "Unknown";
      let country = "Unknown";
      if (reverseData.address) {
        if (reverseData.address.city) city = reverseData.address.city;
        else if (reverseData.address.town) city = reverseData.address.town;
        else if (reverseData.address.village) city = reverseData.address.village;
        else if (reverseData.address.county) city = reverseData.address.county;
        if (reverseData.address.country) country = reverseData.address.country;
      }
      const result = { city: city, country: country };
      if (!url.searchParams.has("noCache")) {
        await env.WEATHER_CACHE.put("c2l-" + lat + "-" + lon, JSON.stringify(result), { expirationTtl: 3600 });
      }
      return new Response(JSON.stringify({ ...result, meta: { processedMs: Date.now() - startTime, colo: colo } }), { headers: { ...commonHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/weather") {
      const params = {
        lat: Math.min(90, Math.max(-90, parseFloat(url.searchParams.get("lat")) || 37.7749)),
        lon: Math.min(180, Math.max(-180, parseFloat(url.searchParams.get("lon")) || -122.4194)),
        tz: url.searchParams.get("tz") || Intl.DateTimeFormat().resolvedOptions().timeZone
      };
      const cacheKey = "weather-" + params.lat + "-" + params.lon + "-" + params.tz;
      if (!url.searchParams.has("noCache")) {
        const cached = await env.WEATHER_CACHE.get(cacheKey);
        if (cached) {
          const weatherPayload = JSON.parse(cached);
          const meta = {
            colo: colo,
            coordinates: { lat: params.lat, lon: params.lon },
            timezone: params.tz,
            timestamp: new Date().toISOString(),
            processedMs: Date.now() - startTime
          };
          const responsePayload = { meta, current: weatherPayload.current, hourly: weatherPayload.hourly, daily: weatherPayload.daily };
          return new Response(JSON.stringify(responsePayload), { headers: { ...commonHeaders, "Content-Type": "application/json" } });
        }
      }
      try {
        const apiUrl = new URL("https://api.open-meteo.com/v1/forecast");
        apiUrl.searchParams.set("latitude", params.lat);
        apiUrl.searchParams.set("longitude", params.lon);
        apiUrl.searchParams.set("timezone", params.tz);
        apiUrl.searchParams.set("hourly", "temperature_2m,precipitation_probability,precipitation,wind_speed_10m,wind_direction_10m");
        apiUrl.searchParams.set("current", "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m");
        apiUrl.searchParams.set("daily", "weathercode,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,precipitation_probability_max");
        apiUrl.searchParams.set("forecast_days", 7);
        const response = await fetch(apiUrl);
        const textResponse = await response.text();
        if (!response.ok) {
          if (response.status === 429) {
            throw new Error("Open-Meteo rate limit reached");
          } else {
            throw new Error("HTTP " + response.status);
          }
        }
        const rawData = JSON.parse(textResponse);
        if (!rawData.latitude || !rawData.longitude) throw new Error("Invalid API response");
        const weatherPayload = {
          current: {
            temp: rawData.current.temperature_2m + "°C",
            feelsLike: rawData.current.apparent_temperature + "°C",
            humidity: rawData.current.relative_humidity_2m + "%",
            precipitation: (rawData.current.precipitation ?? 0) + "mm",
            windSpeed: rawData.current.wind_speed_10m + " km/h",
            windDirection: rawData.current.wind_direction_10m,
            sunrise: formatTime(rawData.daily.sunrise[0], params.tz),
            sunset: formatTime(rawData.daily.sunset[0], params.tz)
          },
          hourly: rawData.hourly.time.slice(0, 24).map(function(time, i) {
            return {
              time: formatTime(time, params.tz),
              temp: rawData.hourly.temperature_2m[i] + "°C",
              precipitation: rawData.hourly.precipitation_probability[i] + "%",
              precipitationAmount: rawData.hourly.precipitation[i] + "mm",
              windSpeed: rawData.hourly.wind_speed_10m[i] + " km/h",
              windDirection: rawData.hourly.wind_direction_10m[i]
            };
          }),
          daily: rawData.daily.time.slice(0, 7).map(function(date, i) {
            return {
              date: formatDate(date, params.tz),
              tempMax: rawData.daily.temperature_2m_max[i] + "°C",
              tempMin: rawData.daily.temperature_2m_min[i] + "°C",
              precipitation: rawData.daily.precipitation_sum[i] + "mm",
              precipitationChance: rawData.daily.precipitation_probability_max[i] + "%",
              sunrise: formatTime(rawData.daily.sunrise[i], params.tz),
              sunset: formatTime(rawData.daily.sunset[i], params.tz)
            };
          })
        };
        const meta = {
          colo: colo,
          coordinates: { lat: params.lat, lon: params.lon },
          timezone: params.tz,
          timestamp: new Date().toISOString(),
          processedMs: Date.now() - startTime
        };
        const responsePayload = { meta, current: weatherPayload.current, hourly: weatherPayload.hourly, daily: weatherPayload.daily };
        await env.WEATHER_CACHE.put(cacheKey, JSON.stringify(weatherPayload), { expirationTtl: 3600 });
        return new Response(JSON.stringify(responsePayload), { headers: { ...commonHeaders, "Content-Type": "application/json" } });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message, meta: { colo: colo, processedMs: Date.now() - startTime } }), { status: 500, headers: { ...commonHeaders, "Content-Type": "application/json" } });
      }
    }
    return new Response(HTML(colo), { headers: { ...commonHeaders, "Content-Type": "text/html" } });
  }
};
