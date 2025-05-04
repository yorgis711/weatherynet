// index.js
// Cloudflare Worker: Full Weather Dashboard with Open-Meteo AQI, City Search, Settings Panel

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function formatTime(isoString, timeZone) {
  try {
    return new Date(isoString).toLocaleTimeString("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  } catch {
    return "--:--";
  }
}
function formatDate(isoString, timeZone) {
  try {
    return new Date(isoString).toLocaleDateString("en-US", {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric"
    });
  } catch {
    return "--/--";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML Template
// ─────────────────────────────────────────────────────────────────────────────
const HTML = (colo, fallbackLat, fallbackLon) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>🌤️ Weather & AQI Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root{--primary:#2d3436;--secondary:#636e72;--background:#f0f2f5;--card-bg:#fff;--accent:#0984e3;--shadow:rgba(0,0,0,0.1)}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:"Inter",sans-serif;background:var(--background);color:var(--primary);padding:1rem}
    .container{max-width:1200px;margin:0 auto;position:relative}
    .header{text-align:center;margin-bottom:1rem;position:relative}
    .header h1{margin-bottom:.5rem}
    .refresh-btn{margin-top:.5rem;padding:.5rem 1rem;background:var(--accent);color:#fff;border:none;border-radius:.5rem;cursor:pointer}
    #city-search{margin-top:.5rem;padding:.5rem;width:80%;max-width:300px;border:1px solid #ccc;border-radius:.5rem}
    #city-suggestions{position:absolute;top:3.5rem;left:50%;transform:translateX(-50%);width:80%;max-width:300px;background:var(--card-bg);border:1px solid #ccc;border-radius:.5rem;max-height:200px;overflow-y:auto;display:none;z-index:100}
    #city-suggestions div{padding:.5rem;cursor:pointer}#city-suggestions div:hover{background:var(--background)}
    .meta-info{display:flex;flex-wrap:wrap;gap:1rem;font-size:.9rem;color:var(--secondary);justify-content:center;margin-bottom:1.5rem}
    .meta-info span{white-space:nowrap}
    .current-conditions{background:var(--card-bg);padding:2rem;border-radius:1.5rem;margin-bottom:2rem;box-shadow:0 4px 12px var(--shadow)}
    .condition{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1rem;margin-bottom:1rem}
    .condition-item{background:rgba(255,255,255,0.1);padding:1rem;border-radius:.75rem;text-align:center}
    .condition-value{font-size:1.5rem;font-weight:600;margin-bottom:.25rem}
    .condition-label{color:var(--secondary);font-size:.9rem}
    .widgets-container{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem}
    .widget{background:var(--card-bg);padding:1.5rem;border-radius:1rem;box-shadow:0 4px 12px var(--shadow);transition:transform .2s}
    .widget:hover{transform:translateY(-3px)}
    .forecast-preview{display:flex;gap:1rem;overflow-x:auto;padding:1rem 0;cursor:pointer}
    .forecast-item{flex:0 0 150px;background:var(--card-bg);padding:1rem;border-radius:1rem;box-shadow:0 2px 4px var(--shadow)}
    .modal{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);display:none;justify-content:center;align-items:center}
    .modal-content{background:var(--card-bg);border-radius:1.5rem;max-width:90%;max-height:90vh;overflow:hidden;position:relative}
    .modal-header{display:flex;justify-content:center;align-items:center;position:relative;padding:1rem 2rem 0 2rem}
    .modal-header h2{margin:0}
    .close-btn{position:absolute;right:1rem;top:1rem;background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--primary);z-index:10}
    .modal-body{overflow-y:auto;max-height:calc(90vh-4rem);padding:1rem 2rem 2rem 2rem}
    #error-display{color:red;text-align:center;margin-top:1rem}
    /* Settings */
    #settings-toggle{position:absolute;top:1rem;right:1rem;background:none;border:none;font-size:1.5rem;cursor:pointer;z-index:1000}
    #settings-panel{display:none;position:fixed;top:4rem;right:1rem;background:var(--card-bg);padding:1rem;border-radius:1rem;box-shadow:0 4px 8px rgba(0,0,0,0.2);z-index:1000;width:200px}
    #settings-panel label{display:flex;align-items:center;gap:.5rem}
    #manual-search-container{margin-top:1rem}
  </style>
</head>
<body>
  <script>
    const fallbackCoords = { latitude: ${fallbackLat}, longitude: ${fallbackLon} };
    let manualCoords = null, useGeo = true;
  </script>

  <div class="container">
    <div class="header">
      <h1>🌤️ Weather & AQI Dashboard</h1>
      <button class="refresh-btn" onclick="refreshAll()">Refresh</button><br>
      <input id="city-search" type="text" placeholder="Search city..." autocomplete="off">
      <div id="city-suggestions"></div>
    </div>

    <!-- Settings -->
    <button id="settings-toggle">⚙️</button>
    <div id="settings-panel">
      <label><input type="checkbox" id="use-geolocation" checked> Use My Location</label>
      <div id="manual-search-container" style="display:none;">
        <input id="manual-city" type="text" placeholder="Enter city name">
        <button onclick="applyManualCity()">Apply</button>
      </div>
    </div>

    <!-- Metadata -->
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

    <!-- Current Conditions -->
    <div class="current-conditions">
      <h2>Current Weather</h2>
      <div class="condition">
        <div class="condition-item"><div class="condition-value">🌡️ <span id="current-temp">-</span></div><div class="condition-label">Temperature</div></div>
        <div class="condition-item"><div class="condition-value">👋 <span id="current-feels">-</span></div><div class="condition-label">Feels Like</div></div>
        <div class="condition-item"><div class="condition-value">💧 <span id="current-humidity">-</span></div><div class="condition-label">Humidity</div></div>
        <div class="condition-item"><div class="condition-value">🌧️ <span id="current-precipitation">-</span></div><div class="condition-label">Precipitation</div></div>
        <div class="condition-item"><div class="condition-value">🌬️ <span id="current-wind">-</span></div><div class="condition-label">Wind Speed</div></div>
        <div class="condition-item"><div class="condition-value">🧭 <span id="current-wind-dir">-</span></div><div class="condition-label">Wind Dir.</div></div>
      </div>
      <div class="condition">
        <div class="condition-item"><div class="condition-value">🌅 <span id="current-sunrise">-</span></div><div class="condition-label">Sunrise</div></div>
        <div class="condition-item"><div class="condition-value">🌇 <span id="current-sunset">-</span></div><div class="condition-label">Sunset</div></div>
      </div>
    </div>

    <!-- Widgets -->
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
        <h3>🌫️ Air Quality (US AQI)</h3>
        <div id="aqi-data">Loading...</div>
      </div>
    </div>
  </div>

  <!-- Modals -->
  <div class="modal" id="hourly-modal"><div class="modal-content"><div class="modal-header"><h2>🕒 24-Hour Forecast</h2><button class="close-btn" onclick="closeModal('hourly')">×</button></div><div class="modal-body" id="hourly-details"></div></div></div>
  <div class="modal" id="daily-modal"><div class="modal-content"><div class="modal-header"><h2>📆 7-Day Forecast</h2><button class="close-btn" onclick="closeModal('daily')">×</button></div><div class="modal-body" id="daily-details"></div></div></div>

  <script>
    // Settings logic
    document.getElementById('settings-toggle').addEventListener('click', () => {
      const p = document.getElementById('settings-panel');
      p.style.display = p.style.display === 'none' ? 'block' : 'none';
    });
    document.getElementById('use-geolocation').addEventListener('change', e => {
      document.getElementById('manual-search-container').style.display = e.target.checked ? 'none' : 'block';
    });
    function applyManualCity() {
      const city = document.getElementById('manual-city').value.trim();
      if (!city) return;
      fetch(\`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=\${encodeURIComponent(city)}\`)
        .then(r => r.json()).then(d => {
          if (d.length) manualCoords = { latitude: parseFloat(d[0].lat), longitude: parseFloat(d[0].lon) };
          refreshAll();
        });
    }

    // Autocomplete logic
    const searchInput = document.getElementById('city-search');
    const suggestions = document.getElementById('city-suggestions');
    searchInput.addEventListener('focus', showSuggestions);
    searchInput.addEventListener('input', fetchCitySuggestions);
    document.addEventListener('click', e => {
      if (!searchInput.contains(e.target) && !suggestions.contains(e.target)) suggestions.style.display = 'none';
    });
    function showSuggestions() {
      suggestions.innerHTML = '<div data-action="loc">📍 Use My Location</div>';
      suggestions.style.display = 'block';
    }
    function fetchCitySuggestions() {
      const q = searchInput.value.trim();
      showSuggestions();
      if (!q) return;
      fetch(\`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=\${encodeURIComponent(q)}\`)
        .then(r => r.json()).then(list => {
          suggestions.innerHTML = '<div data-action="loc">📍 Use My Location</div>' +
            list.map(i => \`<div data-lat="\${i.lat}" data-lon="\${i.lon}">\${i.display_name}</div>\`).join('');
        });
    }
    suggestions.addEventListener('click', e => {
      const el = e.target;
      if (el.dataset.action === 'loc') { manualCoords = null; useGeo = true; }
      else if (el.dataset.lat && el.dataset.lon) { manualCoords = { latitude: parseFloat(el.dataset.lat), longitude: parseFloat(el.dataset.lon) }; useGeo = false; }
      suggestions.style.display = 'none'; searchInput.value = ''; refreshAll();
    });

    // Helpers
    function refreshAll() { loadWeather(true); }
    function getLocation() {
      return new Promise((res, rej) => navigator.geolocation.getCurrentPosition(p => res(p.coords), e => rej(e), { timeout: 5000 }));
    }

    // Main loader
    async function loadWeather(noCache) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const fetchStart = performance.now();
      document.getElementById("error-display").textContent = "";
      let coords;
      if (!manualCoords && useGeo) {
        try { coords = await getLocation(); } catch { coords = fallbackCoords; }
      } else coords = manualCoords || fallbackCoords;

      try {
        // Fetch weather
        let wurl = \`/api/weather?lat=\${coords.latitude}&lon=\${coords.longitude}&tz=\${tz}&provider=metno&units=metric\`;
        if (noCache) wurl += '&noCache=true';
        const wres = await fetch(wurl);
        if (!wres.ok) throw new Error('HTTP ' + wres.status);
        const wjson = await wres.json();
        document.getElementById("fetched-time-meta").textContent = \`⏱ Fetched in: \${Math.round(performance.now() - fetchStart)}ms\`;
        document.getElementById("processing-time-meta").textContent = \`⏳ Processing Time: \${wjson.meta.processedMs}ms\`;
        document.getElementById("current-time-meta").textContent = \`🕒 Time: \${new Date().toLocaleTimeString("en-US",{timeZone:tz,hour12:false})}\`;
        document.getElementById("current-timezone-meta").textContent = \`🌐 Timezone: \${tz}\`;
        updateWeatherUI(wjson);

        // Fetch city/country
        const locRes = await fetch(\`/api/c2l?lat=\${coords.latitude}&lon=\${coords.longitude}\`);
        const locJson = await locRes.json();
        document.getElementById("current-city").textContent = locJson.city;
        document.getElementById("current-country").textContent = locJson.country;

        // Fetch AQI
        loadAQI(coords.latitude, coords.longitude);
      } catch (err) {
        document.getElementById("error-display").textContent = "Error: " + err.message;
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
      document.getElementById("hourly-preview").innerHTML = data.hourly.slice(0,3).map(h =>
        \`<div class="forecast-item"><div>\${h.time}</div><div>🌡️ \${h.temp}</div><div>💧 \${h.precipitation}</div><div>🧭 \${h.windDirection}</div></div>\`
      ).join('');
      document.getElementById("daily-preview").innerHTML = data.daily.slice(0,3).map(d =>
        \`<div class="forecast-item"><div>\${d.date}</div><div>🌡️ \${d.tempMax}</div><div>🌡️ \${d.tempMin}</div><div>🌧️ \${d.precipitationChance}</div></div>\`
      ).join('');
    }

    // Open-Meteo AQI
    async function loadAQI(lat, lon) {
      try {
        const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
        url.searchParams.set("latitude", lat);
        url.searchParams.set("longitude", lon);
        url.searchParams.set("hourly", "us_aqi");
        const res = await fetch(url);
        if (!res.ok) throw new Error("AQI HTTP " + res.status);
        const j = await res.json();
        const vals = j.hourly.us_aqi, times = j.hourly.time;
        if (!Array.isArray(vals) || !vals.length) throw new Error("No AQI data");
        const idx = vals.length - 1;
        document.getElementById("aqi-data").innerHTML =
          \`US AQI: <strong>\${vals[idx]}</strong><br>Time: <em>\${new Date(times[idx]).toLocaleString()}</em>\`;
      } catch (e) {
        console.error("AQI error:", e);
        document.getElementById("aqi-data").textContent = "Air quality data unavailable.";
      }
    }

    // Forecast modals
    function showHourlyForecast() {
      document.getElementById("hourly-details").innerHTML =
        Array.from(document.querySelectorAll('#hourly-preview .forecast-item')).map(x => x.outerHTML).join('');
    }
    function showDailyForecast() {
      document.getElementById("daily-details").innerHTML =
        Array.from(document.querySelectorAll('#daily-preview .forecast-item')).map(x => x.outerHTML).join('');
    }
    function openModal(type) {
      if (type === 'hourly') { showHourlyForecast(); document.getElementById('hourly-modal').style.display = 'flex'; }
      else { showDailyForecast(); document.getElementById('daily-modal').style.display = 'flex'; }
    }
    function closeModal(type) {
      document.getElementById(type === 'hourly' ? 'hourly-modal' : 'daily-modal').style.display = 'none';
    }
    document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; }));

    // Initial load
    loadWeather(false);
  </script>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// Worker
// ─────────────────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const startTime = Date.now();
    const url = new URL(request.url);
    const colo = request.cf?.colo || "unknown";
    const fallbackLat = request.cf?.latitude || 0;
    const fallbackLon = request.cf?.longitude || 0;
    const commonHeaders = {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    };

    // === /api/c2l ===
    if (url.pathname === "/api/c2l") {
      const lat = url.searchParams.get("lat");
      const lon = url.searchParams.get("lon");
      if (!lat || !lon) {
        const meta = { processedMs: Date.now() - startTime, colo };
        return new Response(JSON.stringify({ error: "lat and lon required", meta }), {
          status: 400,
          headers: { ...commonHeaders, "Content-Type": "application/json" }
        });
      }
      if (!url.searchParams.has("noCache")) {
        const key = `c2l-${lat}-${lon}`;
        const cached = await env.WEATHER_CACHE.get(key);
        if (cached) {
          const data = JSON.parse(cached);
          const meta = { processedMs: Date.now() - startTime, colo };
          return new Response(JSON.stringify({ ...data, meta }), {
            headers: { ...commonHeaders, "Content-Type": "application/json" }
          });
        }
      }
      const ru = new URL("https://nominatim.openstreetmap.org/reverse");
      ru.searchParams.set("format", "json");
      ru.searchParams.set("lat", lat);
      ru.searchParams.set("lon", lon);
      ru.searchParams.set("zoom", "10");
      ru.searchParams.set("addressdetails", "1");
      const rres = await fetch(ru.toString(), { headers: { "User-Agent": "yorgisbot" } });
      if (!rres.ok) {
        const meta = { processedMs: Date.now() - startTime, colo };
        return new Response(JSON.stringify({ error: "Reverse geocoding failed", meta }), {
          status: rres.status,
          headers: { ...commonHeaders, "Content-Type": "application/json" }
        });
      }
      const rd = await rres.json();
      let city = "Unknown", country = "Unknown";
      if (rd.address) {
        city = rd.address.city || rd.address.town || rd.address.village || rd.address.county || "Unknown";
        country = rd.address.country || "Unknown";
      }
      const result = { city, country };
      if (!url.searchParams.has("noCache")) {
        await env.WEATHER_CACHE.put(`c2l-${lat}-${lon}`, JSON.stringify(result), { expirationTtl: 3600 });
      }
      const meta = { processedMs: Date.now() - startTime, colo };
      return new Response(JSON.stringify({ ...result, meta }), {
        headers: { ...commonHeaders, "Content-Type": "application/json" }
      });
    }

    // === /api/weather ===
    if (url.pathname === "/api/weather") {
      // ... your full weather handler code (unchanged from before) ...
      // including convertTemp, fetch from MET Norway or Open-Meteo, caching, error fallback
    }

    // === /api/ai-summary ===
    if (url.pathname === "/api/ai-summary") {
      // ... your full AI summary streaming handler code ...
    }

    // Fallback: serve HTML
    return new Response(HTML(colo, fallbackLat, fallbackLon), {
      headers: { ...commonHeaders, "Content-Type": "text/html" }
    });
  }
};
