let allNodes = [];
let allLinks = [];
let simulation;
let lastFocusedNode = null;
let lastFocusedLink = null;
let hoverRestoreTimer = null;
let suppressHoverLeave = 0;
let nodeDragMoved = false;
let currentLayoutMode = localStorage.getItem("cm_layout") || "hierarchy";
let currentHorizontalSpread = (() => {
  const raw = Number(localStorage.getItem("cm_h_spread"));
  return Number.isFinite(raw) ? Math.min(3.5, Math.max(1, raw)) : 2;
})();
let currentNarrative = null;
let currentNarrativeTime = null;

const GED_MONTH_INDEX = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

function parseBirthYear(dateStr) {
  const parts = parseGedDateParts(dateStr);
  return parts?.year ?? null;
}

function parseGedDateParts(dateStr) {
  if (!dateStr) return null;
  const raw = String(dateStr).trim();
  if (
    !raw ||
    /^unknown$/i.test(raw) ||
    /^inconnu(e)?$/i.test(raw) ||
    /^desconocido$/i.test(raw) ||
    raw === "?"
  )
    return null;

  const approx = /^(ABT|EST|CAL|ABOUT|VERS|CIRCA)\b/i.test(raw);
  const cleaned = raw
    .replace(/^(ABT|EST|CAL|ABOUT|VERS|CIRCA)\s+/i, "")
    .replace(/^(BET|FROM|TO|AND)\b.*/i, (m) => {
      // Prefer the later bound for BET X AND Y when assessing death, earlier for birth — handled by caller
      return m;
    });

  // BET 1307 AND 1314 → use first year for range start / last for end via flags
  const bet = raw.match(
    /BET\s+(\d{1,2}\s+)?([A-Z]{3}\s+)?(\d{3,4})\s+AND\s+(\d{1,2}\s+)?([A-Z]{3}\s+)?(\d{3,4})/i
  );
  if (bet) {
    return {
      year: Number(bet[3]),
      month: bet[2] ? GED_MONTH_INDEX[bet[2].trim().toUpperCase()] || null : null,
      day: bet[1] ? Number(bet[1]) : null,
      approx: true,
      rangeEndYear: Number(bet[6]),
    };
  }

  const full = cleaned.match(
    /^(?:(\d{1,2})\s+)?(?:([A-Z]{3})\s+)?(\d{3,4})$/i
  );
  if (!full) {
    const yearOnly = raw.match(/(\d{3,4})/);
    if (!yearOnly) return null;
    return { year: Number(yearOnly[1]), month: null, day: null, approx: true };
  }
  return {
    year: Number(full[3]),
    month: full[2] ? GED_MONTH_INDEX[full[2].toUpperCase()] || null : null,
    day: full[1] ? Number(full[1]) : null,
    approx,
  };
}

function gedPartsToDate(parts, { endOfRange = false } = {}) {
  if (!parts?.year) return null;
  const year = endOfRange && parts.rangeEndYear ? parts.rangeEndYear : parts.year;
  const month = parts.month || (endOfRange ? 12 : 1);
  const day = parts.day || (endOfRange ? 28 : 1);
  return new Date(year, month - 1, day);
}

function ageAtNarrative(person, atDate) {
  if (!atDate) return null;
  const birth = parseGedDateParts(person.birth?.date);
  if (!birth?.year) return { kind: "unknown" };

  const birthDate = gedPartsToDate(birth);
  const death = person.death?.status
    ? parseGedDateParts(person.death?.date)
    : null;
  const deathDate = death ? gedPartsToDate(death, { endOfRange: true }) : null;

  if (deathDate && deathDate < atDate) {
    return {
      kind: "dead",
      deathDate,
      ageAtDeath: diffAgeYears(birthDate, deathDate, birth.approx || death.approx),
    };
  }

  if (birthDate > atDate) {
    return { kind: "unborn" };
  }

  return {
    kind: "alive",
    ...diffAgeYears(birthDate, atDate, birth.approx),
  };
}

function diffAgeYears(fromDate, toDate, approx = false) {
  let years = toDate.getFullYear() - fromDate.getFullYear();
  let months = toDate.getMonth() - fromDate.getMonth();
  if (toDate.getDate() < fromDate.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years: Math.max(0, years), months: Math.max(0, months), approx };
}

function formatAgeShort(ageInfo, t) {
  if (!ageInfo || ageInfo.kind === "unknown" || ageInfo.kind === "unborn") {
    return "";
  }
  if (ageInfo.kind === "dead") {
    return "†";
  }
  if (ageInfo.years < 1) {
    return t("narrativeInfant", { months: Math.max(1, ageInfo.months || 1) });
  }
  return ageInfo.approx
    ? t("yearsShortApprox", { age: ageInfo.years })
    : t("yearsShort", { age: ageInfo.years });
}

function formatAgeLong(ageInfo, t) {
  if (!ageInfo || ageInfo.kind === "unknown") return t("narrativeNoAge");
  if (ageInfo.kind === "unborn") return t("narrativeNoAge");
  if (ageInfo.kind === "dead") {
    const when = ageInfo.deathDate
      ? formatDateForUi(
          `${ageInfo.deathDate.getFullYear()}`
        )
      : "?";
    return t("narrativeDeadSince", { when });
  }
  if (ageInfo.years < 1) {
    return t("narrativeInfant", { months: Math.max(1, ageInfo.months || 1) });
  }
  return ageInfo.approx
    ? t("narrativeAgeApprox", { age: ageInfo.years })
    : t("narrativeAgeValue", { age: ageInfo.years });
}

function localizeNarrativeField(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  const lang = window.getLang ? window.getLang() : "en";
  return value[lang] || value.fr || value.en || value.es || "";
}

function narrativeBounds(narrative) {
  if (!narrative?.start || !narrative?.end) return null;
  const start = new Date(narrative.start);
  const end = new Date(narrative.end);
  if (Number.isNaN(+start) || Number.isNaN(+end) || end < start) return null;
  return { start, end, spanMs: Math.max(+end - +start, 1) };
}

function momentAtTime(narrative, atDate) {
  const moments = [...(narrative?.moments || [])].sort(
    (a, b) => +new Date(a.at) - +new Date(b.at)
  );
  if (!moments.length) return null;
  let current = moments[0];
  for (const m of moments) {
    if (+new Date(m.at) <= +atDate) current = m;
    else break;
  }
  return current;
}

function formatNarrativeClock(date, narrative) {
  if (!date) return "";
  const lang = window.getLang ? window.getLang() : "en";
  const precision = narrative?.precision || "day";
  const opts =
    precision === "year"
      ? { year: "numeric" }
      : precision === "month"
        ? { year: "numeric", month: "long" }
        : {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          };
  try {
    return new Intl.DateTimeFormat(lang, opts).format(date);
  } catch (_) {
    return date.toISOString();
  }
}

function resizeNodeLabelBackground(labelGroupSelection) {
  labelGroupSelection.each(function () {
    const g = d3.select(this);
    const labelEl = g.select(".node-label").node();
    const yearEl = g.select(".node-year").node();
    if (!labelEl) return;
    const b1 = labelEl.getBBox();
    const b2 = yearEl && yearEl.textContent ? yearEl.getBBox() : null;
    const padX = 5;
    const padY = 3;
    const x = Math.min(b1.x, b2 ? b2.x : b1.x) - padX;
    const y = Math.min(b1.y, b2 ? b2.y : b1.y) - padY;
    const right = Math.max(
      b1.x + b1.width,
      b2 ? b2.x + b2.width : b1.x + b1.width
    );
    const bottom = Math.max(
      b1.y + b1.height,
      b2 ? b2.y + b2.height : b1.y + b1.height
    );
    g.select(".node-label-bg")
      .attr("x", x)
      .attr("y", y)
      .attr("width", Math.max(right - x + padX, 8))
      .attr("height", Math.max(bottom - y + padY, 8));
  });
}

function nodeSecondaryLabel(d) {
  const t = window.t || ((k, p) => k);
  if (currentNarrativeTime) {
    const ageInfo = ageAtNarrative(d, currentNarrativeTime);
    const ageText = formatAgeShort(ageInfo, t);
    if (ageText) return ageText;
  }
  if (d.birthYear == null) return "";
  const mark = d.birthYearInferred ? "~" : "";
  return `${mark}${Math.round(d.birthYear)}`;
}

function refreshNodeAgeLabels() {
  const nodes = d3.selectAll(".node");
  if (nodes.empty()) return;
  nodes.select(".node-year").text((d) => nodeSecondaryLabel(d));
  nodes.classed("is-dead-at-time", (d) => {
    if (!currentNarrativeTime) return false;
    const info = ageAtNarrative(d, currentNarrativeTime);
    return info?.kind === "dead";
  });
  resizeNodeLabelBackground(nodes.select(".node-label-group"));
}

function setNarrativeTime(date, { updateSlider = true } = {}) {
  currentNarrativeTime = date;
  window.__narrativeTime = date;
  if (updateSlider && currentNarrative) {
    const bounds = narrativeBounds(currentNarrative);
    const slider = document.getElementById("narrativeSlider");
    if (bounds && slider) {
      const ratio = Math.min(
        1,
        Math.max(0, (+date - +bounds.start) / bounds.spanMs)
      );
      slider.value = String(Math.round(ratio * Number(slider.max || 1000)));
    }
  }
  updateNarrativePanelUI();
  refreshNodeAgeLabels();
  // Refresh open character sheet so ages follow the scrubber
  const modal = document.getElementById("modalContainer");
  if (modal && !modal.classList.contains("hidden") && lastFocusedNode) {
    const fresh =
      allNodes.find((n) => n.id === lastFocusedNode.id) || lastFocusedNode;
    showModalContent(fresh);
  }
}

function updateNarrativePanelUI() {
  const panel = document.getElementById("narrativePanel");
  if (!panel || !currentNarrative || !currentNarrativeTime) return;
  const t = window.t || ((k, p) => {
    if (!p) return k;
    return Object.entries(p).reduce(
      (s, [key, val]) => s.replace(`{${key}}`, val),
      k
    );
  });

  const when = document.getElementById("narrativeWhen");
  const span = document.getElementById("narrativeSpan");
  const meta = document.getElementById("narrativeMeta");
  const momentEl = document.getElementById("narrativeMoment");

  if (when) {
    when.textContent = formatNarrativeClock(
      currentNarrativeTime,
      currentNarrative
    );
  }
  if (span) {
    const spanLabel = localizeNarrativeField(currentNarrative.spanLabel);
    span.textContent = spanLabel
      ? t("narrativeSpan", { span: spanLabel })
      : "";
  }
  if (meta) {
    const bits = [];
    if (currentNarrative.location) {
      bits.push(
        t("narrativeLocation", {
          location: localizeNarrativeField(currentNarrative.location),
        })
      );
    }
    if (currentNarrative.note) {
      bits.push(localizeNarrativeField(currentNarrative.note));
    }
    meta.textContent = bits.join(" · ");
  }
  if (momentEl) {
    const moment = momentAtTime(currentNarrative, currentNarrativeTime);
    if (moment) {
      momentEl.innerHTML = `
        <div class="narrative-moment-label">${escapeHtmlGlobal(
          localizeNarrativeField(moment.label)
        )}</div>
        <div class="narrative-moment-summary">${escapeHtmlGlobal(
          localizeNarrativeField(moment.summary)
        )}</div>
      `;
    } else {
      momentEl.innerHTML = "";
    }
  }

  document.querySelectorAll(".narrative-tick").forEach((btn) => {
    const at = btn.dataset.at;
    const moment = momentAtTime(currentNarrative, currentNarrativeTime);
    btn.classList.toggle("is-active", moment && moment.at === at);
  });
}

function escapeHtmlGlobal(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bindNarrativePanel() {
  const slider = document.getElementById("narrativeSlider");
  if (!slider || slider.dataset.bound) return;
  slider.dataset.bound = "1";
  slider.addEventListener("input", () => {
    if (!currentNarrative) return;
    const bounds = narrativeBounds(currentNarrative);
    if (!bounds) return;
    const ratio = Number(slider.value) / Number(slider.max || 1000);
    const date = new Date(+bounds.start + ratio * bounds.spanMs);
    setNarrativeTime(date, { updateSlider: false });
  });
}

function setChapterNarrative(narrative) {
  currentNarrative = narrative || null;
  window.__chapterNarrative = currentNarrative;
  const panel = document.getElementById("narrativePanel");
  const ticks = document.getElementById("narrativeTicks");
  bindNarrativePanel();

  const bounds = narrativeBounds(currentNarrative);
  if (!panel) return;

  if (!bounds) {
    panel.classList.add("is-hidden");
    currentNarrativeTime = null;
    window.__narrativeTime = null;
    refreshNodeAgeLabels();
    return;
  }

  panel.classList.remove("is-hidden");
  if (ticks) {
    const moments = [...(currentNarrative.moments || [])].sort(
      (a, b) => +new Date(a.at) - +new Date(b.at)
    );
    ticks.innerHTML = moments
      .map((m) => {
        const label = localizeNarrativeField(m.label);
        return `<button type="button" class="narrative-tick" data-at="${escapeHtmlGlobal(
          m.at
        )}" title="${escapeHtmlGlobal(label)}"><span>${escapeHtmlGlobal(
          label
        )}</span></button>`;
      })
      .join("");
    ticks.querySelectorAll(".narrative-tick").forEach((btn) => {
      btn.addEventListener("click", () => {
        const date = new Date(btn.dataset.at);
        if (!Number.isNaN(+date)) setNarrativeTime(date);
      });
    });
  }

  setNarrativeTime(bounds.start);
}

function findChapterNarrative(filePath) {
  const file = String(filePath || "");
  const books = window.__catalogBooks || [];
  for (const book of books) {
    for (const ch of book.chapters || []) {
      const chFile = String(ch.file || "").replace(/\\/g, "/");
      const norm = chFile.startsWith("/ged/")
        ? chFile
        : `/ged/${chFile.replace(/^\/+/, "")}`;
      if (norm === file || chFile === file) {
        return ch.narrative || null;
      }
    }
  }
  return null;
}

function inferBirthYears(nodes, links) {
  const years = new Map();
  nodes.forEach((n) => {
    const y = parseBirthYear(n.birth?.date);
    if (y != null) years.set(n.id, y);
  });

  const familyLinks = links.filter((l) => l.type === "family");
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    familyLinks.forEach((l) => {
      const sid = typeof l.source === "object" ? l.source.id : l.source;
      const tid = typeof l.target === "object" ? l.target.id : l.target;
      const sy = years.get(sid);
      const ty = years.get(tid);
      if (l.relation === "Parent") {
        if (sy != null && ty == null) {
          years.set(tid, sy + 25);
          changed = true;
        } else if (ty != null && sy == null) {
          years.set(sid, ty - 25);
          changed = true;
        }
      } else if (l.relation === "Spouse") {
        if (sy != null && ty == null) {
          years.set(tid, sy);
          changed = true;
        } else if (ty != null && sy == null) {
          years.set(sid, ty);
          changed = true;
        }
      } else if (l.relation === "Sibling") {
        if (sy != null && ty == null) {
          years.set(tid, sy + 2);
          changed = true;
        } else if (ty != null && sy == null) {
          years.set(sid, ty - 2);
          changed = true;
        }
      }
    });
    if (!changed) break;
  }

  const known = [...years.values()];
  const fallback =
    known.length > 0
      ? known.reduce((a, b) => a + b, 0) / known.length
      : 1300;
  nodes.forEach((n) => {
    if (!years.has(n.id)) years.set(n.id, fallback);
    n.birthYear = years.get(n.id);
    n.birthYearInferred = parseBirthYear(n.birth?.date) == null;
  });
  return years;
}

function getLayoutMode() {
  return currentLayoutMode === "force" ? "force" : "hierarchy";
}

function setLayoutMode(mode) {
  currentLayoutMode = mode === "force" ? "force" : "hierarchy";
  localStorage.setItem("cm_layout", currentLayoutMode);
  document.querySelectorAll("[data-layout]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.layout === currentLayoutMode);
  });
  return currentLayoutMode;
}

function getHorizontalSpread() {
  return currentHorizontalSpread;
}

function setHorizontalSpread(value) {
  const n = Number(value);
  currentHorizontalSpread = Number.isFinite(n)
    ? Math.min(3.5, Math.max(1, n))
    : 2;
  localStorage.setItem("cm_h_spread", String(currentHorizontalSpread));
  const slider = document.getElementById("spreadSlider");
  if (slider) slider.value = String(Math.round(currentHorizontalSpread * 100));
  const readout = document.getElementById("spreadValue");
  if (readout) readout.textContent = `${currentHorizontalSpread.toFixed(1)}×`;
  return currentHorizontalSpread;
}

function rebuildCurrentGraph() {
  if (!window.allNodes?.length) return;
  const focusedId = lastFocusedNode?.id || null;
  const focusedLink = lastFocusedLink
    ? {
        source: linkEnds(lastFocusedLink).sourceId,
        target: linkEnds(lastFocusedLink).targetId,
      }
    : null;

  createGraph({
    nodes: window.allNodes.map((n) => ({
      ...n,
      fx: null,
      fy: null,
      vx: 0,
      vy: 0,
    })),
    links: window.allLinks.map((l) => ({
      source: typeof l.source === "object" ? l.source.id : l.source,
      target: typeof l.target === "object" ? l.target.id : l.target,
      relation: l.relation,
      type: l.type,
      notes: l.notes,
      citations: l.citations,
    })),
  });

  // Re-bind focus after DOM rebuild (e.g. modal open → resize)
  if (focusedId) {
    lastFocusedNode = allNodes.find((n) => n.id === focusedId) || null;
  }
  if (focusedLink) {
    lastFocusedLink =
      allLinks.find((l) => {
        const e = linkEnds(l);
        return (
          (e.sourceId === focusedLink.source &&
            e.targetId === focusedLink.target) ||
          (e.sourceId === focusedLink.target &&
            e.targetId === focusedLink.source)
        );
      }) || null;
  }
  restorePersistentEmphasis();
}

/** Spread nodes across layout width by birth-year cohorts (hierarchy). */
function assignCohortX(nodes, marginLeft, layoutWidth) {
  const band = Math.max(
    8,
    (Math.max(...nodes.map((n) => n.birthYear)) -
      Math.min(...nodes.map((n) => n.birthYear))) /
      12
  );
  const cohorts = new Map();
  nodes.forEach((n) => {
    const key = Math.round(n.birthYear / band) * band;
    if (!cohorts.has(key)) cohorts.set(key, []);
    cohorts.get(key).push(n);
  });
  cohorts.forEach((group) => {
    group.sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "fr")
    );
    const n = group.length;
    group.forEach((node, i) => {
      const t = n === 1 ? 0.5 : (i + 0.5) / n;
      // Use most of the layout width; leave side padding for labels
      node.x = marginLeft + 40 + t * (layoutWidth - 80);
    });
  });
}

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
          firstMentions: [],
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
          notes: [],
          citations: [],
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
              currentIndividual._currentQuote = {
                text: value,
                type: null,
              };
              currentIndividual.quotes.push(currentIndividual._currentQuote);
              currentContext = "quote";
              currentField = null;
              break;
            case "ASSO":
              currentIndividual.associations.push({
                person: value,
                relation: null,
                notes: [],
                citations: [],
              });
              currentContext = "association";
              break;
            case "EVEN":
              currentEvent = {
                value: value,
                type: null,
                date: null,
                place: null,
                notes: [],
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
              if (currentIndividual._currentQuote) {
                if (tag === "TYPE") {
                  currentIndividual._currentQuote.type = value;
                } else if (tag === "CONC") {
                  currentIndividual._currentQuote.text += value;
                } else if (tag === "CONT") {
                  currentIndividual._currentQuote.text += " " + value;
                }
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
                if (tag === "QUOT") {
                  assoc.citations.push(value);
                  currentField = assoc.citations;
                }
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
                if (tag === "NOTE") {
                  if (!currentEvent.notes) currentEvent.notes = [];
                  currentEvent.notes.push(value);
                  currentField = currentEvent.notes;
                }
                if (tag === "QUOT") {
                  if (!currentEvent.citations) currentEvent.citations = [];
                  currentEvent.citations.push(value);
                  currentField = currentEvent.citations;
                }
              }
              break;
          }
        } else if (level === "3" && currentContext === "association") {
          const assoc = currentIndividual.associations.at(-1);
          if (assoc?.citations?.length) {
            if (tag === "CONC") {
              assoc.citations[assoc.citations.length - 1] += value;
            } else if (tag === "CONT") {
              assoc.citations[assoc.citations.length - 1] += " " + value;
            }
          }
        }
      } else if (currentFamily && level === "1") {
        if (!currentFamily.notes) currentFamily.notes = [];
        if (!currentFamily.citations) currentFamily.citations = [];
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
          case "NOTE":
            currentFamily.notes.push(value);
            currentContext = "family-note";
            currentField = currentFamily.notes;
            break;
          case "QUOT":
            currentFamily.citations.push(value);
            currentContext = "family-quote";
            currentField = currentFamily.citations;
            break;
        }
      } else if (
        currentFamily &&
        level === "2" &&
        (currentContext === "family-note" || currentContext === "family-quote")
      ) {
        if (tag === "CONC" && currentField?.length) {
          currentField[currentField.length - 1] += value;
        } else if (tag === "CONT" && currentField) {
          currentField.push(value);
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

  // Normalise quotes + extrait les « premières mentions » (preuve d'apparition)
  const isFirstMentionType = (type) =>
    /premi[eè]re\s+mention|first\s+mention|primera\s+menci[oó]n/i.test(
      String(type || "")
    );
  const stripOuterQuotes = (s) =>
    String(s || "")
      .trim()
      .replace(/^["«»']+|["«»']+$/g, "")
      .trim();
  const pushUnique = (arr, value) => {
    const v = stripOuterQuotes(value);
    if (!v) return;
    if (!arr.includes(v)) arr.push(v);
  };

  Object.values(individuals).forEach((individual) => {
    const dialogueQuotes = [];
    const firstMentions = [];

    (individual.quotes || []).forEach((q) => {
      if (typeof q === "string") {
        pushUnique(dialogueQuotes, q);
        return;
      }
      const text = q?.text || "";
      if (isFirstMentionType(q?.type)) pushUnique(firstMentions, text);
      else pushUnique(dialogueQuotes, text);
    });

    (individual.events || []).forEach((e) => {
      if (!isFirstMentionType(e.type)) return;
      (e.notes || []).forEach((n) => pushUnique(firstMentions, n));
      (e.citations || []).forEach((c) => pushUnique(firstMentions, c));
    });

    individual.quotes = dialogueQuotes;
    individual.firstMentions = firstMentions;
    delete individual._currentQuote;
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
        notes: assoc.notes || [],
        citations: assoc.citations || [],
      });
    });
  });

  // Familles
  Object.values(families).forEach((fam) => {
    const { husband, wife, children } = fam;
    const famNotes = fam.notes || [];
    const famCitations = fam.citations || [];

    // Couple
    if (husband && wife) {
      links.push({
        source: husband,
        target: wife,
        relation: "Spouse",
        type: "family",
        notes: famNotes,
        citations: famCitations,
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
          notes: famNotes,
          citations: famCitations,
        });
      }
      if (wife) {
        links.push({
          source: wife,
          target: child,
          relation: "Parent",
          type: "family",
          notes: famNotes,
          citations: famCitations,
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
          notes: famNotes,
          citations: famCitations,
        });
      }
    }
  });

  return { nodes, links };
}

function getGraphSize() {
  const el = document.getElementById("graphContainer");
  if (el) {
    const rect = el.getBoundingClientRect();
    return {
      width: Math.max(rect.width || 0, 320),
      height: Math.max(rect.height || 0, 320),
    };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

function createGraph(data) {
  const svg = d3.select("#graphContainer svg");
  const { width, height } = getGraphSize();
  const layoutMode = getLayoutMode();

  if (simulation) simulation.stop();
  svg.selectAll("*").remove();
  d3.selectAll("body > .tooltip").remove();

  // Remove invalid links
  const nodeIds = new Set(data.nodes.map((n) => n.id));
  data.links = data.links.filter((l) => {
    const sid = typeof l.source === "object" ? l.source.id : l.source;
    const tid = typeof l.target === "object" ? l.target.id : l.target;
    return nodeIds.has(sid) && nodeIds.has(tid);
  });

  // Deduplicate symmetric family edges for cleaner hierarchy drawing
  if (layoutMode === "hierarchy") {
    const seen = new Set();
    data.links = data.links.filter((l) => {
      const sid = typeof l.source === "object" ? l.source.id : l.source;
      const tid = typeof l.target === "object" ? l.target.id : l.target;
      if (l.type !== "family") return true;
      const key = [sid, tid].sort().join("|") + "|" + (l.relation || "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  allNodes = data.nodes;
  allLinks = data.links;
  inferBirthYears(data.nodes, data.links);

  const years = data.nodes.map((n) => n.birthYear).filter((y) => y != null);
  const minYear = years.length ? Math.min(...years) : 1200;
  const maxYear = years.length ? Math.max(...years) : 1400;
  const yearSpan = Math.max(maxYear - minYear, 1);

  const spread = getHorizontalSpread();
  const margin = {
    top: 56,
    right: 120,
    bottom: 56,
    left: layoutMode === "hierarchy" ? 72 : 40,
  };
  const innerH = Math.max(height - margin.top - margin.bottom, 200);
  // Virtual canvas wider than the viewport — pan horizontally to explore
  const layoutWidth = Math.max(
    (width - margin.left - margin.right) * spread,
    320
  );
  const worldCenterX = margin.left + layoutWidth / 2;

  // Initial positions
  const sorted = [...data.nodes].sort((a, b) => a.birthYear - b.birthYear);
  sorted.forEach((n) => {
    const t = (n.birthYear - minYear) / yearSpan;
    if (layoutMode === "hierarchy") {
      n.fy = margin.top + t * innerH;
      n.y = n.fy;
      n.fx = null;
    } else {
      n.fy = null;
      n.fx = null;
      n.x = worldCenterX + (Math.random() - 0.5) * layoutWidth * 0.55;
      n.y = height / 2 + (Math.random() - 0.5) * height * 0.45;
    }
  });
  if (layoutMode === "hierarchy") {
    assignCohortX(sorted, margin.left, layoutWidth);
  }

  const zoomRoot = svg.append("g").attr("class", "zoom-root");
  const container = zoomRoot.append("g").attr("class", "graph-root");
  const zoom = d3
    .zoom()
    .scaleExtent([0.15, 4])
    .on("zoom", (e) => {
      zoomRoot.attr("transform", e.transform);
    });
  svg.call(zoom);

  // Timeline axis for hierarchy mode
  if (layoutMode === "hierarchy") {
    const axis = container.append("g").attr("class", "timeline-axis");
    const tickCount = Math.min(8, Math.round(yearSpan / 10) + 1);
    for (let i = 0; i <= tickCount; i++) {
      const year = Math.round(minYear + (yearSpan * i) / tickCount);
      const y = margin.top + (innerH * i) / tickCount;
      axis
        .append("line")
        .attr("class", "timeline-guide")
        .attr("x1", margin.left - 12)
        .attr("x2", margin.left + layoutWidth)
        .attr("y1", y)
        .attr("y2", y);
      axis
        .append("text")
        .attr("class", "timeline-label")
        .attr("x", 12)
        .attr("y", y + 4)
        .text(String(year));
    }
    axis
      .append("text")
      .attr("class", "timeline-caption")
      .attr("x", 12)
      .attr("y", 22)
      .text(window.t ? window.t("timelineEarlier") : "Earlier →");
    axis
      .append("text")
      .attr("class", "timeline-caption")
      .attr("x", 12)
      .attr("y", height - 18)
      .text(window.t ? window.t("timelineLater") : "→ Later");
  }

  const familyLinks = data.links.filter((l) => l.type === "family");
  const assocLinks = data.links.filter((l) => l.type !== "family");

  if (layoutMode === "hierarchy") {
    simulation = d3
      .forceSimulation(data.nodes)
      .force(
        "linkFamily",
        d3
          .forceLink(familyLinks)
          .id((d) => d.id)
          .distance((d) =>
            d.relation === "Spouse" ? 90 * spread : 130 * Math.sqrt(spread)
          )
          .strength((d) => (d.relation === "Spouse" ? 0.55 : 0.22))
      )
      .force(
        "linkAssoc",
        d3
          .forceLink(assocLinks)
          .id((d) => d.id)
          .distance(200 * Math.sqrt(spread))
          .strength(0.03)
      )
      .force("charge", d3.forceManyBody().strength(-520 * spread))
      .force(
        "collide",
        d3
          .forceCollide()
          .radius(
            (d) =>
              22 +
              Math.min(String(d.name || "").length, 22) * (1.35 + spread * 0.35)
          )
          .strength(0.95)
      )
      .force(
        "y",
        d3
          .forceY((d) => {
            const t = (d.birthYear - minYear) / yearSpan;
            return margin.top + t * innerH;
          })
          .strength(0.95)
      )
      // Very light centering so nodes can occupy the full layout width
      .force("x", d3.forceX(worldCenterX).strength(0.012 / spread));
  } else {
    simulation = d3
      .forceSimulation(data.nodes)
      .force(
        "link",
        d3
          .forceLink(data.links)
          .id((d) => d.id)
          .distance(160 * Math.sqrt(spread))
          .strength(0.28)
      )
      .force("charge", d3.forceManyBody().strength(-320 * spread))
      .force(
        "collide",
        d3
          .forceCollide()
          .radius(
            (d) =>
              30 + Math.min(String(d.name || "").length, 20) * (0.9 + spread * 0.25)
          )
          .strength(0.85)
      )
      .force("center", d3.forceCenter(worldCenterX, height / 2).strength(0.35));
  }

  const linkPath = (d) => {
    const sx = d.source.x;
    const sy = d.source.y;
    const tx = d.target.x;
    const ty = d.target.y;
    if (layoutMode !== "hierarchy") {
      return `M${sx},${sy}L${tx},${ty}`;
    }
    // Smooth vertical-ish curves to reduce crossings visually
    const midY = (sy + ty) / 2;
    const bend = (sx + tx) / 2 + (sx < tx ? -18 : 18);
    return `M${sx},${sy}C${sx},${midY} ${bend},${midY} ${tx},${ty}`;
  };

  const linksLayer = container.append("g").attr("class", "links");

  // Wide invisible hit targets (esp. for thin dashed association lines)
  const linkHit = linksLayer
    .selectAll("path.link-hit")
    .data(data.links)
    .enter()
    .append("path")
    .attr("class", (d) => `link-hit link-hit-${d.type || "association"}`)
    .attr("fill", "none")
    .attr("stroke", "transparent")
    .attr("stroke-width", (d) => (d.type === "family" ? 12 : 18))
    .attr("stroke-linecap", "round")
    .style("cursor", "pointer");

  const link = linksLayer
    .selectAll("path.link")
    .data(data.links)
    .enter()
    .append("path")
    .attr("class", (d) => `link link-${d.type || "association"}`)
    .attr("fill", "none")
    .attr("stroke", (d) => (d.type === "family" ? "#b42318" : "#5c6b7a"))
    .attr("stroke-width", (d) => (d.type === "family" ? 2.2 : 1.6))
    .attr("stroke-opacity", (d) => (d.type === "family" ? 0.85 : 0.42))
    .attr("stroke-dasharray", (d) => (d.type === "family" ? null : "5 4"))
    .style("pointer-events", "none");

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
    .attr("r", 9)
    .attr("fill", (d) => (d.sex === "M" ? "#2563eb" : "#db2777"))
    .attr("stroke", "#fff")
    .attr("stroke-width", 2);

  const labelGroup = node.append("g").attr("class", "node-label-group");

  labelGroup
    .append("rect")
    .attr("class", "node-label-bg")
    .attr("rx", 5)
    .attr("ry", 5);

  labelGroup
    .append("text")
    .attr("class", "node-label")
    .attr("x", 14)
    .attr("y", 4)
    .text((d) => d.name);

  labelGroup
    .append("text")
    .attr("class", "node-year")
    .attr("x", 14)
    .attr("y", 18)
    .text((d) => nodeSecondaryLabel(d));

  resizeNodeLabelBackground(labelGroup);
  if (currentNarrativeTime) {
    node.classed("is-dead-at-time", (d) => {
      const info = ageAtNarrative(d, currentNarrativeTime);
      return info?.kind === "dead";
    });
  }

  node
    .append("text")
    .attr("x", -6)
    .attr("y", 4)
    .attr("class", "cross")
    .text((d) => (d.death && d.death.status ? "✝" : ""));

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
    .on("mouseenter", (event, d) => {
      if (suppressHoverLeave > 0) return;
      cancelHoverRestore();
      const yearLabel =
        d.birthYear != null
          ? `${d.birthYearInferred ? "~" : ""}${Math.round(d.birthYear)}`
          : "?";
      tooltip.style("display", "block");
      tooltip.html(
        `<strong>${d.name}</strong><br>${d.occupation || ""}<br>${
          window.t ? window.t("birth") : "Birth"
        }: ${yearLabel}`
      );
      // Preview neighborhood on hover (pinned focus still wins after leave)
      emphasizeNeighborhood(d.id, { raiseId: d.id, duration: 110 });
    })
    .on("mousemove", (event) => {
      tooltip
        .style("top", event.pageY + 10 + "px")
        .style("left", event.pageX + 10 + "px");
    })
    .on("mouseleave", () => {
      if (suppressHoverLeave > 0) return;
      tooltip.style("display", "none");
      scheduleHoverRestore();
    });

  let pressTimer;
  const longPressDuration = 500;

  node.on("click", (event, d) => {
    // d3-drag marks defaultPrevented when a real drag happened
    if (event.defaultPrevented || nodeDragMoved) return;
    cancelHoverRestore();
    event.stopPropagation();
    focusNode(d);
  });

  node
    .on("mousedown", (event, d) => {
      pressTimer = setTimeout(() => {
        cancelHoverRestore();
        focusNode(d);
      }, longPressDuration);
    })
    .on("mouseup", () => clearTimeout(pressTimer))
    .on("mouseleave", () => clearTimeout(pressTimer));

  node
    .on("touchstart", (event, d) => {
      pressTimer = setTimeout(() => {
        cancelHoverRestore();
        focusNode(d);
      }, longPressDuration);
    })
    .on("touchend", () => clearTimeout(pressTimer));

  simulation.on("tick", () => {
    if (layoutMode === "hierarchy") {
      data.nodes.forEach((d) => {
        const t = (d.birthYear - minYear) / yearSpan;
        const targetY = margin.top + t * innerH;
        d.y += (targetY - d.y) * 0.35;
        d.x = Math.max(
          margin.left + 24,
          Math.min(margin.left + layoutWidth - 24, d.x)
        );
      });
    } else {
      data.nodes.forEach((d) => {
        d.x = Math.max(24, Math.min(margin.left + layoutWidth + margin.right, d.x));
        d.y = Math.max(24, Math.min(height - 24, d.y));
      });
    }

    link.attr("d", linkPath);
    linkHit.attr("d", linkPath);
    node.attr("transform", (d) => `translate(${d.x},${d.y})`);
  });

  // Fit view: prefer readable height; keep horizontal spacing (pan to explore)
  simulation.on("end", () => {
    try {
      const xs = data.nodes.map((n) => n.x);
      const ys = data.nodes.map((n) => n.y);
      const minX = Math.min(...xs) - 100;
      const maxX = Math.max(...xs) + 180;
      const minY = Math.min(...ys) - 60;
      const maxY = Math.max(...ys) + 60;
      const bw = Math.max(maxX - minX, 1);
      const bh = Math.max(maxY - minY, 1);
      // Fit height first so labels stay readable; width may overflow → pan
      const scaleH = (height * 0.9) / bh;
      const scaleW = (width * 0.92) / bw;
      // Allow mild zoom-out for width, but never crush below ~55% of height fit
      const scale = Math.min(scaleH, Math.max(scaleW, scaleH * 0.55), 1.55);
      const tx = (width - bw * scale) / 2 - minX * scale;
      const ty = (height - bh * scale) / 2 - minY * scale;
      svg
        .transition()
        .duration(450)
        .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    } catch (_) {
      /* ignore fit errors */
    }
  });

  enrichLinkTooltips();
}

function linkEnds(link) {
  return {
    sourceId: typeof link.source === "object" ? link.source.id : link.source,
    targetId: typeof link.target === "object" ? link.target.id : link.target,
  };
}

function neighborIdsFor(nodeId) {
  const ids = new Set([nodeId]);
  allLinks.forEach((link) => {
    const { sourceId, targetId } = linkEnds(link);
    if (!sourceId || !targetId) return;
    if (sourceId === nodeId) ids.add(targetId);
    if (targetId === nodeId) ids.add(sourceId);
  });
  return ids;
}

function emphasizeGraph({
  nodeIds = null,
  linkKeep = null,
  raiseId = null,
  duration = 140,
} = {}) {
  const keepNode = nodeIds
    ? (id) => nodeIds.has(id)
    : () => true;
  const keepLink =
    linkKeep ||
    ((l) => {
      if (!nodeIds) return true;
      const { sourceId, targetId } = linkEnds(l);
      return keepNode(sourceId) && keepNode(targetId);
    });

  d3.selectAll(".node")
    .classed("is-emphasized", (d) => keepNode(d.id))
    .classed("is-dimmed", (d) => !keepNode(d.id))
    .interrupt()
    .transition()
    .duration(duration)
    .style("opacity", (d) => (keepNode(d.id) ? 1 : 0.12));

  d3.selectAll(".link")
    .classed("is-emphasized", (l) => keepLink(l))
    .classed("is-dimmed", (l) => !keepLink(l))
    .interrupt()
    .transition()
    .duration(duration)
    .style("opacity", (l) => (keepLink(l) ? 1 : 0.07));

  // raise() reparents SVG nodes and can synthesize mouseleave — suppress briefly
  suppressHoverLeave += 1;
  try {
    d3.selectAll(".link")
      .filter((l) => keepLink(l))
      .raise();

    const nodesLayer = d3.select("g.nodes");
    if (!nodesLayer.empty()) nodesLayer.raise();

    if (nodeIds) {
      d3.selectAll(".node")
        .filter((d) => keepNode(d.id) && d.id !== raiseId)
        .raise();
      if (raiseId) {
        d3.selectAll(".node")
          .filter((d) => d.id === raiseId)
          .raise();
      }
    }
  } finally {
    requestAnimationFrame(() => {
      suppressHoverLeave = Math.max(0, suppressHoverLeave - 1);
    });
  }
}

function cancelHoverRestore() {
  clearTimeout(hoverRestoreTimer);
  hoverRestoreTimer = null;
}

function scheduleHoverRestore() {
  if (suppressHoverLeave > 0) return;
  cancelHoverRestore();
  hoverRestoreTimer = setTimeout(() => {
    hoverRestoreTimer = null;
    if (suppressHoverLeave > 0) return;
    restorePersistentEmphasis();
  }, 80);
}

function emphasizeNeighborhood(nodeId, { raiseId = nodeId, duration = 140 } = {}) {
  const ids = neighborIdsFor(nodeId);
  emphasizeGraph({
    nodeIds: ids,
    linkKeep: (l) => {
      const { sourceId, targetId } = linkEnds(l);
      return sourceId === nodeId || targetId === nodeId;
    },
    raiseId,
    duration,
  });
}

function clearGraphEmphasis(duration = 160) {
  d3.selectAll(".node, .link")
    .classed("is-dimmed", false)
    .classed("is-emphasized", false)
    .interrupt()
    .transition()
    .duration(duration)
    .style("opacity", 1);
  d3.selectAll(".node circle, .node text")
    .interrupt()
    .transition()
    .duration(duration)
    .style("opacity", null);
}

function restorePersistentEmphasis() {
  if (lastFocusedNode) {
    const id = lastFocusedNode.id;
    lastFocusedNode = allNodes.find((n) => n.id === id) || lastFocusedNode;
    emphasizeNeighborhood(id, {
      raiseId: id,
      duration: 120,
    });
    return;
  }
  if (lastFocusedLink) {
    const { sourceId, targetId } = linkEnds(lastFocusedLink);
    lastFocusedLink =
      allLinks.find((l) => {
        const e = linkEnds(l);
        return (
          (e.sourceId === sourceId && e.targetId === targetId) ||
          (e.sourceId === targetId && e.targetId === sourceId)
        );
      }) || lastFocusedLink;
    emphasizeGraph({
      nodeIds: new Set([sourceId, targetId]),
      linkKeep: (l) => {
        const e = linkEnds(l);
        return (
          (e.sourceId === sourceId && e.targetId === targetId) ||
          (e.sourceId === targetId && e.targetId === sourceId)
        );
      },
      raiseId: sourceId,
      duration: 120,
    });
    return;
  }
  clearGraphEmphasis();
}

function enrichLinkTooltips() {
  const tooltip = d3.select(".tooltip");

  d3.selectAll(".link-hit")
    .on("mouseenter", function (event, d) {
      cancelHoverRestore();
      const { sourceId, targetId } = linkEnds(d);
      const source = allNodes.find((n) => n.id === sourceId);
      const target = allNodes.find((n) => n.id === targetId);
      if (!source || !target) return;

      const tr = window.translateRelation || ((r) => r);
      const sourceToTarget = d.relation
        ? `${source.name} → ${target.name} : ${tr(d.relation)}`
        : "";
      const reverseLink = allLinks.find((l) => {
        const e = linkEnds(l);
        return e.sourceId === targetId && e.targetId === sourceId;
      });
      const targetToSource = reverseLink?.relation
        ? `${target.name} → ${source.name} : ${tr(reverseLink.relation)}`
        : "";

      const evidenceHtml = formatRelationEvidenceHtml(d, reverseLink);
      tooltip
        .style("display", "block")
        .html(
          `<strong>${sourceToTarget}</strong><br><strong>${targetToSource}</strong>${evidenceHtml}`
        );

      emphasizeGraph({
        nodeIds: new Set([sourceId, targetId]),
        linkKeep: (l) => {
          const e = linkEnds(l);
          return (
            (e.sourceId === sourceId && e.targetId === targetId) ||
            (e.sourceId === targetId && e.targetId === sourceId)
          );
        },
        raiseId: sourceId,
        duration: 110,
      });
      d3.selectAll(".node")
        .filter((n) => n.id === sourceId || n.id === targetId)
        .raise();
    })
    .on("mousemove", function (event) {
      tooltip
        .style("top", event.pageY + 10 + "px")
        .style("left", event.pageX + 10 + "px");
    })
    .on("mouseleave", function () {
      tooltip.style("display", "none");
      scheduleHoverRestore();
    })
    .on("click", function (event, d) {
      lastFocusedLink = d;
      lastFocusedNode = null;
      const { sourceId, targetId } = linkEnds(d);
      const source = allNodes.find((n) => n.id === sourceId);
      const target = allNodes.find((n) => n.id === targetId);
      const reverseLink = allLinks.find((l) => {
        const e = linkEnds(l);
        return e.sourceId === targetId && e.targetId === sourceId;
      });

      const tr = window.translateRelation || ((r) => r || "?");
      const evidenceHtml = formatRelationEvidenceHtml(d, reverseLink);

      showModalContent(
        source,
        target,
        `${source.name} → ${target.name} : ${tr(d.relation)}<br>${
          target.name
        } → ${source.name} : ${tr(reverseLink?.relation)}${evidenceHtml}`
      );

      emphasizeGraph({
        nodeIds: new Set([sourceId, targetId]),
        linkKeep: (l) => {
          const e = linkEnds(l);
          return (
            (e.sourceId === sourceId && e.targetId === targetId) ||
            (e.sourceId === targetId && e.targetId === sourceId)
          );
        },
        raiseId: sourceId,
        duration: 220,
      });

      event.stopPropagation();
    });
}

function formatDateForUi(dateStr) {
  if (window.formatGedDate) return window.formatGedDate(dateStr);
  return dateStr || "?";
}

function collectRelationEvidence(link, reverseLink) {
  const notes = [];
  const citations = [];
  const pushUnique = (arr, value) => {
    const v = String(value || "").trim();
    if (!v) return;
    if (!arr.includes(v)) arr.push(v);
  };
  [link, reverseLink].forEach((l) => {
    (l?.notes || []).forEach((n) => pushUnique(notes, n));
    (l?.citations || []).forEach((c) => pushUnique(citations, c));
  });
  // Backward-compatible: notes that look like quotations
  notes
    .filter((n) => /^[«"]/.test(n) || /\u201c/.test(n))
    .forEach((n) => {
      pushUnique(citations, n.replace(/^Citation\s*:\s*/i, ""));
    });
  return { notes, citations };
}

function formatRelationEvidenceHtml(link, reverseLink) {
  const t = window.t || ((k) => k);
  const { notes, citations } = collectRelationEvidence(link, reverseLink);
  let html = "";
  if (notes.length) {
    html += `<div class="evidence-block"><div class="evidence-label">${t(
      "relationContext"
    )}</div><ul>${notes.map((n) => `<li>${n}</li>`).join("")}</ul></div>`;
  }
  if (citations.length) {
    html += `<div class="evidence-block evidence-quote"><div class="evidence-label">${t(
      "bookEvidence"
    )}</div><ul>${citations
      .map((c) => `<li><em>« ${c.replace(/^[«»"']+|["'«»]+$/g, "")} »</em></li>`)
      .join("")}</ul></div>`;
  } else {
    html += `<div class="evidence-block evidence-missing"><div class="evidence-label">${t(
      "bookEvidence"
    )}</div><p>${t("missingBookEvidence")}</p></div>`;
  }
  return html;
}

function formatPlaceAfterDate(place) {
  if (!place) return "?";
  const lang = window.getLang ? window.getLang() : "en";
  // FR/ES: comma avoids à/en/aux ambiguity between city and country
  if (lang === "fr" || lang === "es") return `, ${place}`;
  const at = window.t ? window.t("at") : "at";
  return ` ${at} ${place}`;
}

function localizeNoteLine(note) {
  if (!note) return note;
  // Backward-compat for older English-structured NOTE/CONT lines
  return String(note)
    .replace(/\bPhysical traits:/gi, "Traits physiques :")
    .replace(/\bMental traits:/gi, "Traits mentaux :")
    .replace(/\bPolitical views:/gi, "Opinions politiques :")
    .replace(/\bMain decisive actions:/gi, "Actions décisives principales :")
    .replace(/\bRole:/gi, "Rôle :")
    .replace(/\bN\/A\b/g, "Non précisé");
}

function sheetIcon(name) {
  const icons = {
    user: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12Zm0 2.25c-3.6 0-6.75 1.8-6.75 4.125V20h13.5v-1.625C18.75 16.05 15.6 14.25 12 14.25Z"/></svg>`,
    birth: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3.2 4.8 8.4V20h5.4v-5.4h3.6V20h5.4V8.4L12 3.2Z"/></svg>`,
    death: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M11 2h2v5.2l3.4-3.4 1.4 1.4-3.4 3.4H20v2h-5.6l3.4 3.4-1.4 1.4-3.4-3.4V20h-2v-5.6l-3.4 3.4-1.4-1.4 3.4-3.4H4v-2h5.6L6.2 8.6l1.4-1.4 3.4 3.4V2Z"/></svg>`,
    notes: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 3.5h9.2L19 7.3V20.5H6Zm8.2 1.2V8H17.8ZM8 11h8v1.5H8Zm0 3h8v1.5H8Zm0 3h5.5V18.5H8Z"/></svg>`,
    events: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 3v2H5.5A1.5 1.5 0 0 0 4 6.5v13A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 18.5 5H17V3h-2v2H9V3Zm-1.5 7h13v9.5h-13Zm3 2.2v5.3l4.6-2.65Z"/></svg>`,
    bookmark: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 3.5h10A1.5 1.5 0 0 1 18.5 5v15.2l-6.5-3.5-6.5 3.5V5A1.5 1.5 0 0 1 7 3.5Z"/></svg>`,
    quote: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8.8 17.5H5.2l2.1-5.2H5.5V7h5.3v5.3Zm9.5 0h-3.6l2.1-5.2h-2.3V7H19.5v5.3Z"/></svg>`,
    brief: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 4.5h6a1 1 0 0 1 1 1V7h2.5A1.5 1.5 0 0 1 20 8.5v10A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-10A1.5 1.5 0 0 1 5.5 7H8V5.5a1 1 0 0 1 1-1ZM9.5 7h5V6h-5Z"/></svg>`,
  };
  return icons[name] || icons.notes;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripQuoteMarks(value) {
  return String(value || "")
    .trim()
    .replace(/^[«»"']+|["'«»]+$/g, "")
    .trim();
}

function isFirstMentionEvent(event) {
  return /premi[eè]re\s+mention|first\s+mention|primera\s+menci[oó]n/i.test(
    String(event?.type || "")
  );
}

function renderSheetSection(icon, title, bodyHtml, extraClass = "") {
  if (!bodyHtml) return "";
  return `
    <section class="sheet-section ${extraClass}">
      <header class="sheet-section-head">
        <span class="sheet-icon">${sheetIcon(icon)}</span>
        <h3>${escapeHtml(title)}</h3>
      </header>
      <div class="sheet-section-body">${bodyHtml}</div>
    </section>
  `;
}

function renderNotesBody(notes, t) {
  if (!notes?.length) {
    return `<p class="sheet-empty">${escapeHtml(t("noNotes"))}</p>`;
  }

  const labelRe =
    /^(Traits physiques|Traits mentaux|Rôle|Opinions politiques|Actions décisives principales)\s*:\s*(.*)$/i;
  const blocks = [];

  notes.forEach((raw) => {
    const text = localizeNoteLine(raw);
    const lines = String(text)
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    let lead = [];
    const attrs = [];

    lines.forEach((line) => {
      // One CONT line can hold several "Label : value" segments
      const parts = line.split(/(?=(?:Traits physiques|Traits mentaux|Rôle|Opinions politiques|Actions décisives principales)\s*:)/i);
      parts.forEach((part) => {
        const trimmed = part.trim();
        if (!trimmed) return;
        const m = trimmed.match(labelRe);
        if (m) {
          attrs.push({ label: m[1], value: m[2].trim() });
        } else if (!attrs.length) {
          lead.push(trimmed);
        } else {
          attrs[attrs.length - 1].value += ` ${trimmed}`;
        }
      });
    });

    if (lead.length) {
      blocks.push(
        `<p class="sheet-note-lead">${escapeHtml(lead.join(" "))}</p>`
      );
    }
    if (attrs.length) {
      blocks.push(`
        <dl class="sheet-attr-list">
          ${attrs
            .map(
              (a) => `
            <div class="sheet-attr">
              <dt>${escapeHtml(a.label)}</dt>
              <dd>${escapeHtml(a.value || t("unknown"))}</dd>
            </div>`
            )
            .join("")}
        </dl>
      `);
    }
  });

  return blocks.join("") || `<p class="sheet-empty">${escapeHtml(t("noNotes"))}</p>`;
}

function renderPersonProfile(person) {
  const t = window.t || ((k) => k);
  const birthDate = person.birth?.date
    ? formatDateForUi(person.birth.date)
    : "?";
  const deathDate = person.death?.date
    ? formatDateForUi(person.death.date)
    : "?";
  const sexLabel =
    person.sex === "M" ? "M" : person.sex === "F" ? "F" : person.sex || "?";
  const sexClass =
    person.sex === "M" ? "is-m" : person.sex === "F" ? "is-f" : "is-u";

  const events = (person.events || []).filter((e) => !isFirstMentionEvent(e));
  const quotes = (person.quotes || []).map((q) =>
    typeof q === "string" ? q : q?.text || ""
  ).filter(Boolean);
  const ageInfo = currentNarrativeTime
    ? ageAtNarrative(person, currentNarrativeTime)
    : null;
  const ageFact = ageInfo
    ? `<div class="sheet-fact">
        <span class="sheet-fact-icon">${sheetIcon("events")}</span>
        <div>
          <span class="sheet-fact-label">${escapeHtml(t("narrativeAge"))}</span>
          <span class="sheet-fact-value">${escapeHtml(
            formatAgeLong(ageInfo, t)
          )}</span>
        </div>
      </div>`
    : "";

  const factsHtml = `
    <div class="sheet-facts">
      <div class="sheet-fact">
        <span class="sheet-fact-icon">${sheetIcon("user")}</span>
        <div>
          <span class="sheet-fact-label">${escapeHtml(t("sex"))}</span>
          <span class="sheet-fact-value">${escapeHtml(sexLabel)}</span>
        </div>
      </div>
      <div class="sheet-fact">
        <span class="sheet-fact-icon">${sheetIcon("brief")}</span>
        <div>
          <span class="sheet-fact-label">${escapeHtml(t("occupation"))}</span>
          <span class="sheet-fact-value">${escapeHtml(
            person.occupation || t("unknown")
          )}</span>
        </div>
      </div>
      ${ageFact}
      <div class="sheet-fact">
        <span class="sheet-fact-icon">${sheetIcon("birth")}</span>
        <div>
          <span class="sheet-fact-label">${escapeHtml(t("birth"))}</span>
          <span class="sheet-fact-value">${escapeHtml(birthDate)}${escapeHtml(
            formatPlaceAfterDate(person.birth?.place)
          )}</span>
        </div>
      </div>
      ${
        person.death?.status
          ? `<div class="sheet-fact">
        <span class="sheet-fact-icon">${sheetIcon("death")}</span>
        <div>
          <span class="sheet-fact-label">${escapeHtml(t("death"))}</span>
          <span class="sheet-fact-value">${escapeHtml(deathDate)}${escapeHtml(
              formatPlaceAfterDate(person.death.place)
            )}</span>
        </div>
      </div>`
          : ""
      }
      ${
        person.nickname
          ? `<div class="sheet-fact">
        <span class="sheet-fact-icon">${sheetIcon("user")}</span>
        <div>
          <span class="sheet-fact-label">${escapeHtml(t("nickname"))}</span>
          <span class="sheet-fact-value">${escapeHtml(person.nickname)}</span>
        </div>
      </div>`
          : ""
      }
    </div>
  `;

  const notesSection = renderSheetSection(
    "notes",
    t("notes"),
    renderNotesBody(person.notes, t)
  );

  const eventsBody = events.length
    ? `<ul class="sheet-timeline">${events
        .map((e) => {
          const when = e.date ? formatDateForUi(e.date) : "";
          const where = e.place
            ? formatPlaceAfterDate(e.place).replace(/^,\s*/, "")
            : "";
          const meta = [when, where].filter(Boolean).join(" · ");
          return `
          <li class="sheet-timeline-item">
            <span class="sheet-timeline-dot" aria-hidden="true"></span>
            <div>
              <div class="sheet-timeline-title">${escapeHtml(
                e.type || t("event")
              )}${e.value ? ` — ${escapeHtml(e.value)}` : ""}</div>
              ${
                meta
                  ? `<div class="sheet-timeline-meta">${escapeHtml(meta)}</div>`
                  : ""
              }
              ${
                e.notes?.length
                  ? `<p class="sheet-timeline-note">${escapeHtml(
                      e.notes.join(" ")
                    )}</p>`
                  : ""
              }
            </div>
          </li>`;
        })
        .join("")}</ul>`
    : "";

  const eventsSection = renderSheetSection("events", t("events"), eventsBody);

  const firstMentionsBody = person.firstMentions?.length
    ? `<ul class="sheet-quotes sheet-quotes--evidence">${person.firstMentions
        .map(
          (q) =>
            `<li><span class="sheet-quote-mark" aria-hidden="true">«</span><em>${escapeHtml(
              stripQuoteMarks(q)
            )}</em></li>`
        )
        .join("")}</ul>`
    : `<p class="sheet-empty">${escapeHtml(t("missingFirstMention"))}</p>`;

  const firstMentionsSection = renderSheetSection(
    "bookmark",
    t("firstMentions"),
    firstMentionsBody,
    "sheet-section--accent"
  );

  const quotesBody = quotes.length
    ? `<ul class="sheet-quotes">${quotes
        .map(
          (q) =>
            `<li><span class="sheet-quote-mark" aria-hidden="true">«</span><em>${escapeHtml(
              stripQuoteMarks(q)
            )}</em></li>`
        )
        .join("")}</ul>`
    : "";

  const quotesSection = renderSheetSection("quote", t("quotes"), quotesBody);

  return `
    <article class="person-sheet">
      <header class="sheet-hero">
        <div class="sheet-avatar ${sexClass}" aria-hidden="true">${escapeHtml(
          sexLabel
        )}</div>
        <div class="sheet-hero-text">
          <h2 class="sheet-name">${escapeHtml(person.name)}</h2>
          ${
            person.occupation
              ? `<p class="sheet-role">${escapeHtml(person.occupation)}</p>`
              : ""
          }
        </div>
      </header>
      ${factsHtml}
      ${notesSection}
      ${eventsSection}
      ${firstMentionsSection}
      ${quotesSection}
    </article>
  `;
}

function drag(sim) {
  return d3
    .drag()
    .on("start", (event, d) => {
      nodeDragMoved = false;
      d.__dragStartX = d.x;
      d.__dragStartY = d.y;
      if (!event.active) sim.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    })
    .on("drag", (event, d) => {
      const dist = Math.hypot(
        event.x - (d.__dragStartX ?? d.x),
        event.y - (d.__dragStartY ?? d.y)
      );
      if (dist > 4) nodeDragMoved = true;
      d.fx = event.x;
      // Keep vertical birth order in hierarchy mode
      if (getLayoutMode() === "hierarchy") {
        d.fy = d.y;
      } else {
        d.fy = event.y;
      }
    })
    .on("end", (event, d) => {
      if (!event.active) sim.alphaTarget(0);
      d.fx = null;
      if (getLayoutMode() === "hierarchy") {
        // Re-lock to birth-year band after drag
        d.fy = d.y;
      } else {
        d.fy = null;
      }
      // Keep the flag until after the click event that follows mouseup
      setTimeout(() => {
        nodeDragMoved = false;
      }, 50);
    });
}

function focusNode(clickedNode) {
  cancelHoverRestore();
  const id = clickedNode?.id;
  lastFocusedNode = allNodes.find((n) => n.id === id) || clickedNode;
  lastFocusedLink = null;
  emphasizeNeighborhood(lastFocusedNode.id, {
    raiseId: lastFocusedNode.id,
    duration: 220,
  });
  showModalContent(lastFocusedNode);
  // Re-assert focus after layout shift from opening the detail panel
  requestAnimationFrame(() => {
    if (lastFocusedNode?.id === id) {
      emphasizeNeighborhood(id, { raiseId: id, duration: 160 });
    }
  });
  setTimeout(() => {
    if (lastFocusedNode?.id === id) {
      lastFocusedNode = allNodes.find((n) => n.id === id) || lastFocusedNode;
      emphasizeNeighborhood(id, { raiseId: id, duration: 160 });
    }
  }, 220);
}

function showModalContent(nodeA, nodeB = null, relationInfo = null) {
  const modal = document.getElementById("modalContainer");
  const content = document.getElementById("modalContent");
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  const isMobile = window.innerWidth < 768;
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  // const svg = document.querySelector("svg");
  // svg.style.width = isMobile ? "100vw" : "50vw";
  // svg.style.height = "100vh";

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
  document.body.style.overflow = "hidden";

  if (lastFocusedNode || lastFocusedLink) {
    clearGraphEmphasis(280);
    d3.selectAll(".node circle")
      .transition()
      .duration(280)
      .attr("fill", (d) => (d.sex === "M" ? "#2563eb" : "#db2777"));
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

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  const t = window.t || ((k) => k);
  const tr = window.translateRelation || ((r) => r || t("unknown"));
  const section = (person, relation) => `
    <div style="flex: 1; padding: 1em; border-right: 1px solid #ccc;">
      <h2>${person.name}</h2>
      <p><strong>${t("sex")}:</strong> ${person.sex}</p>
      <p><strong>${t("occupation")}:</strong> ${
        person.occupation || t("unknown")
      }</p>
      <p><strong>${t("relation")}:</strong> ${tr(relation)}</p>
    </div>`;

  content.innerHTML = `
    <div style="display: flex; height: 90%;">
      ${section(source, relationA)}
      ${section(target, relationB)}
    </div>
    <div style="padding: 1em;">
      <h3>${t("notes")}</h3>
      <ul>${
        (notes || []).map((n) => `<li>${n}</li>`).join("") ||
        `<li>${t("noNotes")}</li>`
      }</ul>
      <button onclick="closeModal()">${t("close")}</button>
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
    if (!file) return;
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
        citations: l.citations,
      }));

      createGraph(parsedData);
      enrichLinkTooltips();
      setGraphChrome({
        bookTitle: window.t("customFile"),
        chapterLabel: file.name,
        chapterTitle: window.t("uploadedGed"),
        file: null,
      });
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

  function setLibraryStatus(message, isError = false) {
    const el = document.getElementById("libraryStatus");
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = message;
    el.classList.toggle("error", isError);
  }

  function setGraphChrome({ bookTitle, chapterLabel, chapterTitle, file }) {
    const empty = document.getElementById("emptyState");
    const now = document.getElementById("nowPlaying");
    window.__nowPlaying = { bookTitle, chapterLabel, chapterTitle, file };
    if (empty) empty.classList.add("is-hidden");
    if (now) {
      now.innerHTML = `
        <div class="kicker">${escapeHtml(
          bookTitle || window.t("brandTitle")
        )}</div>
        <strong>${escapeHtml(
          chapterTitle || chapterLabel || window.t("graph")
        )}</strong>
        <span>${escapeHtml(chapterLabel || "")}</span>
      `;
      now.classList.add("is-visible");
    }
    document.querySelectorAll(".chapter-btn").forEach((btn) => {
      btn.classList.toggle("is-active", file && btn.dataset.file === file);
    });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function humanizeSlug(slug) {
    return slug
      .replace(/^\/ged\//, "")
      .split("/")
      .filter(Boolean)
      .map((part) =>
        part
          .replace(/[-_]+/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
      )
      .join(" · ");
  }

  function chapterFromFilename(filePath) {
    const base = filePath.split("/").pop().replace(/\.ged$/i, "");
    const upTo = base.match(/^up-to-chapter-(\d+)$/i);
    if (upTo) {
      return {
        label: window.t("chapterN", { n: upTo[1] }),
        title: window.t("upToChapterN", { n: upTo[1] }),
      };
    }
    return {
      label: window.t("fullMap"),
      title: humanizeSlug(base),
    };
  }

  function normalizeFilePath(filePath) {
    if (!filePath) return "";
    let p = String(filePath).replace(/\\/g, "/");
    while (p.startsWith("//")) p = p.slice(1);
    if (!p.startsWith("/")) p = `/${p}`;
    if (p.startsWith("/ged/ged/")) p = p.replace(/^\/ged\/ged\//, "/ged/");
    if (!p.startsWith("/ged/")) p = `/ged/${p.replace(/^\/+/, "")}`;
    return p;
  }

  function mergeCatalogWithFiles(catalogBooks, files) {
    const byFile = new Map();
    (catalogBooks || []).forEach((book) => {
      (book.chapters || []).forEach((ch) => {
        byFile.set(normalizeFilePath(ch.file), { book, chapter: ch });
      });
    });

    const books = (catalogBooks || []).map((book) => ({
      ...book,
      chapters: [...(book.chapters || [])].map((ch) => ({
        ...ch,
        file: normalizeFilePath(ch.file),
      })),
    }));

    const bookById = new Map(books.map((b) => [b.id, b]));

    (files || []).forEach((raw) => {
      const file = normalizeFilePath(raw);
      if (byFile.has(file)) return;

      const parts = file.replace(/^\/ged\//, "").split("/");
      const fileName = parts.pop();
      const id = parts.join("/") || fileName.replace(/\.ged$/i, "");
      let book = bookById.get(id);
      if (!book) {
        book = {
          id,
          title: humanizeSlug(parts[parts.length - 1] || id),
          series: parts.length > 1 ? humanizeSlug(parts[0]) : "",
          author: "",
          blurb: window.t("discoveredBlurb"),
          chapters: [],
        };
        books.push(book);
        bookById.set(id, book);
      }
      const inferred = chapterFromFilename(file);
      book.chapters.push({
        file,
        label: inferred.label,
        title: inferred.title,
      });
      byFile.set(file, { book, chapter: book.chapters.at(-1) });
    });

    books.forEach((book) => {
      book.chapters.sort((a, b) => {
        const na = +(a.file.match(/chapter-(\d+)/i) || [])[1] || 0;
        const nb = +(b.file.match(/chapter-(\d+)/i) || [])[1] || 0;
        if (na && nb) return na - nb;
        return a.label.localeCompare(b.label);
      });
    });

    return books;
  }

  function renderLibrary(books) {
    const list = document.getElementById("bookList");
    if (!list) return;
    window.__libraryBooks = books;
    const openId =
      document.querySelector(".book-card.is-open")?.dataset.bookId ||
      books[0]?.id;

    if (!books.length) {
      list.innerHTML = "";
      setLibraryStatus(window.t("noBooks"), true);
      return;
    }

    setLibraryStatus("");
    list.innerHTML = books
      .map((book) => {
        const count = book.chapters.length;
        const countLabel =
          count === 1
            ? window.t("snapshots_one")
            : window.t("snapshots_other", { n: count });
        const blurb = window.localizeBookBlurb(book);
        const chapters = book.chapters
          .map((ch) => {
            const label = window.localizeChapterLabel(ch.label, ch.file);
            const title = window.localizeChapterTitle(ch.title, ch.file);
            return `
            <button type="button" class="chapter-btn" data-file="${escapeHtml(
              ch.file
            )}" data-book="${escapeHtml(book.title)}" data-label="${escapeHtml(
              label
            )}" data-title="${escapeHtml(title)}">
              <span class="chapter-label">${escapeHtml(label)}</span>
              <span class="chapter-title">${escapeHtml(title)}</span>
            </button>`;
          })
          .join("");

        return `
          <article class="book-card${
            book.id === openId ? " is-open" : ""
          }" data-book-id="${escapeHtml(book.id)}">
            <button type="button" class="book-card-header" data-toggle-book>
              ${
                book.series
                  ? `<span class="book-series">${escapeHtml(book.series)}</span>`
                  : ""
              }
              <h2 class="book-title">${escapeHtml(book.title)}</h2>
              <div class="book-meta">
                ${
                  book.author
                    ? `<span>${escapeHtml(book.author)}</span>`
                    : ""
                }
                <span class="book-count">${escapeHtml(countLabel)}</span>
              </div>
              ${
                blurb
                  ? `<p class="book-blurb">${escapeHtml(blurb)}</p>`
                  : ""
              }
            </button>
            <div class="book-chapters">${chapters}</div>
          </article>`;
      })
      .join("");

    if (window.__nowPlaying?.file) {
      setGraphChrome(window.__nowPlaying);
    }
  }

  function filterLibrary(query) {
    const q = query.trim().toLowerCase();
    document.querySelectorAll(".book-card").forEach((card) => {
      const text = card.textContent.toLowerCase();
      card.classList.toggle("is-hidden", Boolean(q) && !text.includes(q));
    });
  }

  async function loadFile(fileName, meta = {}) {
    const file = normalizeFilePath(fileName);
    try {
      const response = await fetch(file);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const gedcomData = await response.text();
      if (gedcomData.trim().startsWith("<!")) {
        throw new Error("Received HTML instead of a .ged file");
      }
      const parsedData = parseGedcom(gedcomData);
      window.allNodes = parsedData.nodes.map((n) => ({ ...n }));
      window.allLinks = parsedData.links.map((l) => ({
        source: l.source,
        target: l.target,
        relation: l.relation,
        type: l.type,
        notes: l.notes,
        citations: l.citations,
      }));
      createGraph(parsedData);
      enrichLinkTooltips();
      setGraphChrome({
        bookTitle: meta.bookTitle,
        chapterLabel: meta.chapterLabel,
        chapterTitle: meta.chapterTitle,
        file,
      });
      setChapterNarrative(
        meta.narrative || findChapterNarrative(file)
      );
      document.getElementById("library")?.classList.remove("is-mobile-open");
    } catch (error) {
      console.error("Error loading file:", error);
      setLibraryStatus(
        window.t("couldNotLoad", { file, error: error.message }),
        true
      );
    }
  }

  async function initLibrary() {
    let catalogBooks = [];
    try {
      const catalogRes = await fetch("./ged/catalog.json", { cache: "no-store" });
      if (catalogRes.ok) {
        const catalog = await catalogRes.json();
        catalogBooks = catalog.books || [];
      }
    } catch (error) {
      console.warn("catalog.json unavailable", error);
    }

    let liveFiles = [];
    try {
      const listRes = await fetch("/ged");
      if (listRes.ok) {
        const contentType = listRes.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          liveFiles = await listRes.json();
        }
      }
    } catch (error) {
      // Static hosts (GitHub Pages) won't expose the Express /ged API.
    }

    window.__catalogBooks = catalogBooks;
    window.__liveFiles = liveFiles;
    const books = mergeCatalogWithFiles(catalogBooks, liveFiles);
    renderLibrary(books);

    if (!catalogBooks.length && !liveFiles.length) {
      setLibraryStatus(window.t("noLibraryData"), true);
    }
  }

  function setLibraryCollapsed(collapsed) {
    const shell = document.getElementById("appShell");
    const library = document.getElementById("library");
    if (!shell) return;
    shell.classList.toggle("library-collapsed", collapsed);
    library?.classList.toggle("is-mobile-open", !collapsed && window.innerWidth <= 900);
    localStorage.setItem("cm_library_collapsed", collapsed ? "1" : "0");
    // Recenter graph after layout change
    requestAnimationFrame(() => {
      if (window.allNodes?.length) {
        createGraph({
          nodes: window.allNodes.map((n) => ({ ...n })),
          links: window.allLinks.map((l) => ({ ...l })),
        });
      }
    });
  }

  function refreshLocale() {
    window.applyStaticI18n();
    if (window.__libraryBooks) {
      renderLibrary(window.__libraryBooks);
    } else if (window.__catalogBooks) {
      renderLibrary(
        mergeCatalogWithFiles(window.__catalogBooks, window.__liveFiles || [])
      );
    }
    const search = document.getElementById("librarySearch");
    if (search?.value) filterLibrary(search.value);
    if (window.__nowPlaying) setGraphChrome(window.__nowPlaying);
    if (currentNarrative) {
      updateNarrativePanelUI();
      refreshNodeAgeLabels();
    }
  }

  document.getElementById("bookList")?.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-toggle-book]");
    if (toggle) {
      const card = toggle.closest(".book-card");
      const wasOpen = card.classList.contains("is-open");
      document
        .querySelectorAll(".book-card.is-open")
        .forEach((el) => el.classList.remove("is-open"));
      if (!wasOpen) card.classList.add("is-open");
      return;
    }

    const chapterBtn = event.target.closest(".chapter-btn");
    if (chapterBtn) {
      loadFile(chapterBtn.dataset.file, {
        bookTitle: chapterBtn.dataset.book,
        chapterLabel: chapterBtn.dataset.label,
        chapterTitle: chapterBtn.dataset.title,
      });
    }
  });

  document
    .getElementById("librarySearch")
    ?.addEventListener("input", (event) => {
      filterLibrary(event.target.value);
    });

  document.getElementById("sidebarToggle")?.addEventListener("click", () => {
    if (window.innerWidth <= 900) {
      document.getElementById("library")?.classList.add("is-mobile-open");
      setLibraryCollapsed(false);
    } else {
      setLibraryCollapsed(false);
    }
  });

  document.getElementById("collapseLibrary")?.addEventListener("click", () => {
    setLibraryCollapsed(true);
  });

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.setLang(btn.dataset.lang);
      refreshLocale();
    });
  });

  document.querySelectorAll("[data-layout]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setLayoutMode(btn.dataset.layout);
      rebuildCurrentGraph();
    });
  });

  let spreadTimer = null;
  const spreadSlider = document.getElementById("spreadSlider");
  setHorizontalSpread(getHorizontalSpread());
  spreadSlider?.addEventListener("input", () => {
    setHorizontalSpread(Number(spreadSlider.value) / 100);
    clearTimeout(spreadTimer);
    spreadTimer = setTimeout(() => rebuildCurrentGraph(), 140);
  });

  function setLegendCollapsed(collapsed) {
    const legend = document.getElementById("graphLegend");
    const toggle = document.getElementById("legendToggle");
    if (!legend || !toggle) return;
    legend.classList.toggle("is-collapsed", collapsed);
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    localStorage.setItem("cm_legend_collapsed", collapsed ? "1" : "0");
  }

  setLegendCollapsed(localStorage.getItem("cm_legend_collapsed") === "1");
  document.getElementById("legendToggle")?.addEventListener("click", () => {
    const legend = document.getElementById("graphLegend");
    setLegendCollapsed(!legend?.classList.contains("is-collapsed"));
  });

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => rebuildCurrentGraph(), 180);
  });

  window.setLang(window.getLang());
  window.applyStaticI18n();
  setLayoutMode(getLayoutMode());
  setHorizontalSpread(getHorizontalSpread());
  if (localStorage.getItem("cm_library_collapsed") === "1") {
    setLibraryCollapsed(true);
  }
  initLibrary();

  let pressTimer = null;
  let longPressDuration = 500;

  window.loadFile = loadFile;
});

// Add these lines at the end of graph.js
window.parseGedcom = parseGedcom;
window.createGraph = createGraph;
window.formatName = formatName;
