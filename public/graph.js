let allNodes = [];
let allLinks = [];
let simulation;

function parseGedcom(data) {
  const lines = data.split("\n");
  const individuals = {};
  const families = {};
  const notes = {};

  let currentIndividual = null;
  let currentFamily = null;
  let currentNote = null;
  let currentField = null;
  let currentContext = null;
  let currentEvent = null;

  function formatName(name) {
    return name.replace(/\//g, ""); // Simple fallback
  }

  lines.forEach((line) => {
    const parts = line.trim().split(" ");
    const level = parts[0];
    const tag = parts[1];
    const value = parts.slice(2).join(" ");

    if (level === "0") {
      currentField = null;
      currentContext = null;
      currentEvent = null;

      if (tag.startsWith("@I")) {
        currentIndividual = {
          id: tag,
          name: "",
          sex: null,
          birth: null,
          death: null,
          occupation: null,
          notes: [],
          quotes: [],
          events: [],
          associations: [],
          familiesAsChild: [],
          familiesAsSpouse: [],
        };
        individuals[tag] = currentIndividual;
        currentFamily = null;
        currentNote = null;
      } else if (tag.startsWith("@F")) {
        currentFamily = {
          id: tag,
          husband: null,
          wife: null,
          children: [],
        };
        families[tag] = currentFamily;
        currentIndividual = null;
        currentNote = null;
      } else if (tag.startsWith("@N")) {
        currentNote = { id: tag, text: [] };
        notes[tag] = currentNote;
        currentField = currentNote.text;
        currentIndividual = null;
        currentFamily = null;
      }
    } else {
      if (tag === "CONC" && currentField) {
        currentField[currentField.length - 1] += value;
      } else if (tag === "CONT" && currentField) {
        currentField.push(value);
      } else if (currentIndividual) {
        if (level === "1") {
          currentEvent = null;
          currentContext = null;

          switch (tag) {
            case "NAME":
              currentIndividual.name = formatName(value);
              currentContext = "name";
              currentField = null;
              break;
            case "NOTE":
              currentIndividual.notes.push(value);
              currentContext = "note";
              currentField = currentIndividual.notes;
              break;
            case "QUOT":
              currentIndividual.quotes.push(value);
              currentContext = "quote";
              currentField = currentIndividual.quotes;
              break;
            case "ASSO":
              currentIndividual.associations.push({
                person: value,
                relation: null,
                notes: [],
              });
              currentContext = "association";
              break;
            case "EVEN":
              currentEvent = {
                value: value,
                type: null,
                date: null,
                place: null,
              };
              currentIndividual.events.push(currentEvent);
              currentContext = "event";
              break;
            case "SEX":
              currentIndividual.sex = value;
              break;
            case "BIRT":
              currentIndividual.birth = { date: null, place: null };
              currentEvent = currentIndividual.birth;
              currentContext = "birth";
              break;
            case "DEAT":
              currentIndividual.death = {
                date: null,
                place: null,
                status: true,
              };
              currentEvent = currentIndividual.death;
              currentContext = "death";
              break;
            case "OCCU":
              currentIndividual.occupation = value;
              break;
            case "FAMC":
              currentIndividual.familiesAsChild.push(value);
              break;
            case "FAMS":
              currentIndividual.familiesAsSpouse.push(value);
              break;
          }
        } else if (level === "2") {
          switch (currentContext) {
            case "name":
              if (tag === "NICK") currentIndividual.nickname = value;
              if (tag === "EMAIL") currentIndividual.email = value;
              break;

            case "quote":
              if (tag === "CONC") {
                currentIndividual.quotes[currentIndividual.quotes.length - 1] +=
                  value;
              } else if (tag === "CONT") {
                currentIndividual.quotes.push(value);
              }
              break;

            case "note":
              currentField.push(value);
              break;

            case "association":
              const assoc = currentIndividual.associations.at(-1);
              if (assoc) {
                if (tag === "RELA") assoc.relation = value;
                if (tag === "NOTE") assoc.notes.push(value);
              }
              break;

            case "event":
            case "birth":
            case "death":
              if (currentEvent) {
                if (tag === "DATE")
                  currentEvent.date =
                    value.toLowerCase() === "unknown" ? null : value;
                if (tag === "PLAC")
                  currentEvent.place =
                    value.toLowerCase() === "unknown" ? null : value;
                if (tag === "TYPE") currentEvent.type = value;
              }
              break;
          }
        }
      } else if (currentFamily && level === "1") {
        switch (tag) {
          case "HUSB":
            currentFamily.husband = value;
            break;
          case "WIFE":
            currentFamily.wife = value;
            break;
          case "CHIL":
            currentFamily.children.push(value);
            break;
        }
      } else if (currentNote && level === "1" && tag === "NOTE") {
        currentNote.text.push(value);
      }
    }
  });

  // Résolution des références de notes
  Object.values(individuals).forEach((individual) => {
    individual.notes = individual.notes.map((noteId) =>
      notes[noteId] ? notes[noteId].text.join("\n") : noteId
    );
  });

  const nodes = Object.values(individuals);
  const links = [];

  // Associations
  nodes.forEach((node) => {
    node.associations.forEach((assoc) => {
      links.push({
        source: node.id,
        target: assoc.person,
        relation: assoc.relation,
        type: "association",
        notes: assoc.notes,
      });
    });
  });

  // Familles
  Object.values(families).forEach((fam) => {
    const { husband, wife, children } = fam;

    // Couple
    if (husband && wife) {
      links.push({
        source: husband,
        target: wife,
        relation: "Spouse",
        type: "family",
      });
    }

    // Parents → Enfants
    children.forEach((child) => {
      if (husband) {
        links.push({
          source: husband,
          target: child,
          relation: "Parent",
          type: "family",
        });
      }
      if (wife) {
        links.push({
          source: wife,
          target: child,
          relation: "Parent",
          type: "family",
        });
      }
    });

    // Frères et sœurs
    for (let i = 0; i < children.length; i++) {
      for (let j = i + 1; j < children.length; j++) {
        links.push({
          source: children[i],
          target: children[j],
          relation: "Sibling",
          type: "family",
        });
      }
    }
  });

  return { nodes, links };
}

function createGraph(data) {
  const svg = d3.select("svg");
  const width = window.innerWidth;
  const height = window.innerHeight;

  // Clear SVG
  svg.selectAll("*").remove();

  // Remove invalid links
  const nodeIds = new Set(data.nodes.map((n) => n.id));
  data.links = data.links.filter(
    (l) => nodeIds.has(l.source) && nodeIds.has(l.target)
  );

    // ✅ FIX: update global references
  allNodes = data.nodes;
  allLinks = data.links;

  // Setup zoom and pan
  const container = svg.append("g");
  const zoom = d3
    .zoom()
    .scaleExtent([0.1, 4])
    .on("zoom", (e) => {
      container.attr("transform", e.transform);
    });
  svg.call(zoom);

  // Simulation
  simulation = d3
    .forceSimulation(data.nodes)
    .force(
      "link",
      d3
        .forceLink(data.links)
        .id((d) => d.id)
        .distance(150)
    )
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(width / 2, height / 2));

  // Draw links
  const link = container
    .append("g")
    .attr("class", "links")
    .selectAll("line")
    .data(data.links)
    .enter()
    .append("line")
    .attr("class", "link")
    .attr("stroke", (d) => (d.type === "family" ? "red" : "#000"))
    .attr("stroke-width", (d) => (d.type === "family" ? 2 : 0.5))
    .attr("data-link-id", (d) => d.id); // NEW

  // Draw nodes
  const node = container
    .append("g")
    .attr("class", "nodes")
    .selectAll("g")
    .data(data.nodes)
    .enter()
    .append("g")
    .attr("class", "node")
    .call(drag(simulation));

  node
    .append("circle")
    .attr("r", 10)
    .attr("fill", (d) => (d.sex === "M" ? "blue" : "pink"));

  node
    .append("text")
    .attr("x", 15)
    .attr("y", 3)
    .text((d) => d.name);

  node
    .append("text")
    .attr("x", -6)
    .attr("y", 3)
    .attr("class", "cross")
    .text((d) => (d.death && d.death.status ? "✝" : ""));

  // Tooltip
  const tooltip = d3
    .select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("background", "white")
    .style("border", "1px solid #ccc")
    .style("padding", "10px")
    .style("display", "none");

  node
    .on("mouseover", (event, d) => {
      tooltip.style("display", "block");
      tooltip.html(`<strong>${d.name}</strong><br>${d.occupation || ""}`);
    })
    .on("mousemove", (event) => {
      tooltip
        .style("top", event.pageY + 10 + "px")
        .style("left", event.pageX + 10 + "px");
    })
    .on("mouseout", () => tooltip.style("display", "none"));

  // Focus/Modal behavior
  let pressTimer;
  const longPressDuration = 500;

  node.on("click", (event, d) => {
    showModalContent(d);
    focusNode(d);
  });

  node
    .on("mousedown", (event, d) => {
      pressTimer = setTimeout(() => focusNode(d), longPressDuration);
    })
    .on("mouseup mouseleave", () => clearTimeout(pressTimer));

  node
    .on("touchstart", (event, d) => {
      pressTimer = setTimeout(() => focusNode(d), longPressDuration);
    })
    .on("touchend", () => clearTimeout(pressTimer));

  simulation.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    node.attr("transform", (d) => `translate(${d.x},${d.y})`);
  });
}

function drag(sim) {
  return d3
    .drag()
    .on("start", (event, d) => {
      if (!event.active) sim.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    })
    .on("drag", (event, d) => {
      d.fx = event.x;
      d.fy = event.y;
    })
    .on("end", (event, d) => {
      if (!event.active) sim.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    });
}

function focusNode(clickedNode) {
  const clickedId = clickedNode.id;
  console.log("🔍 Node clicked:", clickedId);

  const neighbors = new Set();
  neighbors.add(clickedId);

  console.log("🔗 allLinks length:", allLinks.length);

  allLinks.forEach((link, i) => {
    console.log(`➡️ Processing link ${i}:`, link);

    const sourceId =
      typeof link.source === "object" ? link.source.id : link.source;
    const targetId =
      typeof link.target === "object" ? link.target.id : link.target;

    console.log(`    sourceId: ${sourceId}, targetId: ${targetId}`);

    if (!sourceId || !targetId) {
      console.warn(`⚠️ Skipped link ${i} due to missing ID`, link);
      return;
    }

    if (sourceId === clickedId) {
      console.log(`✅ Match (source → target): ${clickedId} → ${targetId}`);
      neighbors.add(targetId);
    }

    if (targetId === clickedId) {
      console.log(`✅ Match (target ← source): ${clickedId} ← ${sourceId}`);
      neighbors.add(sourceId);
    }
  });

  console.log("🧩 Final neighbor set:", Array.from(neighbors));

  d3.selectAll(".node")
    .transition()
    .duration(300)
    .style("opacity", (d) => {
      const isNeighbor = neighbors.has(d.id);
      console.log(`🌐 Node ${d.id} => ${isNeighbor ? "VISIBLE" : "HIDDEN"}`);
      return isNeighbor ? 1 : 0.1;
    });

  d3.selectAll(".link")
    .transition()
    .duration(300)
    .style("opacity", (l, i) => {
      const sourceId = typeof l.source === "object" ? l.source.id : l.source;
      const targetId = typeof l.target === "object" ? l.target.id : l.target;
      const visible = neighbors.has(sourceId) && neighbors.has(targetId);
      console.log(
        `🪢 Link ${i}: ${sourceId} - ${targetId} => ${
          visible ? "VISIBLE" : "HIDDEN"
        }`
      );
      return visible ? 1 : 0.1;
    });

  showModalContent(clickedNode);
}

function showModalContent(node) {
  const modal = document.getElementById("modalContainer");
  const content = document.getElementById("modalContent");
  const svg = document.querySelector("svg");
  const isMobile = window.innerWidth < 768;

  // Adjust layout for modal and graph
  if (isMobile) {
    modal.style.width = "100vw";
    modal.style.height = "34vh";
    svg.style.width = "100vw";
    svg.style.height = "66vh";
  } else {
    modal.style.width = "50vw";
    modal.style.height = "100vh";
    svg.style.width = "50vw";
    svg.style.height = "100vh";
  }

  modal.classList.remove("hidden");

  content.innerHTML = `
    <h2>${node.name}</h2>
    ${node.nickname ? `<p><strong>Nickname:</strong> ${node.nickname}</p>` : ""}
    ${node.email ? `<p><strong>Email:</strong> ${node.email}</p>` : ""}
    <p><strong>Sex:</strong> ${node.sex}</p>
    <p><strong>Occupation:</strong> ${
      node.occupation || "unknown occupation"
    }</p>
    <p><strong>Birth:</strong> ${node.birth?.date || "unknown date"} at ${
    node.birth?.place || "unknown place"
  }</p>
    ${
      node.death?.status
        ? `<p><strong>Death:</strong> ${node.death.date || "unknown date"} at ${
            node.death.place || "unknown place"
          }</p>`
        : ""
    }
    
    <h3>Notes</h3>
    <ul>${node.notes.map((note) => `<li>${note}</li>`).join("")}</ul>

    <h3>Events</h3>
    <ul>${node.events
      .map(
        (e) =>
          `<li>${e.type || "Event"}: ${e.value || ""} - ${e.date || "unknown"}${
            e.place ? " at " + e.place : ""
          }</li>`
      )
      .join("")}</ul>

    <h3>Quotes</h3>
    <ul>${node.quotes.map((q) => `<li>${q}</li>`).join("")}</ul>

    <button onclick="closeModal()">Close</button>
  `;
}

function closeModal() {
  document.getElementById("modalContainer").classList.add("hidden");

  const svg = document.querySelector("svg");
  svg.style.width = "100%";
  svg.style.height = "100%";

  d3.selectAll(".node").transition().duration(300).style("opacity", 1);

  d3.selectAll(".link").transition().duration(300).style("opacity", 1);
}

function formatName(name) {
  const parts = name.split("/");
  if (parts.length === 3) {
    const firstName = parts[0].trim();
    const surname = parts[1].toUpperCase();
    const lastName = parts[2].trim();
    return `${firstName} ${surname} ${lastName}`.trim();
  }
  return name.trim();
}

document.addEventListener("DOMContentLoaded", function () {
  document
    .getElementById("gedcomFile")
    .addEventListener("change", handleFile, false);

  function handleFile(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = function (e) {
      const gedcomData = e.target.result;
      const parsedData = parseGedcom(gedcomData);

      window.allNodes = parsedData.nodes.map((n) => ({ ...n }));
      window.allLinks = parsedData.links.map((l) => ({
        source: l.source,
        target: l.target,
        relation: l.relation,
        type: l.type,
        notes: l.notes,
      }));

      createGraph(parsedData);
    };
    reader.readAsText(file);
  }

  window.searchGraph = function () {
    const query = document.getElementById("searchBox").value.toLowerCase();
    const filteredNodes = window.allNodes.filter(
      (node) =>
        node.name.toLowerCase().includes(query) ||
        (node.nickname && node.nickname.toLowerCase().includes(query)) ||
        node.name.split(" ").some((part) => part.toLowerCase().includes(query))
    );

    const neighbors = new Set();
    window.allLinks.forEach((link) => {
      if (
        filteredNodes.find((node) => node.id === link.source.id) ||
        filteredNodes.find((node) => node.id === link.target.id)
      ) {
        neighbors.add(link.source.id);
        neighbors.add(link.target.id);
      }
    });

    const displayNodes = window.allNodes.filter((node) =>
      neighbors.has(node.id)
    );
    const displayLinks = window.allLinks.filter(
      (link) => neighbors.has(link.source.id) && neighbors.has(link.target.id)
    );

    createGraph({ nodes: displayNodes, links: displayLinks });
  };

  async function fetchFiles() {
    try {
      const response = await fetch("http://localhost:3000/ged");
      const files = await response.json();
      displayFiles(files);
    } catch (error) {
      console.error("Error fetching files:", error);
    }
  }

  function displayFiles(files) {
    const treeView = document.getElementById("treeView");
    treeView.innerHTML =
      "<ul>" +
      files
        .map(
          (file) =>
            `<li><a href="#" onclick="loadFile('${file}')">${file}</a></li>`
        )
        .join("") +
      "</ul>";
  }

  function toggleTree() {
    const treeView = document.getElementById("treeView");
    const toggleButton = document.getElementById("toggleTreeView");
    if (treeView.style.display === "none") {
      treeView.style.display = "block";
      toggleButton.textContent = "Hide Files";
    } else {
      treeView.style.display = "none";
      toggleButton.textContent = "Show Files";
    }
  }

  async function loadFile(fileName) {
    try {
      const response = await fetch(`http://localhost:3000/ged/${fileName}`);
      const gedcomData = await response.text();
      const parsedData = parseGedcom(gedcomData);
      window.allNodes = parsedData.nodes.map((n) => ({ ...n }));
      window.allLinks = parsedData.links.map((l) => ({
        source: l.source,
        target: l.target,
        relation: l.relation,
        type: l.type,
        notes: l.notes,
      }));
      createGraph(parsedData);
    } catch (error) {
      console.error("Error loading file:", error);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    fetchFiles();
  });

  let pressTimer = null;
  let longPressDuration = 500;
});

// Add these lines at the end of graph.js
window.parseGedcom = parseGedcom;
window.createGraph = createGraph;
window.formatName = formatName;
