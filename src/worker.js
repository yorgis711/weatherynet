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
.header { text-align: center; margin-bottom: 1rem; }
.header h1 { margin-bottom: 0.5rem; }
.refresh-btn { margin-top: 0.5rem; padding: 0.5rem 1rem; background: var(--accent); color: #fff; border: none; border-radius: 0.5rem; cursor: pointer; }
.meta-info { display: flex; flex-wrap: wrap; gap: 1rem; font-size: 0.9rem; color: var(--secondary); justify-content: center; margin-bottom: 1.5rem; }
.meta-info span { white-space: nowrap; }
.meta-info .location { display: flex; gap: 0.5rem; }
@media (max-width: 767px) { .meta-info .location { display: block; } }
.current-conditions { background: var(--card-bg); padding: 2rem; border-radius: 1.5rem; margin-bottom: 2rem; box-shadow: 0 4px 12px var(--shadow); }
.condition { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
.condition-item { background: rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 0.75rem; text-align: center; }
.condition-value { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.25rem; }
.condition-label { color: var(--secondary); font-size: 0.9rem; }
.widgets-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; }
.widget { background: var(--card-bg); padding: 1.5rem; border-radius: 1rem; box-shadow: 0 4px 12px var(--shadow); transition: transform 0.2s ease; }
.widget:hover { transform: translateY(-3px); }
.forecast-preview { display: flex; gap: 1rem; overflow-x: auto; padding: 1rem 0; cursor: pointer; }
.forecast-item { flex: 0 0 150px; background: var(--card-bg); padding: 1rem; border-radius: 1rem; box-shadow: 0 2px 4px var(--shadow); }
.modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.4); display: none; justify-content: center; align-items: center; }
.modal-content { background: var(--card-bg); border-radius: 1.5rem; max-width: 90%; max-height: 90vh; overflow: hidden; position: relative; }
.modal-header { display: flex; justify-content: center; align-items: center; position: relative; padding: 1rem 2rem 0 2rem; }
.modal-header h2 { margin: 0; }
.close-btn { position: absolute; right: 1rem; top: 1rem; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--primary); z-index: 10; }
.modal-body { overflow-y: auto; max-height: calc(90vh - 4rem); padding: 1rem 2rem 2rem 2rem; }
.provider-toggle, .units-toggle { margin-top: 0.5rem; font-size: 0.9rem; }
#error-display { color: red; text-align: center; margin-top: 1rem; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>🌤️ Weather Dashboard</h1>
    <button class="refresh-btn" onclick="refreshWeather()">Refresh</button>
    <div class="provider-toggle">
      Weather Provider:
      <select id="weather-provider" onchange="refreshWeather(); localStorage.setItem('weather-provider', this.value);">
        <option value="open-meteo">Open-Meteo</option>
        <option value="metno">MET Norway</option>
      </select>
      <span id="provider-used"></span>
    </div>
    <div class="units-toggle">
      Units:
      <select id="units" onchange="refreshWeather(); localStorage.setItem('units', this.value);">
        <option value="metric">Metric</option>
        <option value="imperial">Imperial</option>
      </select>
      <span id="units-used"></span>
    </div>
  </div>
  <div class="meta-info">
    <span id="data-center">🏢 Data Center: ${colo}</span>
    <span id="processing-time-meta">⏳ Processing Time: - ms</span>
    <span id="fetched-time-meta">⏱ Fetched in: - ms</span>
    <span id="current-time-meta">🕒 Time: -</span>
    <span id="current-timezone-meta">🌐 Timezone: -</span>
    <span>🏙 City: <span id="current-city">-</span></span>
    <span>Country: <span id="current-country">-</span></span>
  </div>
  <div id="error-display"></div>
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
    <div class="modal-header">
      <h2>🕒 24-Hour Forecast</h2>
      <button class="close-btn" onclick="closeModal('hourly')">×</button>
    </div>
    <div class="modal-body" id="hourly-details"></div>
  </div>
</div>
<div class="modal" id="daily-modal">
  <div class="modal-content">
    <div class="modal-header">
      <h2>📆 7-Day Forecast</h2>
      <button class="close-btn" onclick="closeModal('daily')">×</button>
    </div>
    <div class="modal-body" id="daily-details"></div>
  </div>
</div>
<script>
if(localStorage.getItem("weather-provider")) {
  document.getElementById("weather-provider").value = localStorage.getItem("weather-provider")
}
if(localStorage.getItem("units")) {
  document.getElementById("units").value = localStorage.getItem("units")
}
let weatherData = null;
async function loadWeather(noCache) {
  const clientStartTime = performance.now();
  document.getElementById("error-display").textContent = "";
  try {
    const coords = await getLocation();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const provider = document.getElementById("weather-provider").value || "open-meteo";
    const units = document.getElementById("units").value || "metric";
    document.getElementById("provider-used").textContent = " (Provider: " + provider + ")";
    document.getElementById("units-used").textContent = " (Units: " + units + ")";
    let weatherUrl = "/api/weather?lat=" + coords.latitude + "&lon=" + coords.longitude + "&tz=" + tz + "&provider=" + provider + "&units=" + units;
    if (noCache) weatherUrl += "&noCache=true";
    const response = await fetch(weatherUrl);
    if (!response.ok) throw new Error("HTTP " + response.status);
    weatherData = await response.json();
    const fetchTime = Math.round(performance.now() - clientStartTime);
    document.getElementById("fetched-time-meta").textContent = "⏱ Fetched in: " + fetchTime + "ms";
    document.getElementById("processing-time-meta").textContent = "⏳ Processing Time: " + weatherData.meta.processedMs + "ms";
    document.getElementById("current-time-meta").textContent = "🕒 Time: " + new Date().toLocaleTimeString("en-US", { timeZone: tz, hour12: false });
    document.getElementById("current-timezone-meta").textContent = "🌐 Timezone: " + tz;
    updateUI();
    const c2lUrl = "/api/c2l?lat=" + coords.latitude + "&lon=" + coords.longitude + (noCache ? "&noCache=true" : "");
    const res = await fetch(c2lUrl);
    const data = await res.json();
    document.getElementById("current-city").textContent = data.city;
    document.getElementById("current-country").textContent = data.country;
  } catch (error) {
    const now = new Date();
    document.getElementById("fetched-time-meta").textContent = "⏱ Fetched in: 0ms";
    document.getElementById("processing-time-meta").textContent = "⏳ Processing Time: 0ms";
    document.getElementById("current-time-meta").textContent = "🕒 Time: " + now.toLocaleTimeString("en-US");
    document.getElementById("current-timezone-meta").textContent = "🌐 Timezone: N/A";
    document.getElementById("current-city").textContent = "Unknown";
    document.getElementById("current-country").textContent = "Unknown";
    document.getElementById("current-temp").textContent = "--";
    document.getElementById("current-feels").textContent = "--";
    document.getElementById("current-humidity").textContent = "--";
    document.getElementById("current-precipitation").textContent = "--";
    document.getElementById("current-wind").textContent = "--";
    document.getElementById("current-wind-dir").textContent = "--";
    document.getElementById("current-sunrise").textContent = "--";
    document.getElementById("current-sunset").textContent = "--";
    document.getElementById("hourly-preview").innerHTML = "";
    document.getElementById("daily-preview").innerHTML = "";
    document.getElementById("error-display").textContent = "Error: " + error.message;
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
}
function getLocation() {
  return new Promise(function(resolve, reject) {
    navigator.geolocation.getCurrentPosition(
      function(pos) { resolve(pos.coords); },
      function(error) { resolve({ latitude: 0, longitude: 0 }); },
      { timeout: 5000 }
    );
  });
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
document.querySelectorAll('.modal').forEach(function(modal) {
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
});
loadWeather();
</script>
</body>
</html>`;
export default {
  async fetch(request, env, context) {
    const startTime = Date.now();
    const url = new URL(request.url);
    const colo = (request.cf && request.cf.colo) ? request.cf.colo : "unknown";
    const commonHeaders = {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    };
    function convertTemp(temp, units) {
      return units === "imperial" ? (temp * 9/5 + 32).toFixed(1) + "°F" : temp.toFixed(1) + "°C";
    }
    function convertWindFromMs(speed, units) {
      return units === "imperial" ? (speed * 2.23694).toFixed(1) + " mph" : (speed * 3.6).toFixed(1) + " km/h";
    }
    function convertWindFromKmh(speed, units) {
      return units === "imperial" ? (speed * 0.621371).toFixed(1) + " mph" : speed.toFixed(1) + " km/h";
    }
    function convertPrecip(precip, units) {
      return units === "imperial" ? (precip / 25.4).toFixed(2) + " in" : precip.toFixed(1) + " mm";
    }
    if (url.pathname === "/api/c2l") {
      const lat = url.searchParams.get("lat");
      const lon = url.searchParams.get("lon");
      if (!lat || !lon) {
        const meta = { processedMs: Date.now() - startTime, colo: colo };
        return new Response(JSON.stringify({ error: "lat and lon required", meta }), {
          status: 400,
          headers: { ...commonHeaders, "Content-Type": "application/json" }
        });
      }
      if (!url.searchParams.has("noCache")) {
        const c2lKey = "c2l-" + lat + "-" + lon;
        const cachedC2l = await env.WEATHER_CACHE.get(c2lKey);
        if (cachedC2l) {
          const data = JSON.parse(cachedC2l);
          const meta = { processedMs: Date.now() - startTime, colo: colo };
          return new Response(JSON.stringify({ ...data, meta }), {
            headers: { ...commonHeaders, "Content-Type": "application/json" }
          });
        }
      }
      const reverseUrl = new URL("https://nominatim.openstreetmap.org/reverse");
      reverseUrl.searchParams.set("format", "json");
      reverseUrl.searchParams.set("lat", lat);
      reverseUrl.searchParams.set("lon", lon);
      reverseUrl.searchParams.set("zoom", "10");
      reverseUrl.searchParams.set("addressdetails", "1");
      const reverseRes = await fetch(reverseUrl.toString(), {
        headers: { "User-Agent": "yorgisbot" }
      });
      if (!reverseRes.ok) {
        const meta = { processedMs: Date.now() - startTime, colo: colo };
        return new Response(JSON.stringify({ error: "Reverse geocoding failed", meta }), {
          status: reverseRes.status,
          headers: { ...commonHeaders, "Content-Type": "application/json" }
        });
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
      const meta = { processedMs: Date.now() - startTime, colo: colo };
      return new Response(JSON.stringify({ ...result, meta }), {
        headers: { ...commonHeaders, "Content-Type": "application/json" }
      });
    }
    if (url.pathname === "/api/weather") {
  const useBucketing = false; // Toggle this to true if you want bucketing

  const latRaw = parseFloat(url.searchParams.get("lat")) || 0;
  const lonRaw = parseFloat(url.searchParams.get("lon")) || 0;
  const tz = url.searchParams.get("tz") || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const provider = url.searchParams.get("provider") || "open-meteo";
  const units = url.searchParams.get("units") || "metric";

  const bucketPrecision = 0.0045;
  const lat = useBucketing
    ? Math.round(latRaw / bucketPrecision) * bucketPrecision
    : latRaw;
  const lon = useBucketing
    ? Math.round(lonRaw / bucketPrecision) * bucketPrecision
    : lonRaw;

  const cacheKey =
    "weather-" + lat.toFixed(6) + "-" + lon.toFixed(6) + "-" + tz + "-" + provider + "-" + units;

  
      if (!url.searchParams.has("noCache")) {
        const cached = await env.WEATHER_CACHE.get(cacheKey);
        if (cached) {
          const weatherPayload = JSON.parse(cached);
          const meta = {
            colo: colo,
            coordinates: { lat: latRaw, lon: lonRaw },
            timezone: tz,
            timestamp: new Date().toISOString(),
            processedMs: Date.now() - startTime
          };
          const responsePayload = { meta, current: weatherPayload.current, hourly: weatherPayload.hourly, daily: weatherPayload.daily };
          return new Response(JSON.stringify(responsePayload), {
            headers: { ...commonHeaders, "Content-Type": "application/json" }
          });
        }
      }
      try {
        let weatherPayload;
        if (provider === "metno") {
          const metnoUrl = new URL("https://api.met.no/weatherapi/locationforecast/2.0/compact");
          metnoUrl.searchParams.set("lat", latRaw);
          metnoUrl.searchParams.set("lon", lonRaw);
          const metnoRes = await fetch(metnoUrl.toString(), {
            headers: { "User-Agent": "yorgisbot" }
          });
          if (!metnoRes.ok) {
            throw new Error("MET Norway API error: HTTP " + metnoRes.status);
          }
          const rawData = await metnoRes.json();
          const timeseries = rawData.properties.timeseries;
          const currentDetails = timeseries[0].data.instant.details;
          const hourly = timeseries.slice(0, 24).map(entry => ({
            time: formatTime(entry.time, tz),
            temp: convertTemp(entry.data.instant.details.air_temperature, units),
            precipitation: entry.data.next_1_hours ? convertPrecip(entry.data.next_1_hours.details.precipitation_amount, units) : (units==="imperial" ? "0.00 in" : "0.0 mm"),
            windSpeed: convertWindFromMs(entry.data.instant.details.wind_speed, units),
            windDirection: entry.data.instant.details.wind_from_direction
          }));
          const dailyMap = {};
          timeseries.forEach(entry => {
            const dateKey = formatDate(entry.time, tz);
            if (!dailyMap[dateKey]) {
              dailyMap[dateKey] = { temps: [], precipitations: [] };
            }
            dailyMap[dateKey].temps.push(entry.data.instant.details.air_temperature);
            dailyMap[dateKey].precipitations.push(entry.data.next_1_hours ? entry.data.next_1_hours.details.precipitation_amount : 0);
          });
          const daily = Object.keys(dailyMap).slice(0, 7).map(dateKey => {
            const temps = dailyMap[dateKey].temps;
            const totalPrecip = dailyMap[dateKey].precipitations.reduce((a, b) => a + b, 0);
            return {
              date: dateKey,
              tempMax: convertTemp(Math.max(...temps), units),
              tempMin: convertTemp(Math.min(...temps), units),
              precipitation: convertPrecip(totalPrecip, units),
              precipitationChance: "N/A",
              sunrise: "--:--",
              sunset: "--:--"
            };
          });
          weatherPayload = {
            current: {
              temp: convertTemp(currentDetails.air_temperature, units),
              feelsLike: convertTemp(currentDetails.air_temperature, units),
              humidity: currentDetails.relative_humidity + "%",
              precipitation: "N/A",
              windSpeed: convertWindFromMs(currentDetails.wind_speed, units),
              windDirection: currentDetails.wind_from_direction,
              sunrise: "--:--",
              sunset: "--:--"
            },
            hourly,
            daily
          };
        } else {
          const apiUrl = new URL("https://api.open-meteo.com/v1/forecast");
          apiUrl.searchParams.set("latitude", latRaw);
          apiUrl.searchParams.set("longitude", lonRaw);
          apiUrl.searchParams.set("timezone", tz);
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
          weatherPayload = {
            current: {
              temp: convertTemp(rawData.current.temperature_2m, units),
              feelsLike: convertTemp(rawData.current.apparent_temperature, units),
              humidity: rawData.current.relative_humidity_2m + "%",
              precipitation: convertPrecip(rawData.current.precipitation ?? 0, units),
              windSpeed: convertWindFromKmh(rawData.current.wind_speed_10m, units),
              windDirection: rawData.current.wind_direction_10m,
              sunrise: formatTime(rawData.daily.sunrise[0], tz),
              sunset: formatTime(rawData.daily.sunset[0], tz)
            },
            hourly: rawData.hourly.time.slice(0, 24).map(function(time, i) {
              return {
                time: formatTime(time, tz),
                temp: convertTemp(rawData.hourly.temperature_2m[i], units),
                precipitation: rawData.hourly.precipitation_probability[i] + "%",
                precipitationAmount: convertPrecip(rawData.hourly.precipitation[i], units),
                windSpeed: convertWindFromKmh(rawData.hourly.wind_speed_10m[i], units),
                windDirection: rawData.hourly.wind_direction_10m[i]
              };
            }),
            daily: rawData.daily.time.slice(0, 7).map(function(date, i) {
              return {
                date: formatDate(date, tz),
                tempMax: convertTemp(rawData.daily.temperature_2m_max[i], units),
                tempMin: convertTemp(rawData.daily.temperature_2m_min[i], units),
                precipitation: convertPrecip(rawData.daily.precipitation_sum[i], units),
                precipitationChance: rawData.daily.precipitation_probability_max[i] + "%",
                sunrise: formatTime(rawData.daily.sunrise[i], tz),
                sunset: formatTime(rawData.daily.sunset[i], tz)
              };
            })
          };
        }
        const meta = {
          colo: colo,
          coordinates: { lat: latRaw, lon: lonRaw },
          timezone: tz,
          timestamp: new Date().toISOString(),
          processedMs: Date.now() - startTime
        };
        const responsePayload = { meta, current: weatherPayload.current, hourly: weatherPayload.hourly, daily: weatherPayload.daily };
        await env.WEATHER_CACHE.put(cacheKey, JSON.stringify(weatherPayload), { expirationTtl: 3600 });
        return new Response(JSON.stringify(responsePayload), {
          headers: { ...commonHeaders, "Content-Type": "application/json" }
        });
      } catch (error) {
        let city = "Unknown";
        let country = "Unknown";
        try {
          const reverseUrl = new URL("https://nominatim.openstreetmap.org/reverse");
          reverseUrl.searchParams.set("format", "json");
          reverseUrl.searchParams.set("lat", latRaw);
          reverseUrl.searchParams.set("lon", lonRaw);
          reverseUrl.searchParams.set("zoom", "10");
          reverseUrl.searchParams.set("addressdetails", "1");
          const reverseRes = await fetch(reverseUrl.toString(), { headers: { "User-Agent": "yorgisbot" } });
          if (reverseRes.ok) {
            const reverseData = await reverseRes.json();
            if (reverseData.address) {
              if (reverseData.address.city) city = reverseData.address.city;
              else if (reverseData.address.town) city = reverseData.address.town;
              else if (reverseData.address.village) city = reverseData.address.village;
              else if (reverseData.address.county) city = reverseData.address.county;
              if (reverseData.address.country) country = reverseData.address.country;
            }
          }
        } catch (e) {}
        const meta = {
          colo: colo,
          coordinates: { lat: latRaw, lon: lonRaw },
          timezone: tz,
          timestamp: new Date().toISOString(),
          processedMs: Date.now() - startTime
        };
        return new Response(JSON.stringify({ error: error.message, meta, city, country }), {
          status: 500,
          headers: { ...commonHeaders, "Content-Type": "application/json" }
        });
      }
    }
    return new Response(HTML(colo), {
      headers: { ...commonHeaders, "Content-Type": "text/html" }
    });
  }
};
