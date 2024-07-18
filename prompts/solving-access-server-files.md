The CORS (Cross-Origin Resource Sharing) issue you're encountering is because your browser is blocking the request to fetch files from your server due to security policies. To resolve this, you need to make sure your server is set up to allow cross-origin requests.

Below is a simple setup using Node.js with the Express framework to serve the `.ged` files and handle CORS:

### Node.js Server Setup (server.js):

First, install the required packages:
```sh
npm install express cors
```

Then, create a `server.js` file with the following content:

```javascript
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
```

### Directory Structure:
```
your-project-folder/
│
├── public/
│   ├── ged/
│   │   ├── file1.ged
│   │   ├── file2.ged
│   │   └── ... (other .ged files)
│   ├── index.html
│   └── graph.js
│
├── server.js
├── package.json
└── ... (other project files)
```

### Updated HTML (index.html):
Ensure the HTML file is placed in the `public` directory and updated to fetch from your local server:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GEDCOM Graph</title>
    <style>
        body {
            margin: 0;
            font-family: 'Helvetica', 'Arial', sans-serif;
            overflow: hidden;
        }
        #controls {
            position: absolute;
            top: 10px;
            right: 10px;
            z-index: 10;
        }
        #treeView {
            position: absolute;
            top: 10px;
            left: 10px;
            width: 200px;
            height: 90vh;
            overflow-y: auto;
            background: #fff;
            border: 1px solid #ccc;
            z-index: 10;
            padding: 10px;
            display: none;
        }
        #toggleTreeView {
            position: absolute;
            top: 10px;
            left: 220px;
            z-index: 10;
            padding: 10px;
            cursor: pointer;
            background-color: #6200ea;
            color: white;
            border-radius: 4px;
        }
        #gedcomFileLabel {
            display: inline-block;
            padding: 10px 20px;
            font-size: 16px;
            font-family: 'Helvetica', 'Arial', sans-serif;
            background-color: #6200ea;
            color: white;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        #gedcomFileLabel:hover {
            background-color: #3700b3;
        }
        #gedcomFile {
            display: none;
        }
        #searchBox {
            padding: 10px;
            font-size: 16px;
            margin-left: 20px;
            border-radius: 4px;
            border: 1px solid #ccc;
        }
        svg {
            width: 100vw;
            height: 100vh;
        }
        .node text {
            font: 12px sans-serif;
        }
    </style>
</head>
<body>
    <div id="treeView"></div>
    <div id="toggleTreeView" onclick="toggleTree()">Show Files</div>
    <div id="controls">
        <label for="gedcomFile" id="gedcomFileLabel">Choose File</label>
        <input type="file" id="gedcomFile">
        <input type="text" id="searchBox" placeholder="Search..." oninput="searchGraph()">
    </div>
    <svg></svg>
    <script src="https://d3js.org/d3.v6.min.js"></script>
    <script src="graph.js"></script>
    <script>
        async function fetchFiles() {
            try {
                const response = await fetch('http://localhost:3000/ged');
                const files = await response.json();
                displayFiles(files);
            } catch (error) {
                console.error('Error fetching files:', error);
            }
        }

        function displayFiles(files) {
            const treeView = document.getElementById('treeView');
            treeView.innerHTML = '<ul>' + files.map(file => `<li><a href="#" onclick="loadFile('${file}')">${file}</a></li>`).join('') + '</ul>';
        }

        function toggleTree() {
            const treeView = document.getElementById('treeView');
            const toggleButton = document.getElementById('toggleTreeView');
            if (treeView.style.display === 'none') {
                treeView.style.display = 'block';
                toggleButton.textContent = 'Hide Files';
            } else {
                treeView.style.display = 'none';
                toggleButton.textContent = 'Show Files';
            }
        }

        async function loadFile(fileName) {
            try {
                const response = await fetch(`http://localhost:3000/ged/${fileName}`);
                const gedcomData = await response.text();
                const parsedData = parseGedcom(gedcomData);
                allNodes = parsedData.nodes;
                allLinks = parsedData.links;
                createGraph(parsedData);
            } catch (error) {
                console.error('Error loading file:', error);
            }
        }

        document.addEventListener('DOMContentLoaded', () => {
            fetchFiles();
        });
    </script>
</body>
</html>
```

### Updated JavaScript (graph.js):
Ensure the `parseGedcom` and other existing functions are inside the `graph.js` file as previously provided.

```javascript
// ... existing functions

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('gedcomFile').addEventListener('change', handleFile, false);

    let allNodes = [];
    let allLinks = [];
    let simulation;

    // Existing handleFile, parseGedcom, formatName, createGraph, focusNode, removeFocus, drag, and searchGraph functions...

    async function fetchFiles() {
        try {
            const response = await fetch('http://localhost:3000/ged');
            const files = await response.json();
            displayFiles(files);
        } catch (error) {
            console.error('Error fetching files:', error);
        }
    }

    function displayFiles(files) {
        const treeView = document.getElementById('treeView');
        treeView.innerHTML = '<ul>' + files.map(file => `<li><a href="#" onclick="loadFile('${file}')">${file}</a></li>`).join('') + '</ul>';
    }

    function toggleTree() {
        const treeView = document.getElementById('treeView');
        const toggleButton = document.getElementById('toggleTreeView');
        if (treeView.style.display === 'none') {
            treeView.style.display = 'block';
            toggleButton.textContent = 'Hide Files';
        } else {
            treeView.style.display = 'none';
            toggleButton.textContent = 'Show Files';
        }
    }

    async function loadFile(fileName) {
        try {
            const response = await fetch(`http://localhost:3000/ged/${fileName}`);
            const gedcomData = await response.text();
            const parsedData = parseGedcom(gedcomData);
            allNodes = parsedData.nodes;
            allLinks = parsedData.links;
            createGraph(parsedData);
        } catch (error) {
            console.error('Error loading file:', error);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        fetchFiles();
    });
});

// Make parseGedcom and createGraph functions globally available if needed
window.parseGedcom = parseGedcom;
window.createGraph = createGraph;
```

This setup assumes you are running the server on your local machine at `http://localhost:3000`. The server will serve the `.ged` files and handle cross-origin requests (CORS). The HTML and JavaScript have been updated to fetch the list of `.ged` files from the server and display them in a tree view. When a file is clicked, it will be loaded and displayed in the graph. The "Choose File" button remains available for manual file uploads.