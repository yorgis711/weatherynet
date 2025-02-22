function formatTime(isoString, timeZone) {
  try {
    return new Date(isoString).toLocaleTimeString("en-US", {
      timeZone: timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  } catch (e) {
    return "--:--";
  }
}

function formatDate(isoString, timeZone) {
  try {
    return new Date(isoString).toLocaleDateString("en-US", {
      timeZone: timeZone,
      weekday: "short",
      month: "short",
      day: "numeric"
    });
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
.meta-info { font-size: 0.9rem; color: var(--secondary); display: flex; gap: 1rem; align-items: center; }
.widgets-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; }
.widget { background: var(--card-bg); padding: 1.5rem; border-radius: 1rem; box-shadow: 0 4px 12px var(--shadow); transition: transform 0.2s ease; }
.widget:hover { transform: translateY(-3px); }
.current-conditions { background: var(--card-bg); padding: 2rem; border-radius: 1.5rem; margin-bottom: 2rem; box-shadow: 0 4px 12px var(--shadow); }
.condition { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
.condition-item { background: rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 0.75rem; text-align: center; }
.condition-value { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.25rem; }
.condition-label { color: var(--secondary); font-size: 0.9rem; }
.forecast-preview { display: flex; gap: 1rem; overflow-x: auto; padding: 1rem 0; }
.forecast-item { flex: 0 0 150px; background: var(--card-bg); padding: 1rem; border-radius: 1rem; box-shadow: 0 2px 4px var(--shadow); }
.modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.4); display: none; justify-content: center; align-items: center; }
.modal-content { background: var(--card-bg); padding: 2rem; border-radius: 1.5rem; max-width: 90%; max-height: 90vh; overflow: auto; }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
.close-btn { position: absolute; right: 1rem; top: 1rem; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--primary); }
</style>
</head>
<body>
<div class="container">
<div class="header">
<h1>🌤️ Weather Dashboard</h1>
<div class="meta-info">
<span>🏢 Data Center: ${colo}</span>
<span>⏳ Processing Time: <span id="processing-time">-</span>ms</span>
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
<div class="condition-label">Wind</div>
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
<h3>🕒 Hourly Forecast</h3>
<div class="forecast-preview" id="hourly-preview"></div>
</div>
<div class="widget">
<h3>📆 Daily Forecast</h3>
<div class="forecast-preview" id="daily-preview"></div>
</div>
</div>
</div>
<div class="modal" id="hourly-modal">
<div class="modal-content">
<div class="modal-header">
<h2>🕒 24-Hour Forecast</h2>
<button class="close-btn" onclick="closeModal()">×</button>
</div>
<div class="forecast-details" id="hourly-details"></div>
</div>
</div>
<div class="modal" id="daily-modal">
<div class="modal-content">
<div class="modal-header">
<h2>📆 7-Day Forecast</h2>
<button class="close-btn" onclick="closeModal()">×</button>
</div>
<div class="forecast-details" id="daily-details"></div>
</div>
</div>
<script>
let weatherData = null;
async function loadWeather() {
  const startTime = performance.now();
  try {
    const coords = await getLocation();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const response = await fetch("/api/weather?lat=" + coords.latitude + "&lon=" + coords.longitude + "&tz=" + tz);
    if (!response.ok) throw new Error("HTTP " + response.status);
    weatherData = await response.json();
    document.getElementById("processing-time").textContent = weatherData.meta.processedMs;
    updateUI();
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
  document.getElementById("current-sunrise").textContent = weatherData.current.sunrise;
  document.getElementById("current-sunset").textContent = weatherData.current.sunset;
  var hourlyPreview = document.getElementById("hourly-preview");
  hourlyPreview.innerHTML = weatherData.hourly.slice(0, 3).map(function(hour) {
    return '<div class="forecast-item">' +
           '<div class="condition-value">' + hour.time + '</div>' +
           '<div class="condition-value">' + hour.temp + '</div>' +
           '<div class="condition-value">' + hour.precipitation + '</div>' +
           '</div>';
  }).join("");
  var dailyPreview = document.getElementById("daily-preview");
  dailyPreview.innerHTML = weatherData.daily.slice(0, 3).map(function(day) {
    return '<div class="forecast-item">' +
           '<div class="condition-value">' + day.date + '</div>' +
           '<div class="condition-value">' + day.tempMax + '</div>' +
           '<div class="condition-value">' + day.precipitationChance + '</div>' +
           '</div>';
  }).join("");
  var metaInfo = document.querySelector(".meta-info");
  metaInfo.innerHTML = '<span>🏢 Data Center: ' + weatherData.meta.colo + '</span>' +
                       '<span>⏳ Processing Time: ' + weatherData.meta.processedMs + 'ms</span>';
}
function getLocation() {
  return new Promise(function(resolve, reject) {
    navigator.geolocation.getCurrentPosition(
      function(pos) { resolve(pos.coords); },
      function(error) { resolve({ latitude: 37.7749, longitude: -122.4194 }); },
      { timeout: 5000 }
    );
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
           '</div>';
  }).join("");
}
function showDailyForecast() {
  var details = document.getElementById("daily-details");
  details.innerHTML = weatherData.daily.map(function(day) {
    return '<div class="forecast-item">' +
           '<div>' + day.date + '</div>' +
           '<div>🌡️ ' + day.tempMax + '</div>' +
           '<div>🌧️ ' + day.precipitation + '</div>' +
           '<div>⛅ ' + day.precipitationChance + '</div>' +
           '</div>';
  }).join("");
}
function openModal(type) {
  if (type === "hourly") {
    showHourlyForecast();
  } else {
    showDailyForecast();
  }
  document.querySelector(".modal").style.display = "flex";
}
function closeModal() {
  document.querySelector(".modal").style.display = "none";
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
    
    if (url.pathname === "/api/weather") {
      try {
        const cacheKey = "weather-" + url.searchParams.get("lat") + "-" + url.searchParams.get("lon") + "-" + url.searchParams.get("tz");
        const cache = await env.WEATHER_CACHE.get(cacheKey);
        if (cache) {
          let data = JSON.parse(cache);
          // Override the colo value with the current request's colo (not cached)
          data.meta.colo = colo;
          return new Response(JSON.stringify(data), { 
            headers: { 
              "Content-Type": "application/json", 
              "Cache-Control": "no-store" 
            } 
          });
        }
        
        const params = {
          lat: Math.min(90, Math.max(-90, parseFloat(url.searchParams.get("lat")) || 37.7749)),
          lon: Math.min(180, Math.max(-180, parseFloat(url.searchParams.get("lon")) || -122.4194)),
          tz: url.searchParams.get("tz") || Intl.DateTimeFormat().resolvedOptions().timeZone
        };
        const apiUrl = new URL("https://api.open-meteo.com/v1/forecast");
        apiUrl.searchParams.set("latitude", params.lat);
        apiUrl.searchParams.set("longitude", params.lon);
        apiUrl.searchParams.set("timezone", params.tz);
        apiUrl.searchParams.set("hourly", "temperature_2m,precipitation_probability,precipitation,wind_speed_10m,wind_direction_10m");
        apiUrl.searchParams.set("current", "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m");
        apiUrl.searchParams.set("daily", "weathercode,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,precipitation_probability_max");
        apiUrl.searchParams.set("forecast_days", 3);
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
        
        const processedData = {
          meta: {
            colo: colo,
            coordinates: { lat: rawData.latitude, lon: rawData.longitude },
            timezone: params.tz,
            timestamp: new Date().toISOString(),
            processedMs: Date.now() - startTime
          },
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
          hourly: rawData.hourly.time.map(function(time, i) {
            return {
              time: formatTime(time, params.tz),
              temp: rawData.hourly.temperature_2m[i] + "°C",
              precipitation: rawData.hourly.precipitation_probability[i] + "%",
              precipitationAmount: rawData.hourly.precipitation[i] + "mm",
              windSpeed: rawData.hourly.wind_speed_10m[i] + " km/h",
              windDirection: rawData.hourly.wind_direction_10m[i]
            };
          }),
          daily: rawData.daily.time.map(function(date, i) {
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
        
        // Cache the successful response for 1 hour (3600 seconds) in Workers KV only
        await env.WEATHER_CACHE.put(cacheKey, JSON.stringify(processedData), { expirationTtl: 3600 });
        return new Response(JSON.stringify(processedData), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
          }
        });
      } catch (error) {
        // Return error response with processing time (do not cache error responses)
        return new Response(JSON.stringify({ error: error.message, colo: colo, processedMs: Date.now() - startTime }), { 
          status: 500, 
          headers: { 
            "Content-Type": "application/json",
            "Cache-Control": "no-store" 
          } 
        });
      }
    }
    
    return new Response(HTML(colo), { 
      headers: { 
        "Content-Type": "text/html", 
        "Cache-Control": "no-store" 
      } 
    });
  }
};