const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());

// Recursive function to get .ged files
function getGedFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            getGedFiles(filePath, fileList);
        } else if (file.endsWith('.ged')) {
            fileList.push(filePath.replace(path.join(__dirname, 'public'), ''));
        }
    });
    return fileList;
}

// Endpoint to list .ged files in the /ged directory
// Registered before static so /ged is not captured by public/ged/
app.get('/ged', (req, res) => {
    const gedDir = path.join(__dirname, 'public', 'ged');
    try {
        const gedFiles = getGedFiles(gedDir);
        res.json(gedFiles);
    } catch (err) {
        res.status(500).send('Unable to scan directory');
    }
});

// Endpoint to serve individual .ged files
// UI calls /ged${fileName} where fileName already starts with /ged/...
app.get('/ged/*', (req, res) => {
    const rel = req.params[0];
    const candidates = [
        path.join(__dirname, 'public', rel),
        path.join(__dirname, 'public', 'ged', rel),
    ];
    const filePath = candidates.find((p) => fs.existsSync(p));
    if (!filePath) {
        return res.status(404).send('File not found');
    }
    res.sendFile(filePath);
});

app.use(express.static('public'));

app.listen(PORT, "0.0.0.0", () => {
    const os = require("os");
    const nets = os.networkInterfaces();
    const lan = [];
    for (const list of Object.values(nets)) {
        for (const net of list || []) {
            if (net.family === "IPv4" && !net.internal) lan.push(net.address);
        }
    }
    console.log(`Server running on http://localhost:${PORT}`);
    lan.forEach((ip) => {
        console.log(`LAN (phone/other devices): http://${ip}:${PORT}`);
    });
});
