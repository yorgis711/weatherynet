export default {
    async fetch(request, env) {
      const url = new URL(request.url);
      const colo = request.cf.colo;
  
      if (url.pathname === '/api/weather') {
        return handleWeatherRequest(request, env, colo);
      }
  
      return new Response(HTML(colo), {
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache',
          'X-Cloudflare-Colo': colo
        }
      });
    }
  };
  
  async function handleWeatherRequest(request, env, colo) {
    const url = new URL(request.url);
    const params = {
      lat: Math.max(-90, Math.min(90, parseFloat(url.searchParams.get('lat')) || 0)),
      lon: Math.max(-180, Math.min(180, parseFloat(url.searchParams.get('lon')) || 0)),
      tz: url.searchParams.get('tz') || 'Etc/GMT'
    };
  
    const kvKey = `weather:${params.lat}:${params.lon}:${params.tz}`;
    
    try {
      let data;
      const cached = await env.WEATHER_CACHE.get(kvKey, 'json');
      
      if (cached) {
        data = { 
          ...cached, 
          meta: { 
            ...cached.meta, 
            cf_colo: colo,
            cached: true 
          }
        };
        return jsonResponse(data, true);
      }
  
      const apiUrl = buildWeatherApiUrl(params);
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      
      const rawData = await response.json();
      data = processWeatherData(rawData, params.tz, colo);
      
      await env.WEATHER_CACHE.put(kvKey, JSON.stringify(data), {
        expirationTtl: 300
      });
  
      return jsonResponse(data, false);
  
    } catch (error) {
      const staleData = await env.WEATHER_CACHE.get(kvKey, 'json');
      if (staleData) {
        staleData.meta = {
          ...staleData.meta,
          cf_colo: colo,
          warning: "Serving cached data",
          cached: true
        };
        return jsonResponse(staleData, true);
      }
      
      return jsonResponse({
        error: "Service unavailable",
        details: error.message,
        meta: { cf_colo: colo }
      }, false, 503);
    }
  }
  
  function buildWeatherApiUrl({ lat, lon, tz }) {
    return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=${encodeURIComponent(tz)}` +
      '&hourly=temperature_2m,precipitation_probability,precipitation,visibility,wind_speed_10m,wind_direction_10m' +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,rain,visibility,wind_speed_10m,wind_direction_10m,is_day' +
      '&daily=sunrise,sunset,precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min' +
      '&forecast_days=7';
  }
  
  function processWeatherData(data, tz, colo) {
    const formatTime = (isoString, timeZone) => {
      try {
        return new Date(isoString).toLocaleTimeString('en-US', {
          timeZone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
      } catch {
        return '--:--';
      }
    };
  
    return {
      meta: {
        cf_colo: colo,
        processing_ms: Date.now() - performance.timeOrigin,
        current_time: new Date().toLocaleString('en-US', {
          timeZone: tz,
          hour12: false,
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        timezone: tz,
        coordinates: {
          lat: data.latitude,
          lon: data.longitude
        },
        cached: false
      },
      current: {
        temperature: `${data.current.temperature_2m}°C`,
        feels_like: `${data.current.apparent_temperature}°C`,
        humidity: `${data.current.relative_humidity_2m}%`,
        precipitation: `${data.current.precipitation} mm`,
        visibility: `${(data.current.visibility / 1000).toFixed(1)} km`,
        wind: {
          speed: `${data.current.wind_speed_10m} km/h`,
          direction: data.current.wind_direction_10m
        },
        sunrise: formatTime(data.daily.sunrise[0], tz),
        sunset: formatTime(data.daily.sunset[0], tz)
      },
      daily: data.daily.time.map((time, i) => ({
        date: new Date(time).toLocaleDateString('en-US', {
          timeZone: tz,
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        }),
        temp_max: `${data.daily.temperature_2m_max[i]}°C`,
        temp_min: `${data.daily.temperature_2m_min[i]}°C`,
        precipitation: `${data.daily.precipitation_sum[i]} mm`,
        precipitation_chance: `${data.daily.precipitation_probability_max[i]}%`,
        sunrise: formatTime(data.daily.sunrise[i], tz),
        sunset: formatTime(data.daily.sunset[i], tz)
      })),
      hourly: data.hourly.time.map((time, i) => ({
        time: new Date(time).toLocaleTimeString([], {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }),
        temperature: `${data.hourly.temperature_2m[i]}°C`,
        precipitation: `${data.hourly.precipitation[i]} mm`,
        precipitation_chance: `${data.hourly.precipitation_probability[i]}%`,
        visibility: `${(data.hourly.visibility[i] / 1000).toFixed(1)} km`,
        wind: {
          speed: `${data.hourly.wind_speed_10m[i]} km/h`,
          direction: data.hourly.wind_direction_10m[i]
        }
      }))
    };
  }
  
  function jsonResponse(data, cached, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': cached ? 'HIT' : 'MISS',
        'X-Cloudflare-Colo': data.meta?.cf_colo || 'UNKNOWN',
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  }
  
  const HTML = (colo) => `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Weather Dashboard</title>
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Round" rel="stylesheet">
    <style>
      /* Full CSS Styles */
      * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', sans-serif; }
      body { background: #f0f4f8; color: #2d3436; min-height: 100vh; padding: 2rem; position: relative; }
      .container { max-width: 1200px; margin: 0 auto; }
      .header { text-align: center; margin-bottom: 2rem; }
      .meta-info { text-align: center; margin: 1rem 0; color: #666; font-size: 0.9rem; line-height: 1.4; }
      .cf-badge { position: fixed; bottom: 1rem; right: 1rem; background: rgba(0,0,0,0.8); color: white; padding: 0.5rem 1rem; border-radius: 8px; display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; }
      .current-weather { background: white; padding: 2rem; border-radius: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom: 2rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
      .widgets-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
      .widget { background: white; padding: 1.5rem; border-radius: 15px; cursor: pointer; transition: transform 0.2s; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
      .widget:hover { transform: translateY(-3px); }
      .widget-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; }
      .hourly-preview, .daily-preview { display: flex; gap: 1rem; overflow-x: auto; padding-bottom: 0.5rem; }
      .hourly-preview .hour-item, .daily-preview .day-item { flex: 0 0 auto; padding: 0.8rem; background: #f8f9fa; border-radius: 10px; text-align: center; min-width: 100px; }
      .temp-line { display: flex; justify-content: center; gap: 0.5rem; align-items: baseline; margin: 0.3rem 0; }
      .temp-line .temp { font-size: 1.2rem; white-space: nowrap; }
      .material-icons-round { vertical-align: middle; }
      @media (max-width: 600px) { .hourly-preview, .daily-preview { gap: 0.8rem; } .hourly-preview .hour-item, .daily-preview .day-item { min-width: 85px; padding: 0.6rem; } }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1><span class="material-icons-round">cloud</span> Weather Dashboard</h1>
        <div class="meta-info" id="meta"></div>
      </div>
  
      <div class="current-weather" id="current-weather"></div>
  
      <div class="widgets-container">
        <div class="widget" onclick="showModal('hourly')">
          <div class="widget-header">
            <span class="material-icons-round">schedule</span>
            <h3>Hourly Forecast</h3>
          </div>
          <div class="hourly-preview" id="hourly-preview"></div>
        </div>
  
        <div class="widget" onclick="showModal('daily')">
          <div class="widget-header">
            <span class="material-icons-round">calendar_today</span>
            <h3>7-Day Forecast</h3>
          </div>
          <div class="daily-preview" id="daily-preview"></div>
        </div>
      </div>
  
      <div class="cf-badge">
        <span class="material-icons-round">dns</span>
        <span>Cloudflare PoP: </span>
        <span id="cf-colo">${colo}</span>
      </div>
    </div>
  
    <script>
      // Full Client-Side JavaScript
      let weatherData = null;
  
      async function getLocation() {
        return new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            position => resolve(position.coords),
            error => reject(error),
            { timeout: 5000 }
          );
        });
      }
  
      async function loadWeather() {
        try {
          let coords = { latitude: 0, longitude: 0 };
          let tz = 'Etc/GMT';
          
          try {
            coords = await getLocation();
            tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          } catch (error) {
            console.log('Using default coordinates');
          }
  
          const apiUrl = \`/api/weather?lat=\${coords.latitude}&lon=\${coords.longitude}&tz=\${encodeURIComponent(tz)}\`;
          const response = await fetch(apiUrl);
          weatherData = await response.json();
          
          updateMetaInfo(weatherData.meta);
          updateCurrentWeather();
          updatePreviewWidgets();
          
        } catch (error) {
          alert('Error loading weather data: ' + error.message);
        }
      }
  
      function updateMetaInfo(meta) {
        const metaEl = document.getElementById('meta');
        metaEl.innerHTML = \`
          <div>Local Time: \${meta.current_time}</div>
          <div>Coordinates: \${meta.coordinates.lat.toFixed(2)}, \${meta.coordinates.lon.toFixed(2)}</div>
          <div>Data Center: \${meta.cf_colo} \${meta.cached ? '(cached)' : ''}</div>
          <div>Processed in \${meta.processing_ms}ms</div>
        \`;
        document.getElementById('cf-colo').textContent = meta.cf_colo + (meta.cached ? ' (cached)' : '');
      }
  
      function updateCurrentWeather() {
        const container = document.getElementById('current-weather');
        const current = weatherData.current;
        
        container.innerHTML = \`
          <div class="current-item">
            <div class="temp">\${current.temperature}</div>
            <div>Feels like \${current.feels_like}</div>
          </div>
          <div class="current-item">
            <div><span class="material-icons-round">air</span> \${current.wind.speed}</div>
            <div class="wind-direction" style="transform: rotate(\${current.wind.direction}deg)">⬇️</div>
          </div>
          <div class="current-item">
            <div class="sun-info">
              <div><span class="material-icons-round">wb_sunny</span> \${current.sunrise}</div>
              <div><span class="material-icons-round">nights_stay</span> \${current.sunset}</div>
            </div>
            <div><span class="material-icons-round">water_drop</span> \${current.humidity}</div>
            <div><span class="material-icons-round">visibility</span> \${current.visibility}</div>
          </div>
        \`;
      }
  
      function updatePreviewWidgets() {
        const hourlyPreview = weatherData.hourly.slice(0, 3);
        document.getElementById('hourly-preview').innerHTML = hourlyPreview.map(hour => \`
          <div class="hour-item">
            <div>\${hour.time}</div>
            <div class="temp-line">
              <span class="temp">\${hour.temperature}</span>
              <span>\${hour.precipitation_chance}%</span>
            </div>
          </div>
        \`).join('');
  
        const dailyPreview = weatherData.daily.slice(0, 3);
        document.getElementById('daily-preview').innerHTML = dailyPreview.map(day => \`
          <div class="day-item">
            <div>\${day.date.split(',')[0]}</div>
            <div class="temp-line">
              <span class="temp">\${day.temp_max}</span>
              <span>/</span>
              <span class="temp">\${day.temp_min}</span>
            </div>
            <div>\${day.precipitation_chance}%</div>
          </div>
        \`).join('');
      }
  
      // Modal and other functions remain the same as previous version
      window.onload = loadWeather;
    </script>
  </body>
  </html>`;