const express = require('express');
const app = express();

// HTML content stored in a variable (note escaped backticks)
const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Weather Forecast</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            min-height: 100vh;
            padding: 2rem;
            color: #2d3436;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            padding: 2rem;
        }

        .header {
            text-align: center;
            margin-bottom: 2rem;
        }

        .header h1 {
            font-weight: 600;
            font-size: 2.5rem;
            color: #2d3436;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
        }

        .forecast-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
        }

        .day-card {
            background: white;
            border-radius: 15px;
            padding: 1.5rem;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
            transition: transform 0.2s ease;
        }

        .day-card:hover {
            transform: translateY(-5px);
        }

        .date-header {
            font-size: 1.1rem;
            font-weight: 500;
            margin-bottom: 1rem;
            color: #636e72;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .hourly-list {
            display: grid;
            gap: 1rem;
        }

        .hour-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.8rem;
            background: #f8f9fa;
            border-radius: 10px;
        }

        .time {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-weight: 500;
            color: #2d3436;
        }

        .temperature {
            font-weight: 600;
            color: #e17055;
            font-size: 1.1rem;
        }

        .material-icons {
            font-size: 1.2rem;
            vertical-align: middle;
        }

        .loading {
            text-align: center;
            padding: 2rem;
            font-size: 1.2rem;
            color: #636e72;
        }

        .error {
            color: #d63031;
            text-align: center;
            padding: 2rem;
            display: none;
        }

        @media (max-width: 768px) {
            body {
                padding: 1rem;
            }
            
            .container {
                padding: 1rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>
                <span class="material-icons">cloud</span>
                Weather Forecast
            </h1>
            <p style="margin-top: 0.5rem; color: #636e72;">
                Latitude: 38.0 | Longitude: 23.75
            </p>
        </div>
        <div id="loading" class="loading">
            <span class="material-icons spin">autorenew</span>
            <div style="margin-top: 0.5rem;">Loading weather data...</div>
        </div>
        <div id="forecast-container" class="forecast-grid"></div>
        <div id="error" class="error"></div>
    </div>

    <script>
        async function fetchWeatherData() {
            try {
                const response = await fetch('/api'); // Changed to local endpoint
                if (!response.ok) throw new Error(\`HTTP error! status: \${response.status}\`);
                return await response.json();
            } catch (error) {
                showError(\`Failed to load data: \${error.message}\`);
                return null;
            }
        }

        function formatTime(time24) {
            const [hours, minutes] = time24.split(':');
            const period = hours >= 12 ? 'PM' : 'AM';
            const hours12 = hours % 12 || 12;
            return \`\${hours12} \${period}\`;
        }

        function getTimeIcon(hour) {
            const hourNum = parseInt(hour.split(':')[0]);
            if (hourNum >= 6 && hourNum < 12) return 'wb_sunny';
            if (hourNum >= 12 && hourNum < 18) return 'brightness_5';
            if (hourNum >= 18 && hourNum < 22) return 'nights_stay';
            return 'dark_mode';
        }

        function createDayCard(date, hours) {
            const card = document.createElement('div');
            card.className = 'day-card';
            
            const dateOptions = { weekday: 'long', month: 'long', day: 'numeric' };
            const dateString = new Date(date).toLocaleDateString('en-US', dateOptions);
            
            card.innerHTML = \`
                <div class="date-header">
                    <span class="material-icons">calendar_today</span>
                    \${dateString}
                </div>
                <div class="hourly-list">
                    \${hours.map(hour => \`
                        <div class="hour-item">
                            <div class="time">
                                <span class="material-icons">\${getTimeIcon(hour.time)}</span>
                                \${formatTime(hour.time)}
                            </div>
                            <div class="temperature">
                                \${hour.temperature}°C
                            </div>
                        </div>
                    \`).join('')}
                </div>
            \`;
            
            return card;
        }

        function showError(message) {
            document.getElementById('loading').style.display = 'none';
            const errorDiv = document.getElementById('error');
            errorDiv.style.display = 'block';
            errorDiv.innerHTML = \`
                <span class="material-icons">error</span>
                <div style="margin-top: 0.5rem;">\${message}</div>
            \`;
        }

        async function init() {
            const data = await fetchWeatherData();
            if (!data) return;

            document.getElementById('loading').style.display = 'none';
            const container = document.getElementById('forecast-container');
            
            // Group hours by date
            const dates = {};
            data.hourly.time.forEach((timestamp, index) => {
                const date = timestamp.split('T')[0];
                if (!dates[date]) dates[date] = [];
                dates[date].push({
                    time: timestamp.split('T')[1].substring(0, 5),
                    temperature: data.hourly.temperature_2m[index]
                });
            });

            // Create cards for each date
            Object.entries(dates).forEach(([date, hours]) => {
                container.appendChild(createDayCard(date, hours));
            });
        }

        // Add spin animation
        const style = document.createElement('style');
        style.textContent = \`
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            .spin {
                animation: spin 1s linear infinite;
            }
        \`;
        document.head.appendChild(style);

        // Initialize
        window.onload = init;
    </script>
</body>
</html>
`;

// Serve HTML at root path
app.get('/', (req, res) => {
    res.set('Content-Type', 'text/html');
    res.send(htmlContent);
});

// Existing API endpoint
app.get('/api', (req, res) => {
    const request = require('request');
    request('https://api.open-meteo.com/v1/forecast?latitude=37.98&longitude=23.73&hourly=temperature_2m', function(error, response, body) {
        if (!error && response.statusCode == 200) {
            res.send(body);
        } else {
            res.send({ message: "There was an error during your request" });
        }
    });
});

app.listen(8080, () => console.log('Server running on http://localhost:8080'));