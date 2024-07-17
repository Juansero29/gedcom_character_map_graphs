document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('gedcomFile').addEventListener('change', handleFile, false);

    let allNodes = [];
    let allLinks = [];
    let simulation;

    function handleFile(event) {
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            const gedcomData = e.target.result;
            const parsedData = parseGedcom(gedcomData);
            allNodes = parsedData.nodes;
            allLinks = parsedData.links;
            createGraph(parsedData);
        };
        reader.readAsText(file);
    }

    function parseGedcom(data) {
        const lines = data.split('\n');
        let individuals = {};
        let families = {};
        let notes = {};
        let currentIndividual = null;
        let currentFamily = null;
        let currentNote = null;
        let currentField = null;
        let lastTag = null;

        lines.forEach(line => {
            const parts = line.trim().split(' ');
            const level = parts[0];
            const tag = parts[1];
            const value = parts.slice(2).join(' ');

            if (level === '0' && tag.startsWith('@I')) {
                currentIndividual = { id: tag, notes: [], events: [], associations: [], quotes: [], families: [] };
                individuals[tag] = currentIndividual;
                currentFamily = null;
                currentNote = null;
                currentField = null;
                lastTag = null;
            } else if (level === '0' && tag.startsWith('@F')) {
                currentFamily = { id: tag, husband: null, wife: null, children: [] };
                families[tag] = currentFamily;
                currentIndividual = null;
                currentNote = null;
                currentField = null;
                lastTag = null;
            } else if (level === '0' && tag.startsWith('@N')) {
                currentNote = { id: tag, text: [] };
                notes[tag] = currentNote;
                currentIndividual = null;
                currentFamily = null;
                currentField = currentNote.text;
                lastTag = null;
            } else if (currentIndividual || currentFamily || currentNote) {
                if (tag === 'CONC') {
                    if (currentField) {
                        currentField[currentField.length - 1] += value;
                    }
                } else if (tag === 'CONT') {
                    if (currentField) {
                        currentField.push(value);
                    }
                } else {
                    if (currentIndividual) {
                        if (level === '1') {
                            if (tag === 'NAME') {
                                currentIndividual.name = formatName(value);
                                currentField = 'name';
                            } else if (tag === 'NOTE') {
                                currentField = currentIndividual.notes;
                                currentIndividual.notes.push(value);
                            } else if (tag === 'ASSO') {
                                currentIndividual.associations.push({ person: value, relation: null, notes: [] });
                                currentField = 'asso';
                            } else if (tag === 'EVEN') {
                                currentIndividual.events.push({ value: value, type: null, date: null, place: null });
                                currentField = 'event';
                            } else if (tag === 'QUOT') {
                                currentField = currentIndividual.quotes;
                                currentIndividual.quotes.push(value);
                            } else if (tag === 'SEX') {
                                currentIndividual.sex = value;
                                currentField = null;
                            } else if (tag === 'BIRT') {
                                currentIndividual.birth = { date: null, place: null };
                                currentField = null;
                            } else if (tag === 'DEAT') {
                                currentIndividual.death = { date: null, place: null, status: true };
                                currentField = null;
                            } else if (tag === 'OCCU') {
                                currentIndividual.occupation = value;
                                currentField = null;
                            } else if (tag === 'FAMC') {
                                currentIndividual.families.push(value);
                                currentField = null;
                            } else {
                                currentField = null;
                            }
                            lastTag = tag;
                        } else if (level === '2') {
                            if (currentField === 'name') {
                                if (tag === 'NICK') {
                                    currentIndividual.nickname = value;
                                }
                                if (tag === 'EMAIL') {
                                    currentIndividual.email = value;
                                }
                            }
                            if (currentField === 'asso') {
                                if (tag === 'RELA') {
                                    currentIndividual.associations[currentIndividual.associations.length - 1].relation = value;
                                }
                                if (tag === 'NOTE') {
                                    currentIndividual.associations[currentIndividual.associations.length - 1].notes.push(value);
                                }
                            }
                            if (currentField === 'event') {
                                if (tag === 'DATE') {
                                    currentIndividual.events[currentIndividual.events.length - 1].date = value;
                                }
                                if (tag === 'PLAC') {
                                    currentIndividual.events[currentIndividual.events.length - 1].place = value;
                                }
                                if (tag === 'TYPE') {
                                    currentIndividual.events[currentIndividual.events.length - 1].type = value;
                                }
                            }
                            if (currentField === 'quotes') {
                                if (tag === 'CONC') {
                                    currentIndividual.quotes[currentIndividual.quotes.length - 1] += value;
                                }
                                if (tag === 'CONT') {
                                    currentIndividual.quotes.push(value);
                                }
                            }
                            if (tag === 'DATE') {
                                const dateValue = value.toLowerCase() === 'unknown' ? null : value;
                                if (currentIndividual.birth && !currentIndividual.birth.date) currentIndividual.birth.date = dateValue;
                                if (currentIndividual.death && !currentIndividual.death.date) currentIndividual.death.date = dateValue;
                                currentField = null;
                            }
                            if (tag === 'PLAC') {
                                const placeValue = value.toLowerCase() === 'unknown' ? null : value;
                                if (currentIndividual.birth && !currentIndividual.birth.place) currentIndividual.birth.place = placeValue;
                                if (currentIndividual.death && !currentIndividual.death.place) currentIndividual.death.place = placeValue;
                                currentField = null;
                            }
                            if (tag === 'RELA' && currentIndividual.associations.length > 0) {
                                currentIndividual.associations[currentIndividual.associations.length - 1].relation = value;
                            }
                            if (tag === 'TYPE' && currentIndividual.events.length > 0) {
                                currentIndividual.events[currentIndividual.events.length - 1].type = value;
                            }
                        }
                    } else if (currentFamily) {
                        if (level === '1') {
                            if (tag === 'HUSB') currentFamily.husband = value;
                            if (tag === 'WIFE') currentFamily.wife = value;
                            if (tag === 'CHIL') currentFamily.children.push(value);
                        }
                    } else if (currentNote) {
                        if (level === '1' && tag === 'NOTE') {
                            currentNote.text.push(value);
                        }
                    }
                }
            }
        });

        // Replace note references with actual note content
        Object.values(individuals).forEach(individual => {
            if(individual.notes.length > 0) return;
            individual.notes = individual.notes.map(noteId => notes[noteId] ? notes[noteId].text.join('') : '');
        });

        console.log(individuals); // Log the individuals to see the parsed data
        console.log(families); // Log the families to see the parsed data
        console.log(notes); // Log the notes to see the parsed notes data

        let nodes = Object.values(individuals);
        let links = [];

        // Create sibling links
        Object.values(families).forEach(fam => {
            const children = fam.children;
            children.forEach((child, index) => {
                for (let i = index + 1; i < children.length; i++) {
                    links.push({
                        source: child,
                        target: children[i],
                        relation: 'Sibling',
                        type: 'family'
                    });
                }
            });
        });

        nodes.forEach(node => {
            node.associations.forEach(assoc => {
                links.push({
                    source: node.id,
                    target: assoc.person,
                    relation: assoc.relation,
                    type: 'association',
                    notes: assoc.notes // Include notes in the link data
                });
            });
        });

        Object.values(families).forEach(fam => {
            if (fam.husband && fam.wife) {
                links.push({
                    source: fam.husband,
                    target: fam.wife,
                    relation: 'Spouse',
                    type: 'family'
                });
            }
            fam.children.forEach(child => {
                if (fam.husband) {
                    links.push({
                        source: fam.husband,
                        target: child,
                        relation: 'Parent',
                        type: 'family'
                    });
                }
                if (fam.wife) {
                    links.push({
                        source: fam.wife,
                        target: child,
                        relation: 'Parent',
                        type: 'family'
                    });
                }
            });
        });

        return { nodes, links };
    }

    function formatName(name) {
        const parts = name.split('/');
        if (parts.length === 3) {
            const firstName = parts[0].trim();
            const surname = parts[1].toUpperCase();
            const lastName = parts[2].trim();
            return `${firstName} ${surname} ${lastName}`.trim();
        }
        return name.trim();
    }

    function createGraph(data) {
        const svg = d3.select("svg");
        const width = +svg.attr("width");
        const height = +svg.attr("height");

        // Clear previous graph
        svg.selectAll("*").remove();

        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on("zoom", (event) => {
                container.attr("transform", event.transform);
            });

        svg.call(zoom);

        const container = svg.append("g");

        simulation = d3.forceSimulation(data.nodes)
            .force("link", d3.forceLink(data.links).id(d => d.id).distance(150)) // Increased distance between nodes
            .force("charge", d3.forceManyBody().strength(-200))
            .force("center", d3.forceCenter(width / 2, height / 2));

        const link = container.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(data.links)
            .enter().append("line")
            .attr("class", "link")
            .attr("stroke", d => d.type === 'family' ? 'red' : '#000')
            .attr("stroke-width", d => d.type === 'family' ? 2 : 0.5);

        const node = container.append("g")
            .attr("class", "nodes")
            .selectAll("g")
            .data(data.nodes)
            .enter().append("g")
            .attr("class", "node")
            .call(drag(simulation));

        node.append("circle")
            .attr("r", 10)
            .attr("fill", d => d.sex === 'M' ? 'blue' : 'pink'); // Use blue for males and pink for females

        // Add a cross mark for deceased individuals
        node.append("text")
            .attr("x", -6)
            .attr("y", 3)
            .attr("class", "cross")
            .text(d => d.death && d.death.status ? '✝' : '');

        const tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("position", "absolute")
            .style("background", "white")
            .style("border", "1px solid #ccc")
            .style("padding", "10px")
            .style("display", "none");

        node.on("mouseover", (event, d) => {
            tooltip.style("display", "block");
            let details = `
                <strong>Name:</strong> ${d.name}<br>
                ${d.nickname ? `<strong>Nickname:</strong> ${d.nickname}<br>` : ''}
                ${d.email ? `<strong>Email:</strong> ${d.email}<br>` : ''}
                <strong>Sex:</strong> ${d.sex}<br>
                <strong>Occupation:</strong> ${d.occupation || 'unknown occupation'}<br>
                <strong>Birth:</strong> ${d.birth ? `${d.birth.date || 'unknown date'} at ${d.birth.place || 'unknown place'}` : 'unknown birth'}<br>`;
            
            if (d.death && d.death.status) {
                details += `<strong>Death:</strong> ${d.death.date || 'unknown date'} at ${d.death.place || 'unknown place'}<br>`;
            }

            details += `
                <strong>Notes:</strong><br>
                <ul>${d.notes.length ? d.notes.map(note => note ? `<li>${note}</li>` : '').join('') : ''}</ul>
                <strong>Events:</strong><br>
                <ul>${d.events.length ? d.events.map(event => `<li>${event.type || 'unknown type'}: ${event.value ? event.value + ' - ' : ''}${event.date || 'unknown date'}${event.place ? ' at ' + event.place : ''}</li>`).join('') : '<li>no events</li>'}</ul>
                <strong>Quotes:</strong><br>
                <ul>${d.quotes.length ? d.quotes.map(quote => `<li>${quote}</li>`).join('') : '<li>no quotes</li>'}</ul>
            `;
            tooltip.html(details);
        }).on("mousemove", (event) => {
            tooltip.style("top", (event.pageY + 10) + "px").style("left", (event.pageX + 10) + "px");
        }).on("mouseout", () => {
            tooltip.style("display", "none");
        });

        node.on("click", (event, d) => {
            focusNode(d);
        });

        link.on("mouseover", (event, d) => {
            const reverseRelation = data.links.find(link => link.source.id === d.target.id && link.target.id === d.source.id);
            tooltip.style("display", "block");
            tooltip.html(`
                <strong>Relationships:</strong><br>
                ${d.source.name} to ${d.target.name}: ${d.relation}<br>
                ${d.target.name} to ${d.source.name}: ${reverseRelation ? reverseRelation.relation : 'N/A'}<br>
                ${d.notes && d.notes.length ? `<strong>Notes:</strong> <ul>${d.notes.map(note => `<li>${note}</li>`).join('')}</ul>` : ''}
            `);
        }).on("mousemove", (event) => {
            tooltip.style("top", (event.pageY + 10) + "px").style("left", (event.pageX + 10) + "px");
        }).on("mouseout", () => {
            tooltip.style("display", "none");
        });

        link.on("mouseout", () => {
            tooltip.style("display", "none");
        });

        node.append("text")
            .attr("x", 15)
            .attr("y", 3)
            .html(d => d.name);

        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node
                .attr("transform", d => `translate(${d.x},${d.y})`);
        });

        function focusNode(clickedNode) {
            const neighbors = new Set();
            data.links.forEach(link => {
                if (link.source.id === clickedNode.id || link.target.id === clickedNode.id) {
                    neighbors.add(link.source.id);
                    neighbors.add(link.target.id);
                }
            });

            node.transition()
                .duration(500)
                .style("opacity", d => (neighbors.has(d.id) || d.id === clickedNode.id) ? 1 : 0);

            link.transition()
                .duration(500)
                .style("opacity", d => (d.source.id === clickedNode.id || d.target.id === clickedNode.id) ? 1 : 0);

            // Add an 'X' button over the focused node
            const closeButton = container.append("text")
                .attr("x", clickedNode.x + 15)
                .attr("y", clickedNode.y - 15)
                .attr("class", "close-button")
                .text("X")
                .style("font-size", "24px")
                .style("cursor", "pointer")
                .style("fill", "red")
                .style("font-weight", "bold")
                .on("click", () => {
                    removeFocus();
                });
        }

        function removeFocus() {
            node.transition()
                .duration(500)
                .style("opacity", 1);

            link.transition()
                .duration(500)
                .style("opacity", 1);

            d3.selectAll(".close-button").remove();
        }

        function drag(simulation) {
            function dragstarted(event, d) {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            }

            function dragged(event, d) {
                d.fx = event.x;
                d.fy = event.y;
            }

            function dragended(event, d) {
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            }

            return d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended);
        }
    }

    window.searchGraph = function() {
        const query = document.getElementById('searchBox').value.toLowerCase();
        const filteredNodes = allNodes.filter(node => 
            node.name.toLowerCase().includes(query) ||
            (node.nickname && node.nickname.toLowerCase().includes(query)) ||
            node.name.split(' ').some(part => part.toLowerCase().includes(query))
        );
    
        const neighbors = new Set();
        allLinks.forEach(link => {
            if (filteredNodes.find(node => node.id === link.source.id) || filteredNodes.find(node => node.id === link.target.id)) {
                neighbors.add(link.source.id);
                neighbors.add(link.target.id);
            }
        });
    
        const displayNodes = allNodes.filter(node => neighbors.has(node.id));
        const displayLinks = allLinks.filter(link => neighbors.has(link.source.id) && neighbors.has(link.target.id));
    
        createGraph({ nodes: displayNodes, links: displayLinks });
    }
});
