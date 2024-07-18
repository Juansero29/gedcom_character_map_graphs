const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.static('public'));

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
app.get('/ged/*', (req, res) => {
    const filePath = path.join(__dirname, 'public', req.params[0]);
    res.sendFile(filePath);
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
