const express = require('express');
const app = express();




app.get('/api', (req, res) => {

    const request = require('request');
    request('https://api.open-meteo.com/v1/forecast?latitude=37.98&longitude=23.73&hourly=temperature_2m', function(error, response, body) {
        if (!error && response.statusCode == 200) {
            res.send(body)
        } else {
            res.send({ message: "There was an error during your request" })
        }

    })

});

app.listen(8080, () => console.log('app alive and listening on http://localhost:8080'))

