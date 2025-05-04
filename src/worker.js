// Cloudflare Worker: Weather & AQI Dashboard with City Search & Geolocation

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

const HTML = (colo, fallbackLat, fallbackLon) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>🌤️ Weather & AQI Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root { --primary: #2d3436; --secondary: #636e72; --background: #f0f2f5; --card-bg: #ffffff; --accent: #0984e3; --shadow: rgba(0, 0, 0, 0.1); }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Inter", sans-serif; background: var(--background); color: var(--primary); padding: 1rem; }
    .container { max-width: 1200px; margin: 0 auto; position: relative; }
    .header { text-align: center; margin-bottom: 1rem; position: relative; }
    .header h1 { margin-bottom: 0.5rem; }
    .refresh-btn { margin-top: 0.5rem; padding: 0.5rem 1rem; background: var(--accent); color: #fff; border: none; border-radius: 0.5rem; cursor: pointer; }
    #city-search { margin-top: 0.5rem; padding: 0.5rem; width: 80%; max-width: 300px; border: 1px solid #ccc; border-radius: 0.5rem; }
    #city-suggestions { position: absolute; top: 3.5rem; left: 50%; transform: translateX(-50%); background: var(--card-bg); width: 80%; max-width: 300px; border: 1px solid #ccc; border-radius: 0.5rem; max-height: 200px; overflow-y: auto; display: none; z-index: 100; }
    #city-suggestions div { padding: 0.5rem; cursor: pointer; }
    #city-suggestions div:hover { background: var(--background); }
    .meta-info { display: flex; flex-wrap: wrap; gap: 1rem; font-size: 0.9rem; color: var(--secondary); justify-content: center; margin-bottom: 1.5rem; }
    .meta-info span { white-space: nowrap; }
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
    #error-display { color: red; text-align: center; margin-top: 1rem; }
  </style>
</head>
<body>
<script>
  const fallbackCoords = { latitude: ${fallbackLat}, longitude: ${fallbackLon} };
  let manualCoords = null;
  let useGeo = true;
</script>
<div class="container">
  <div class="header">
    <h1>🌤️ Weather & AQI Dashboard</h1>
    <button class="refresh-btn" onclick="refreshAll()">Refresh</button>
    <br>
    <input id="city-search" type="text" placeholder="Search city..." autocomplete="off">
    <div id="city-suggestions"></div>
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
  <div class="current-conditions">
    <h2>Current Weather</h2>
    <div class="condition">
      <div class="condition-item"><div class="condition-value">🌡️ <span id="current-temp">-</span></div><div class="condition-label">Temperature</div></div>
      <div class="condition-item"><div class="condition-value">👋 <span id="current-feels">-</span></div><div class="condition-label">Feels Like</div></div>
      <div class="condition-item"><div class="condition-value">💧 <span id="current-humidity">-</span></div><div class="condition-label">Humidity</div></div>
      <div class="condition-item"><div class="condition-value">🌧️ <span id="current-precipitation">-</span></div><div class="condition-label">Precipitation</div></div>
      <div class="condition-item"><div class="condition-value">🌬️ <span id="current-wind">-</span></div><div class="condition-label">Wind Speed</div></div>
      <div class="condition-item"><div class="condition-value">🧭 <span id="current-wind-dir">-</span></div><div class="condition-label">Wind Direction</div></div>
    </div>
    <div class="condition">
      <div class="condition-item"><div class="condition-value">🌅 <span id="current-sunrise">-</span></div><div class="condition-label">Sunrise</div></div>
      <div class="condition-item"><div class="condition-value">🌇 <span id="current-sunset">-</span></div><div class="condition-label">Sunset</div></div>
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
    <div class="widget">
      <h3>🌫️ Air Quality</h3>
      <div id="aqi-data">Loading...</div>
    </div>
  </div>
</div>

<!-- Modals -->
<div class="modal" id="hourly-modal"><div class="modal-content"><div class="modal-header"><h2>🕒 24-Hour Forecast</h2><button class="close-btn" onclick="closeModal('hourly')">×</button></div><div class="modal-body" id="hourly-details"></div></div></div>
<div class="modal" id="daily-modal"><div class="modal-content"><div class="modal-header"><h2>📆 7-Day Forecast</h2><button class="close-btn" onclick="closeModal('daily')">×</button></div><div class="modal-body" id="daily-details"></div></div></div>

<script>
  // Search & Suggestions
  const searchInput = document.getElementById('city-search');
  const suggestions = document.getElementById('city-suggestions');
  searchInput.addEventListener('focus', () => showSuggestions());
  searchInput.addEventListener('input', () => fetchCitySuggestions());
  document.addEventListener('click', e => {
    if (!searchInput.contains(e.target) && !suggestions.contains(e.target)) {
      suggestions.style.display = 'none';
    }
  });

  async function showSuggestions() {
    suggestions.innerHTML = '<div data-action="loc">📍 Use My Location</div>';
    suggestions.style.display = 'block';
  }

  async function fetchCitySuggestions() {
    const q = searchInput.value.trim();
    showSuggestions();
    if (!q) return;
    try {
      const res = await fetch(\`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=\${encodeURIComponent(q)}\`);
      const list = await res.json();
      suggestions.innerHTML = '<div data-action="loc">📍 Use My Location</div>' + list.map(item =>
        \`<div data-lat="\${item.lat}" data-lon="\${item.lon}">\${item.display_name}</div>\`
      ).join('');
    } catch {
      // ignore errors
    }
  }

  suggestions.addEventListener('click', e => {
    const el = e.target;
    if (el.dataset.action === 'loc') {
      manualCoords = null;
      useGeo = true;
    } else if (el.dataset.lat && el.dataset.lon) {
      manualCoords = { latitude: parseFloat(el.dataset.lat), longitude: parseFloat(el.dataset.lon) };
      useGeo = false;
    }
    suggestions.style.display = 'none';
    searchInput.value = '';
    refreshAll();
  });

  // Refresh both weather & AQI
  function refreshAll() {
    loadWeather(true);
  }

  // Geolocation helper
  function getLocation() {
    return new Promise((res, rej) => {
      navigator.geolocation.getCurrentPosition(p => res(p.coords), e => rej(e), { timeout: 5000 });
    });
  }

  // Main loadWeather
  async function loadWeather(noCache) {
    const start = performance.now();
    document.getElementById("error-display").textContent = "";
    let coords;
    if (!manualCoords && useGeo) {
      try { coords = await getLocation(); }
      catch { coords = fallbackCoords; }
    } else {
      coords = manualCoords || fallbackCoords;
    }
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const clientFetchStart = performance.now();
    try {
      // WEATHER
      let wurl = \`/api/weather?lat=\${coords.latitude}&lon=\${coords.longitude}&tz=\${tz}&provider=metno&units=metric\`;
      if (noCache) wurl += '&noCache=true';
      const wres = await fetch(wurl);
      if (!wres.ok) throw new Error('HTTP ' + wres.status);
      const wjson = await wres.json();
      const fetchTime = Math.round(performance.now() - clientFetchStart);
      document.getElementById("fetched-time-meta").textContent = \`⏱ Fetched in: \${fetchTime}ms\`;
      document.getElementById("processing-time-meta").textContent = \`⏳ Processing Time: \${wjson.meta.processedMs}ms\`;
      document.getElementById("current-time-meta").textContent = \`🕒 Time: \${new Date().toLocaleTimeString("en-US",{timeZone:tz,hour12:false})}\`;
      document.getElementById("current-timezone-meta").textContent = \`🌐 Timezone: \${tz}\`;
      updateWeatherUI(wjson);

      // CITY/COUNTRY
      const c2l = await fetch(\`/api/c2l?lat=\${coords.latitude}&lon=\${coords.longitude}\`);
      const loc = await c2l.json();
      document.getElementById("current-city").textContent = loc.city;
      document.getElementById("current-country").textContent = loc.country;

      // AQI
      loadAQI(coords.latitude, coords.longitude);

    } catch (err) {
      document.getElementById("error-display").textContent = "Error: "+err.message;
      document.getElementById("processing-time-meta").textContent = "⏳ Processing Time: 0ms";
      document.getElementById("fetched-time-meta").textContent = "⏱ Fetched in: --ms";
      document.getElementById("current-time-meta").textContent = "🕒 Time: " + new Date().toLocaleTimeString();
      document.getElementById("current-timezone-meta").textContent = "🌐 Timezone: " + tz;
    }
  }

  function updateWeatherUI(data) {
    const c = data.current;
    document.getElementById("current-temp").textContent = c.temp;
    document.getElementById("current-feels").textContent = c.feelsLike;
    document.getElementById("current-humidity").textContent = c.humidity;
    document.getElementById("current-precipitation").textContent = c.precipitation;
    document.getElementById("current-wind").textContent = c.windSpeed;
    document.getElementById("current-wind-dir").textContent = c.windDirection;
    document.getElementById("current-sunrise").textContent = c.sunrise;
    document.getElementById("current-sunset").textContent = c.sunset;
    document.getElementById("hourly-preview").innerHTML = data.hourly.slice(0,3).map(h=>
      \`<div class="forecast-item"><div>\${h.time}</div><div>🌡️ \${h.temp}</div><div>💧 \${h.precipitation}</div><div>🧭 \${h.windDirection}</div></div>\`
    ).join('');
    document.getElementById("daily-preview").innerHTML = data.daily.slice(0,3).map(d=>
      \`<div class="forecast-item"><div>\${d.date}</div><div>🌡️ \${d.tempMax}</div><div>🌡️ \${d.tempMin}</div><div>🌧️ \${d.precipitationChance}</div></div>\`
    ).join('');
  }

  async function loadAQI(lat, lon) {
    try {
      const token = 'YOUR_WAQI_TOKEN_HERE';
      const res = await fetch(\`https://api.waqi.info/feed/geo:\${lat};\${lon}/?token=\${token}\`);
      const j = await res.json();
      if (j.status !== "ok") throw new Error("AQI fetch failed");
      document.getElementById('aqi-data').innerHTML = \`AQI: <strong>\${j.data.aqi}</strong><br>Pollutant: <strong>\${j.data.dominentpol||'n/a'}</strong>\`;
    } catch {
      document.getElementById('aqi-data').textContent = "Air quality data unavailable.";
    }
  }

  // Forecast modals
  function showHourlyForecast() {
    document.getElementById("hourly-details").innerHTML = Array.from(document.querySelectorAll('#hourly-preview .forecast-item')).map(x=>x.outerHTML).join('');
  }
  function showDailyForecast() {
    document.getElementById("daily-details").innerHTML = Array.from(document.querySelectorAll('#daily-preview .forecast-item')).map(x=>x.outerHTML).join('');
  }
  function openModal(t) {
    if (t==='hourly') { showHourlyForecast(); document.getElementById('hourly-modal').style.display='flex'; }
    else { showDailyForecast(); document.getElementById('daily-modal').style.display='flex'; }
  }
  function closeModal(t) {
    document.getElementById(t==='hourly'?'hourly-modal':'daily-modal').style.display='none';
  }
  document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; }));

  // Initial load
  loadWeather(false);
</script>
</body>
</html>`;

export default {
  async fetch(request, env, context) {
    const startTime = Date.now();
    const url = new URL(request.url);
    const colo = (request.cf && request.cf.colo) ? request.cf.colo : "unknown";
    const fallbackLat = (request.cf && request.cf.latitude) ? request.cf.latitude : 0;
    const fallbackLon = (request.cf && request.cf.longitude) ? request.cf.longitude : 0;
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
      const colo = (request.cf && request.cf.colo) ? request.cf.colo : "unknown";
      const useBucketing = false;
      const latRaw = parseFloat(url.searchParams.get("lat")) || 0;
      const lonRaw = parseFloat(url.searchParams.get("lon")) || 0;
      const tz = url.searchParams.get("tz") || Intl.DateTimeFormat().resolvedOptions().timeZone;
      const provider = url.searchParams.get("provider") || "metno";
      const units = url.searchParams.get("units") || "metric";
      const bucketPrecision = 0.0045;
      const lat = useBucketing ? Math.round(latRaw / bucketPrecision) * bucketPrecision : latRaw;
      const lon = useBucketing ? Math.round(lonRaw / bucketPrecision) * bucketPrecision : lonRaw;

      const cacheKey = "weather-" + lat.toFixed(6) + "-" + lon.toFixed(6) + "-" + tz + "-" + provider + "-" + units;

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
          const today = new Date().toISOString().split("T")[0];
          const sunriseUrl = new URL("https://api.met.no/weatherapi/sunrise/2.0/");
          sunriseUrl.searchParams.set("lat", latRaw);
          sunriseUrl.searchParams.set("lon", lonRaw);
          sunriseUrl.searchParams.set("date", today);
          sunriseUrl.searchParams.set("formatted", "true");
          const sunriseRes = await fetch(sunriseUrl.toString(), {
            headers: { "User-Agent": "yorgisbot" }
          });
          if (sunriseRes.ok) {
            const sunriseData = await sunriseRes.json();
            if (sunriseData.location && sunriseData.location.time && sunriseData.location.time.length > 0) {
              const currentSun = sunriseData.location.time[0];
              weatherPayload.current.sunrise = currentSun.sunrise;
              weatherPayload.current.sunset = currentSun.sunset;
            }
          }
          const startStr = today;
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + 6);
          const endStr = endDate.toISOString().split("T")[0];
          const sunriseUrlDaily = new URL("https://api.met.no/weatherapi/sunrise/2.0/");
          sunriseUrlDaily.searchParams.set("lat", latRaw);
          sunriseUrlDaily.searchParams.set("lon", lonRaw);
          sunriseUrlDaily.searchParams.set("date", startStr + "/" + endStr);
          sunriseUrlDaily.searchParams.set("formatted", "true");
          const sunriseDailyRes = await fetch(sunriseUrlDaily.toString(), {
            headers: { "User-Agent": "yorgisbot" }
          });
          if (sunriseDailyRes.ok) {
            const sunriseDailyData = await sunriseDailyRes.json();
            if (sunriseDailyData.location && sunriseDailyData.location.time) {
              const sunTimes = sunriseDailyData.location.time;
              weatherPayload.daily = weatherPayload.daily.map((day, index) => {
                if (index < sunTimes.length) {
                  return { ...day, sunrise: sunTimes[index].sunrise, sunset: sunTimes[index].sunset };
                }
                return day;
              });
            }
          }
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

    if (url.pathname === "/api/ai-summary") {
      const lat = url.searchParams.get("lat");
      const lon = url.searchParams.get("lon");
      const tz = url.searchParams.get("tz") || Intl.DateTimeFormat().resolvedOptions().timeZone;
      const provider = url.searchParams.get("provider") || "metno";
      const units = url.searchParams.get("units") || "metric";

      if (!lat || !lon) {
        const meta = { processedMs: Date.now() - startTime, colo: colo };
        return new Response(JSON.stringify({ error: "lat and lon required", meta }), {
          status: 400,
          headers: { ...commonHeaders, "Content-Type": "application/json" }
        });
      }
      const weatherApiUrl = new URL(request.url);
      weatherApiUrl.pathname = "/api/weather";
      weatherApiUrl.searchParams.set("lat", lat);
      weatherApiUrl.searchParams.set("lon", lon);
      weatherApiUrl.searchParams.set("tz", tz);
      weatherApiUrl.searchParams.set("provider", provider);
      weatherApiUrl.searchParams.set("units", units);
      weatherApiUrl.searchParams.set("noCache", "true");

      try {
        const weatherRes = await fetch(weatherApiUrl.toString(), { cf: request.cf });
        if (!weatherRes.ok) throw new Error("Weather API error: HTTP " + weatherRes.status);
        const weatherData = await weatherRes.json();

        const stream = new ReadableStream({
          async start(controller) {
            if (!weatherData || !weatherData.current) {
              controller.enqueue("No weather data available.");
              controller.close();
              return;
            }
            const tempMatch = weatherData.current.temp.match(/-?\\d+(\\.\\d+)?/);
            const temp = tempMatch ? parseFloat(tempMatch[0]) : null;
            const precipitation = weatherData.current.precipitation;

            let summary = "Currently, the weather is ";
            if (temp !== null) {
              summary += temp > 25 ? "warm" : (temp < 15 ? "cool" : "mild");
            } else {
              summary += "of moderate temperature";
            }
            controller.enqueue(summary);

            await new Promise((resolve) => setTimeout(resolve, 100));

            summary = ". ";
            summary += precipitation !== "N/A" ? "There is a chance of precipitation. " : "Precipitation data is not available. ";
            controller.enqueue(summary);

            await new Promise((resolve) => setTimeout(resolve, 100));

            summary = "Overall, expect a day that feels ";
            summary += (temp !== null ? (temp > 25 ? "energetic" : (temp < 15 ? "chilly" : "comfortable")) : "average") + ".";
            controller.enqueue(summary);

            controller.close();
          }
        });

        return new Response(stream, {
          headers: { ...commonHeaders, "Content-Type": "text/plain" }
        });
      } catch (error) {
        const meta = {
          colo: colo,
          timezone: tz,
          timestamp: new Date().toISOString(),
          processedMs: Date.now() - startTime
        };
        return new Response(JSON.stringify({ error: error.message, meta }), {
          status: 500,
          headers: { ...commonHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // Default: serve HTML
    return new Response(HTML(colo, fallbackLat, fallbackLon), {
      headers: { ...commonHeaders, "Content-Type": "text/html" }
    });
  }
};
