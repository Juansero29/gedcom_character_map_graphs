document.getElementById('gedcomFile').addEventListener('change', handleFile, false);


function handleFile(event) {
const file = event.target.files[0];
const reader = new FileReader();
reader.onload = function(e) {
const gedcomData = e.target.result;
const parsedData = parseGedcom(gedcomData);
createGraph(parsedData);
};
reader.readAsText(file);
}

function parseGedcom(data) {
const lines = data.split('\n');
let individuals = {};
let currentIndividual = null;
let associations = [];

lines.forEach(line => {
    const parts = line.trim().split(' ');
    const level = parts[0];
    const tag = parts[1];
    const value = parts.slice(2).join(' ');

    if (level === '0' && tag.startsWith('@I')) {
        currentIndividual = { id: tag, notes: [], events: [] };
        individuals[tag] = currentIndividual;
    } else if (currentIndividual) {
        if (level === '1') {
            if (tag === 'NAME') currentIndividual.name = value;
            if (tag === 'SEX') currentIndividual.sex = value;
            if (tag === 'BIRT') currentIndividual.birth = { date: null, place: null };
            if (tag === 'DEAT') currentIndividual.death = { date: null, place: null };
            if (tag === 'OCCU') currentIndividual.occupation = value;
            if (tag === 'NOTE') currentIndividual.notes.push(value);
            if (tag === 'ASSO') {
                associations.push({ person1: currentIndividual.id, person2: value });
            }
            if (tag === 'EVEN') currentIndividual.events.push({ type: null, date: null, place: null });
        } else if (level === '2') {
            if (tag === 'DATE' && currentIndividual.birth && !currentIndividual.birth.date) currentIndividual.birth.date = value;
            if (tag === 'PLAC' && currentIndividual.birth && !currentIndividual.birth.place) currentIndividual.birth.place = value;
            if (tag === 'DATE' && currentIndividual.death && !currentIndividual.death.date) currentIndividual.death.date = value;
            if (tag === 'PLAC' && currentIndividual.death && !currentIndividual.death.place) currentIndividual.death.place = value;
            if (tag === 'RELA' && associations.length > 0) {
                associations[associations.length - 1].relation = value;
            }
            if (tag === 'TYPE' && currentIndividual.events.length > 0) {
                currentIndividual.events[currentIndividual.events.length - 1].type = value;
            }
            if (tag === 'DATE' && currentIndividual.events.length > 0) {
                currentIndividual.events[currentIndividual.events.length - 1].date = value;
            }
            if (tag === 'PLAC' && currentIndividual.events.length > 0) {
                currentIndividual.events[currentIndividual.events.length - 1].place = value;
            }
        }
    }
});

let nodes = Object.values(individuals);
let links = associations.map(assoc => ({
    source: assoc.person1,
    target: assoc.person2,
    relation: assoc.relation
}));

return { nodes, links };
}

function createGraph(data) {
const svg = d3.select("svg");
const width = +svg.attr("width");
const height = +svg.attr("height");

const zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on("zoom", (event) => {
        container.attr("transform", event.transform);
    });

svg.call(zoom);

const container = svg.append("g");

const simulation = d3.forceSimulation(data.nodes)
    .force("link", d3.forceLink(data.links).id(d => d.id).distance(100))
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(width / 2, height / 2));

const link = container.append("g")
    .attr("class", "links")
    .selectAll("line")
    .data(data.links)
    .enter().append("line")
    .attr("class", "link");

const node = container.append("g")
    .attr("class", "nodes")
    .selectAll("g")
    .data(data.nodes)
    .enter().append("g")
    .attr("class", "node");

node.append("circle")
    .attr("r", 10)
    .attr("fill", "lightblue");

const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("background", "white")
    .style("border", "1px solid #ccc")
    .style("padding", "10px")
    .style("display", "none");

node.on("mouseover", (event, d) => {
    tooltip.style("display", "block");
    tooltip.html(`
        <strong>${d.name}</strong><br>
        Sex: ${d.sex}<br>
        Occupation: ${d.occupation}<br>
        Birth: ${d.birth ? `${d.birth.date} at ${d.birth.place}` : 'unknown'}<br>
        Death: ${d.death ? `${d.death.date} at ${d.death.place}` : 'unknown'}<br>
        Notes: <br>${d.notes.join('<br>')}<br>
        Events: <br>${d.events.map(e => `${e.type}: ${e.date} at ${e.place}`).join('<br>')}
    `);
}).on("mousemove", (event) => {
    tooltip.style("top", (event.pageY + 10) + "px").style("left", (event.pageX + 10) + "px");
}).on("mouseout", () => {
    tooltip.style("display", "none");
});

link.on("mouseover", (event, d) => {
    tooltip.style("display", "block");
    tooltip.html(`
        <strong>Relationship:</strong><br>
        ${d.relation}<br>
        Between: ${d.source.name} and ${d.target.name}
    `);
}).on("mousemove", (event) => {
    tooltip.style("top", (event.pageY + 10) + "px").style("left", (event.pageX + 10) + "px");
}).on("mouseout", () => {
    tooltip.style("display", "none");
});

node.append("text")
    .attr("x", 15)
    .attr("y", 3)
    .text(d => d.name);

simulation.on("tick", () => {
    link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

    node
        .attr("transform", d => `translate(${d.x},${d.y})`);
});
}