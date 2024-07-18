const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.static('public'));

// Endpoint to list .ged files in the /ged directory
app.get('/ged', (req, res) => {
    const gedDir = path.join(__dirname, 'public', 'ged');
    fs.readdir(gedDir, (err, files) => {
        if (err) {
            return res.status(500).send('Unable to scan directory');
        }
        const gedFiles = files.filter(file => file.endsWith('.ged'));
        res.json(gedFiles);
    });
});

// Endpoint to serve individual .ged files
app.get('/ged/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'public', 'ged', filename);
    res.sendFile(filePath);
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
