let allNodes = [];
let allLinks = [];
let simulation;
let lastFocusedNode = null;
let lastFocusedLink = null;

// Create tooltip for links
const linkTooltip = d3
  .select("body")
  .append("div")
  .attr("class", "link-tooltip")
  .style("position", "absolute")
  .style("background", "white")
  .style("border", "1px solid #ccc")
  .style("padding", "10px")
  .style("pointer-events", "none")
  .style("display", "none")
  .style("z-index", "9999");

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

  link
    .on("mouseover", (event, d) => {
      const source =
        typeof d.source === "object"
          ? d.source
          : allNodes.find((n) => n.id === d.source);
      const target =
        typeof d.target === "object"
          ? d.target
          : allNodes.find((n) => n.id === d.target);
      const relation = d.relation || "related to";

      linkTooltip.style("display", "block").html(`
          ${source.name} → ${target.name} : ${relation}<br>
          ${target.name} → ${source.name} : ${relation}
        `);
    })
    .on("mousemove", (event) => {
      linkTooltip
        .style("top", event.pageY + 10 + "px")
        .style("left", event.pageX + 10 + "px");
    })
    .on("mouseout", () => {
      linkTooltip.style("display", "none");
    });
}

function enrichLinkTooltips() {
  const tooltip = d3.select(".tooltip");

  d3.selectAll(".link")
    .on("mouseover", function (event, d) {
      const sourceId = typeof d.source === "object" ? d.source.id : d.source;
      const targetId = typeof d.target === "object" ? d.target.id : d.target;
      const source = allNodes.find((n) => n.id === sourceId);
      const target = allNodes.find((n) => n.id === targetId);

      const sourceToTarget = d.relation
        ? `${source.name} → ${target.name} : ${d.relation}`
        : "";
      const reverseLink = allLinks.find(
        (l) =>
          (typeof l.source === "object" ? l.source.id : l.source) ===
            targetId &&
          (typeof l.target === "object" ? l.target.id : l.target) === sourceId
      );
      const targetToSource = reverseLink?.relation
        ? `${target.name} → ${source.name} : ${reverseLink.relation}`
        : "";

      let notes = "";
      if (d.notes?.length) {
        notes = `<br><ul>${d.notes.map((n) => `<li>${n}</li>`).join("")}</ul>`;
      }

      tooltip
        .style("display", "block")
        .html(
          `<strong>${sourceToTarget}</strong><br><strong>${targetToSource}</strong>${notes}`
        );
    })
    .on("mousemove", function (event) {
      tooltip
        .style("top", event.pageY + 10 + "px")
        .style("left", event.pageX + 10 + "px");
    })
    .on("mouseout", function () {
      tooltip.style("display", "none");
    })
    .on("click", function (event, d) {
      lastFocusedLink = d;
      lastFocusedNode = null; // Clear any previous node
      const sourceId = typeof d.source === "object" ? d.source.id : d.source;
      const targetId = typeof d.target === "object" ? d.target.id : d.target;
      const source = allNodes.find((n) => n.id === sourceId);
      const target = allNodes.find((n) => n.id === targetId);
      const reverseLink = allLinks.find(
        (l) =>
          (typeof l.source === "object" ? l.source.id : l.source) ===
            targetId &&
          (typeof l.target === "object" ? l.target.id : l.target) === sourceId
      );

      // Relationship details
      const relA = `${source.name} → ${target.name} : ${d.relation || "?"}`;
      const relB = `${target.name} → ${source.name} : ${
        reverseLink?.relation || "?"
      }`;

      const notes = d.notes?.length
        ? `<ul>${d.notes.map((n) => `<li>${n}</li>`).join("")}</ul>`
        : "";

      showModalContent(
        source,
        target,
        `${source.name} → ${target.name} : ${d.relation || "?"}<br>${
          target.name
        } → ${source.name} : ${reverseLink?.relation || "?"}${notes}`
      );

      // Optional highlight logic
      const idsToHighlight = new Set([sourceId, targetId]);
      d3.selectAll(".node").each(function (n) {
        const visible = idsToHighlight.has(n.id);
        d3.select(this)
          .transition()
          .duration(300)
          .style("opacity", visible ? 1 : 0.1);
        d3.select(this)
          .selectAll("circle, text")
          .transition()
          .duration(300)
          .style("opacity", visible ? 1 : 0.1);
      });

      event.stopPropagation();
    });
}

function renderPersonProfile(person) {
  return `
    <h2>${person.name}</h2>
    ${
      person.nickname
        ? `<p><strong>Nickname:</strong> ${person.nickname}</p>`
        : ""
    }
    ${person.email ? `<p><strong>Email:</strong> ${person.email}</p>` : ""}
    <p><strong>Sex:</strong> ${person.sex}</p>
    <p><strong>Occupation:</strong> ${person.occupation || "Unknown"}</p>
    <p><strong>Birth:</strong> ${person.birth?.date || "?"} at ${
    person.birth?.place || "?"
  }</p>
    ${
      person.death?.status
        ? `<p><strong>Death:</strong> ${person.death.date || "?"} at ${
            person.death.place || "?"
          }</p>`
        : ""
    }

    <h3>Notes</h3>
    <ul>${person.notes.map((note) => `<li>${note}</li>`).join("")}</ul>

    <h3>Events</h3>
    <ul>${person.events
      .map(
        (e) =>
          `<li>${e.type || "Event"}: ${e.value || ""} - ${e.date || "?"}${
            e.place ? " at " + e.place : ""
          }</li>`
      )
      .join("")}</ul>

    <h3>Quotes</h3>
    <ul>${person.quotes.map((q) => `<li>${q}</li>`).join("")}</ul>
  `;
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
  lastFocusedNode = clickedNode;
  lastFocusedLink = null; // Clear any previous link

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

function showModalContent(nodeA, nodeB = null, relationInfo = null) {
  const modal = document.getElementById("modalContainer");
  const content = document.getElementById("modalContent");
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  const isMobile = window.innerWidth < 768;
  modal.style.width = "100vw";
  modal.style.height = "100vh";

  const svg = document.querySelector("svg");
  svg.style.width = isMobile ? "100vw" : "50vw";
  svg.style.height = "100vh";

  if (nodeB) {
    // Show two-person relationship view
    content.classList.add("modal-flex");
    content.innerHTML = `
      <div class="profile-pane">
        <div class="relation-header">
          ${relationInfo}<br>
        </div>
        ${renderPersonProfile(nodeA)}
      </div>
      <div class="profile-pane">
        ${renderPersonProfile(nodeB)}
      </div>
    `;
  } else {
    // Show single profile view
    content.classList.remove("modal-flex");
    content.innerHTML = `
      <div class="profile-pane">
        ${renderPersonProfile(nodeA)}
      </div>
    `;
  }
}

function closeModal() {
  document.getElementById("modalContainer").classList.add("hidden");
  document.body.style.overflow = "auto";
  const svg = document.querySelector("svg");
  svg.style.width = "100%";
  svg.style.height = "100%";

  // Only reset if something was focused
  if (lastFocusedNode || lastFocusedLink) {
    d3.selectAll(".node").transition().duration(300).style("opacity", 1);

    d3.selectAll(".node circle")
      .transition()
      .duration(300)
      .attr("fill", (d) => (d.sex === "M" ? "blue" : "pink"))
      .style("opacity", 1);

    d3.selectAll(".node text").transition().duration(300).style("opacity", 1);

    d3.selectAll(".link").transition().duration(300).style("opacity", 1);
  }

  lastFocusedNode = null;
  lastFocusedLink = null;
}

function showModalContentForLink(
  source,
  target,
  relationA,
  relationB,
  notes = []
) {
  const modal = document.getElementById("modalContainer");
  const content = document.getElementById("modalContent");
  modal.classList.remove("hidden");

  modal.style.width = "100vw";
  modal.style.height = "100vh";

  const section = (person, relation) => `
    <div style="flex: 1; padding: 1em; border-right: 1px solid #ccc;">
      <h2>${person.name}</h2>
      <p><strong>Sex:</strong> ${person.sex}</p>
      <p><strong>Occupation:</strong> ${person.occupation || "Unknown"}</p>
      <p><strong>Relation:</strong> ${relation || "Unknown"}</p>
    </div>`;

  content.innerHTML = `
    <div style="display: flex; height: 90%;">
      ${section(source, relationA)}
      ${section(target, relationB)}
    </div>
    <div style="padding: 1em;">
      <h3>Notes</h3>
      <ul>${
        (notes || []).map((n) => `<li>${n}</li>`).join("") ||
        "<li>No notes.</li>"
      }</ul>
      <button onclick="closeModal()">Close</button>
    </div>
  `;
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
      enrichLinkTooltips();
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

    const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
    const neighbors = new Set();

    window.allLinks.forEach((link) => {
      const sourceId =
        typeof link.source === "object" ? link.source.id : link.source;
      const targetId =
        typeof link.target === "object" ? link.target.id : link.target;

      if (filteredNodeIds.has(sourceId) || filteredNodeIds.has(targetId)) {
        neighbors.add(sourceId);
        neighbors.add(targetId);
      }
    });

    const displayNodes = window.allNodes.filter((node) =>
      neighbors.has(node.id)
    );
    const displayLinks = window.allLinks.filter((link) => {
      const sourceId =
        typeof link.source === "object" ? link.source.id : link.source;
      const targetId =
        typeof link.target === "object" ? link.target.id : link.target;
      return neighbors.has(sourceId) && neighbors.has(targetId);
    });

    createGraph({
      nodes: displayNodes.map((n) => ({ ...n })),
      links: displayLinks.map((l) => ({ ...l })),
    });

    if (query === "") {
      createGraph({
        nodes: window.allNodes.map((n) => ({ ...n })),
        links: window.allLinks.map((l) => ({ ...l })),
      });
      return;
    }
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
