let allNodes = [];
let allLinks = [];
let simulation;
let lastFocusedNode = null;
let lastFocusedLink = null;
/** When a character is pinned: normal depth neighborhood, or immediate family nucleus. */
let focusScope = "depth"; // "depth" | "nucleus"
/** Sub-filter while focusScope === "nucleus". */
let nucleusKind = "all"; // "all" | "parents" | "children" | "siblings"
let hoverRestoreTimer = null;
/** @type {null | { kind: "node", id: string } | { kind: "link", key: string }} */
let activeHover = null;
let nodeDragMoved = false;
let currentLayoutMode = normalizeLayoutMode(
  localStorage.getItem("cm_layout") || "genealogy"
);
let currentHorizontalSpread = (() => {
  const raw = Number(localStorage.getItem("cm_h_spread"));
  return Number.isFinite(raw) ? Math.min(3.5, Math.max(1, raw)) : 2;
})();
/** Diameter of the undirected *family* graph (longest kinship shortest path). */
let graphDiameter = 0;
/** Undirected adjacency for family links only (parent / spouse / sibling). */
let familyAdj = new Map();
let currentLinkDepth = 0;
/** @type {"upto" | "exact" | "all"} */
let currentLinkDepthMode = (() => {
  const raw = localStorage.getItem("cm_link_depth_mode");
  if (raw === "exact" || raw === "all") return raw;
  return "upto";
})();
let currentNarrative = null;
let currentNarrativeTime = null;
/** @type {{ query: string, sex: "all"|"M"|"F", birthAfter: number|null, birthBefore: number|null, vitality: "all"|"living"|"deceased", bookEvidence: boolean, linkKind: "all"|"blood"|"other" }} */
let graphFilters = {
  query: "",
  sex: "all",
  birthAfter: null,
  birthBefore: null,
  vitality: "all",
  bookEvidence: false,
  linkKind: "all",
};
let filtersApplyTimer = null;

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

/** Age at death from birth/death GED dates, or null if not computable. */
function ageAtDeathOf(person) {
  if (!person?.death?.status) return null;
  const birth = parseGedDateParts(person.birth?.date);
  const death = parseGedDateParts(person.death?.date);
  if (!birth?.year || !death?.year) return null;
  const birthDate = gedPartsToDate(birth);
  const deathDate = gedPartsToDate(death, { endOfRange: true });
  if (!birthDate || !deathDate || deathDate < birthDate) return null;
  return {
    ...diffAgeYears(
      birthDate,
      deathDate,
      Boolean(birth.approx || death.approx)
    ),
    deathDate,
  };
}

/** Hypothetical age at `atDate` from birth alone (ignores death). */
function wouldBeAgeAt(person, atDate) {
  if (!atDate) return null;
  const birth = parseGedDateParts(person.birth?.date);
  if (!birth?.year) return null;
  const birthDate = gedPartsToDate(birth);
  if (!birthDate || birthDate > atDate) return null;
  return diffAgeYears(birthDate, atDate, birth.approx);
}

function ageAtNarrative(person, atDate) {
  if (!atDate) return null;
  const birth = parseGedDateParts(person.birth?.date);
  const death = person.death?.status
    ? parseGedDateParts(person.death?.date)
    : null;
  const deathDate = death ? gedPartsToDate(death, { endOfRange: true }) : null;
  const ageAtDeath = ageAtDeathOf(person);
  const wouldBeAge = wouldBeAgeAt(person, atDate);

  if (deathDate && deathDate < atDate) {
    return {
      kind: "dead",
      deathDate,
      deadFor: diffAgeYears(deathDate, atDate, Boolean(death.approx)),
      ageAtDeath,
      wouldBeAge,
    };
  }

  // Marked deceased but undated — still flag as dead at narrative time
  if (person.death?.status && !deathDate) {
    return {
      kind: "dead",
      deathDate: null,
      deadFor: null,
      ageAtDeath,
      wouldBeAge,
    };
  }

  if (!birth?.year) return { kind: "unknown", ageAtDeath };

  const birthDate = gedPartsToDate(birth);
  if (birthDate > atDate) {
    return { kind: "unborn", ageAtDeath };
  }

  return {
    kind: "alive",
    ageAtDeath,
    wouldBeAge,
    ...diffAgeYears(birthDate, atDate, birth.approx),
  };
}

function formatYearsAge(age, t) {
  if (!age || age.years == null) return null;
  if (age.years < 1) {
    return t("narrativeInfant", { months: Math.max(1, age.months || 1) });
  }
  return age.approx
    ? t("narrativeAgeApprox", { age: age.years })
    : t("narrativeAgeValue", { age: age.years });
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

function formatDeadForShort(deadFor, t) {
  if (!deadFor) return "†";
  if (deadFor.years < 1) {
    return t("deadForShortMonths", {
      months: Math.max(1, deadFor.months || 1),
    });
  }
  return deadFor.approx
    ? t("deadForShortApprox", { years: deadFor.years })
    : t("deadForShort", { years: deadFor.years });
}

function formatDeadForLong(ageInfo, t) {
  const deadFor = ageInfo?.deadFor;
  if (!deadFor) return t("narrativeDead");
  if (deadFor.years < 1) {
    return t("narrativeDeadForMonths", {
      months: Math.max(1, deadFor.months || 1),
    });
  }
  const duration = deadFor.approx
    ? t("narrativeDeadForApprox", { years: deadFor.years })
    : t("narrativeDeadFor", { years: deadFor.years });
  if (ageInfo.deathDate) {
    const when = formatDateForUi(`${ageInfo.deathDate.getFullYear()}`);
    return `${duration} (${when})`;
  }
  return duration;
}

function formatAgeShort(ageInfo, t) {
  if (!ageInfo || ageInfo.kind === "unknown" || ageInfo.kind === "unborn") {
    return "";
  }
  if (ageInfo.kind === "dead") {
    if (ageInfo.ageAtDeath?.years != null) {
      return ageInfo.ageAtDeath.approx
        ? t("deadAgeShortApprox", { age: ageInfo.ageAtDeath.years })
        : t("deadAgeShort", { age: ageInfo.ageAtDeath.years });
    }
    return formatDeadForShort(ageInfo.deadFor, t);
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
    return formatDeadForLong(ageInfo, t);
  }
  return formatYearsAge(ageInfo, t) || t("narrativeNoAge");
}

function renderAgeFact(icon, label, value) {
  if (!value) return "";
  return `<div class="sheet-fact">
        <span class="sheet-fact-icon">${sheetIcon(icon)}</span>
        <div>
          <span class="sheet-fact-label">${escapeHtml(label)}</span>
          <span class="sheet-fact-value">${escapeHtml(value)}</span>
        </div>
      </div>`;
}

/** Age-related facts for the character sheet (death age + narrative ages). */
function renderPersonAgeFacts(person, t) {
  const ageInfo = currentNarrativeTime
    ? ageAtNarrative(person, currentNarrativeTime)
    : null;
  const ageAtDeath = ageInfo?.ageAtDeath || ageAtDeathOf(person);
  const parts = [];

  if (ageInfo?.kind === "alive") {
    parts.push(
      renderAgeFact("events", t("narrativeAge"), formatAgeLong(ageInfo, t))
    );
  } else if (ageInfo?.kind === "dead") {
    if (ageAtDeath) {
      parts.push(
        renderAgeFact(
          "death",
          t("narrativeAgeAtDeath"),
          formatYearsAge(ageAtDeath, t)
        )
      );
    }
    if (ageInfo.wouldBeAge) {
      parts.push(
        renderAgeFact(
          "events",
          t("narrativeWouldBeAge"),
          formatYearsAge(ageInfo.wouldBeAge, t)
        )
      );
    }
    parts.push(
      renderAgeFact(
        "death",
        t("narrativeDeadLabel"),
        formatDeadForLong(ageInfo, t)
      )
    );
  } else if (ageAtDeath) {
    // No narrative clock, but we still know age at death
    parts.push(
      renderAgeFact(
        "death",
        t("narrativeAgeAtDeath"),
        formatYearsAge(ageAtDeath, t)
      )
    );
  }

  return parts.join("");
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
  // Living/deceased filter depends on narrative time
  if (graphFilters.vitality !== "all" && window.allNodes?.length) {
    rebuildCurrentGraph();
  }
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
  const whenCollapsed = document.getElementById("narrativeWhenCollapsed");
  if (whenCollapsed) {
    whenCollapsed.textContent = when?.textContent || "";
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

/** Normalize layout ids; legacy `hierarchy` → `chrono`. */
function normalizeLayoutMode(mode) {
  if (mode === "force") return "force";
  if (mode === "genealogy") return "genealogy";
  // `hierarchy` was birth-year (chronological), never true pedigree layers
  return "chrono";
}

function getLayoutMode() {
  return normalizeLayoutMode(currentLayoutMode);
}

/** Chrono + genealogy share layered Y bands, curved links, drag Y-lock. */
function isLayeredLayout(mode = getLayoutMode()) {
  return mode === "chrono" || mode === "genealogy";
}

function setLayoutMode(mode) {
  currentLayoutMode = normalizeLayoutMode(mode);
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

function buildFamilyAdj(nodes, links) {
  const adj = new Map();
  nodes.forEach((n) => adj.set(n.id, []));
  links.forEach((link) => {
    if (link.type !== "family") return;
    const { sourceId, targetId } = linkEnds(link);
    if (!adj.has(sourceId) || !adj.has(targetId) || sourceId === targetId)
      return;
    adj.get(sourceId).push(targetId);
    adj.get(targetId).push(sourceId);
  });
  return adj;
}

function bfsDistances(adj, start) {
  const dist = new Map([[start, 0]]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const u = queue[i];
    const du = dist.get(u);
    for (const v of adj.get(u) || []) {
      if (dist.has(v)) continue;
      dist.set(v, du + 1);
      queue.push(v);
    }
  }
  return dist;
}

/**
 * Family-graph diameter = max kinship degree (longest shortest path on FAM links).
 * Used as the upper bound of the depth slider.
 */
function computeLinkDepthModel(nodes, links) {
  const adj = buildFamilyAdj(nodes, links);
  const seen = new Set();
  let diameter = 0;

  for (const node of nodes) {
    if (seen.has(node.id)) continue;
    const component = [];
    const q = [node.id];
    seen.add(node.id);
    while (q.length) {
      const u = q.shift();
      component.push(u);
      for (const v of adj.get(u) || []) {
        if (seen.has(v)) continue;
        seen.add(v);
        q.push(v);
      }
    }

    for (const u of component) {
      const dist = bfsDistances(adj, u);
      for (const v of component) {
        diameter = Math.max(diameter, dist.get(v) ?? 0);
      }
    }
  }

  return { diameter, familyAdj: adj };
}

function readStoredLinkDepthPref() {
  const raw = localStorage.getItem("cm_link_depth");
  if (raw == null || raw === "max") return { mode: "max" };
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0) return { mode: "value", value: Math.floor(n) };
  return { mode: "max" };
}

function persistLinkDepth(depth, diameter) {
  if (diameter <= 0 || depth >= diameter) {
    localStorage.setItem("cm_link_depth", "max");
  } else {
    localStorage.setItem("cm_link_depth", String(depth));
  }
}

function familyEdgeKey(a, b) {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

/** Cache for exact-degree edge sets (invalidated when familyAdj / depth changes). */
let exactDegreeEdgeCache = { key: "", edges: new Set(), nodes: new Set() };

function invalidateExactDegreeCache() {
  exactDegreeEdgeCache = { key: "", edges: new Set(), nodes: new Set() };
}

/**
 * Family edges that lie on a shortest path of length exactly `depth`
 * from `egoId` to some relative (degree-`depth` kinship).
 * If `egoId` is null, use every possible ego (global exact filter).
 */
function computeExactDegreePathSet(depth, egoId = null) {
  const edges = new Set();
  const nodes = new Set();
  if (depth <= 0 || !familyAdj.size) return { edges, nodes };

  const egos = egoId
    ? familyAdj.has(egoId)
      ? [egoId]
      : []
    : [...familyAdj.keys()];

  for (const start of egos) {
    const dist = bfsDistances(familyAdj, start);
    const targets = [];
    for (const [id, d] of dist) {
      if (d === depth) targets.push(id);
    }
    if (!targets.length) continue;

    nodes.add(start);
    for (const t of targets) {
      nodes.add(t);
      const stack = [t];
      const seen = new Set([t]);
      while (stack.length) {
        const v = stack.pop();
        const dv = dist.get(v) ?? 0;
        if (dv <= 0) continue;
        for (const u of familyAdj.get(v) || []) {
          if (dist.get(u) !== dv - 1) continue;
          edges.add(familyEdgeKey(u, v));
          nodes.add(u);
          if (!seen.has(u)) {
            seen.add(u);
            stack.push(u);
          }
        }
      }
    }
  }
  return { edges, nodes };
}

function getExactDegreePathSet(
  depth = currentLinkDepth,
  egoId = null
) {
  const key = `${depth}|${egoId || "*"}|${familyAdj.size}`;
  if (exactDegreeEdgeCache.key !== key) {
    exactDegreeEdgeCache = {
      key,
      ...computeExactDegreePathSet(depth, egoId),
    };
  }
  return exactDegreeEdgeCache;
}

/** Family nodes within `depth` hops (1 = child/spouse/sibling, 2 = grandchild…). */
function nodesWithinFamilyDepth(nodeId, depth = currentLinkDepth) {
  const ids = new Set([nodeId]);
  if (depth <= 0 || !familyAdj.has(nodeId)) return ids;
  const dist = bfsDistances(familyAdj, nodeId);
  for (const [id, d] of dist) {
    if (d <= depth) ids.add(id);
  }
  return ids;
}

/** Every node that participates in at least one blood/family edge. */
function allBloodNodeIds() {
  const ids = new Set();
  for (const [u, vs] of familyAdj) {
    if (!vs?.length) continue;
    ids.add(u);
    vs.forEach((v) => ids.add(v));
  }
  return ids;
}

/**
 * Keep predicate for focus/hover at a given depth.
 * - all: every blood/family edge (any degree); no ASSO
 * - upto: family edges inside the ball (degree ≤ depth) + direct ASSO if depth ≥ 1
 * - exact: family edges on a shortest path of length exactly `depth` (+ ASSO only at 1)
 */
function makeFocusLinkKeep(
  nodeId,
  depth = currentLinkDepth,
  mode = currentLinkDepthMode
) {
  if (mode === "all") {
    return (link) => link.type === "family";
  }
  if (depth <= 0) return () => false;

  if (mode === "exact") {
    const { edges } = getExactDegreePathSet(depth, nodeId);
    return (link) => {
      const { sourceId, targetId } = linkEnds(link);
      if (link.type !== "family") {
        return (
          depth === 1 && (sourceId === nodeId || targetId === nodeId)
        );
      }
      return edges.has(familyEdgeKey(sourceId, targetId));
    };
  }

  const famIds = nodesWithinFamilyDepth(nodeId, depth);
  return (link) => {
    const { sourceId, targetId } = linkEnds(link);
    if (link.type === "family") {
      return famIds.has(sourceId) && famIds.has(targetId);
    }
    return sourceId === nodeId || targetId === nodeId;
  };
}

/** Focus/hover node set: ego + endpoints of kept links (+ full ball in upto mode). */
function focusNeighborhoodIds(
  nodeId,
  depth = currentLinkDepth,
  mode = currentLinkDepthMode
) {
  const ids = new Set([nodeId]);

  if (mode === "all") {
    allBloodNodeIds().forEach((id) => ids.add(id));
    return ids;
  }
  if (depth <= 0) return ids;

  if (mode === "exact") {
    const { nodes } = getExactDegreePathSet(depth, nodeId);
    nodes.forEach((id) => ids.add(id));
    if (depth === 1) {
      allLinks.forEach((link) => {
        if (link.type === "family") return;
        const { sourceId, targetId } = linkEnds(link);
        if (sourceId === nodeId) ids.add(targetId);
        if (targetId === nodeId) ids.add(sourceId);
      });
    }
    return ids;
  }

  nodesWithinFamilyDepth(nodeId, depth).forEach((id) => ids.add(id));
  allLinks.forEach((link) => {
    if (link.type === "family") return;
    const { sourceId, targetId } = linkEnds(link);
    if (sourceId === nodeId) ids.add(targetId);
    if (targetId === nodeId) ids.add(sourceId);
  });
  return ids;
}

/** Ego for kinship-depth filtering: pinned character, else hovered character. */
function depthEgoId() {
  if (lastFocusedNode?.id) return lastFocusedNode.id;
  if (activeHover?.kind === "node") return activeHover.id;
  return null;
}

/**
 * Depth 0 → hide all links (except mode "all").
 * all → every blood/family edge, any degree (ASSO hidden).
 * upto + ego → kinship ball (degree ≤ depth) + direct ASSO.
 * exact + ego → only geodesics of length exactly `depth` from ego.
 * exact without ego → geodesics of length exactly `depth` anywhere in the family graph.
 * upto without ego → show every link (depth applies once a character is focused).
 */
function isLinkInDepth(
  link,
  depth = currentLinkDepth,
  mode = currentLinkDepthMode
) {
  if (mode === "all") return link.type === "family";
  if (depth <= 0) return false;
  const ego = depthEgoId();
  if (ego) return makeFocusLinkKeep(ego, depth, mode)(link);

  if (mode === "exact") {
    if (link.type !== "family") return depth === 1;
    const { edges } = getExactDegreePathSet(depth, null);
    const { sourceId, targetId } = linkEnds(link);
    return edges.has(familyEdgeKey(sourceId, targetId));
  }
  return true;
}

function applyLinkDepthVisibility() {
  d3.selectAll(".link, .link-hit").classed(
    "is-depth-hidden",
    (l) => !isLinkInDepth(l)
  );
}

function syncLinkDepthControl() {
  const t = window.t || ((k) => k);
  const slider = document.getElementById("linkDepthSlider");
  const readout = document.getElementById("linkDepthValue");
  const allMode = currentLinkDepthMode === "all";
  if (slider) {
    slider.max = String(graphDiameter);
    slider.value = String(currentLinkDepth);
    slider.setAttribute("aria-valuemax", String(graphDiameter));
    slider.disabled = allMode;
    slider.classList.toggle("is-disabled", allMode);
  }
  if (readout) {
    if (allMode) {
      readout.textContent = `${t("linkDepthModeAllShort")} / ${graphDiameter}`;
    } else {
      const modeLabel =
        currentLinkDepthMode === "exact"
          ? t("linkDepthModeExactShort")
          : t("linkDepthModeUptoShort");
      readout.textContent = `${modeLabel} ${currentLinkDepth} / ${graphDiameter}`;
    }
  }
  document.querySelectorAll('input[name="linkDepthMode"]').forEach((el) => {
    el.checked = el.value === currentLinkDepthMode;
  });
}

function setLinkDepthMode(mode, { persist = true } = {}) {
  currentLinkDepthMode =
    mode === "exact" || mode === "all" ? mode : "upto";
  if (persist) {
    localStorage.setItem("cm_link_depth_mode", currentLinkDepthMode);
  }
  syncLinkDepthControl();
  applyLinkDepthVisibility();
  restorePersistentEmphasis();
  return currentLinkDepthMode;
}

function setLinkDepth(value, { persist = true } = {}) {
  const n = Number(value);
  currentLinkDepth = Number.isFinite(n)
    ? Math.max(0, Math.min(graphDiameter, Math.floor(n)))
    : graphDiameter;
  if (persist) persistLinkDepth(currentLinkDepth, graphDiameter);
  syncLinkDepthControl();
  applyLinkDepthVisibility();
  restorePersistentEmphasis();
  return currentLinkDepth;
}

function updateLinkDepthModel(nodes, links) {
  const model = computeLinkDepthModel(nodes, links);
  graphDiameter = model.diameter;
  familyAdj = model.familyAdj;
  invalidateExactDegreeCache();
  const pref = readStoredLinkDepthPref();
  if (pref.mode === "max") {
    currentLinkDepth = graphDiameter;
  } else {
    currentLinkDepth = Math.max(0, Math.min(graphDiameter, pref.value));
  }
  syncLinkDepthControl();
  applyLinkDepthVisibility();
}

function parseFilterYear(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const y = Math.floor(n);
  return y >= 1 && y <= 9999 ? y : null;
}

function countActiveGraphFilters() {
  let n = 0;
  if (graphFilters.query.trim()) n += 1;
  if (graphFilters.sex !== "all") n += 1;
  if (graphFilters.birthAfter != null) n += 1;
  if (graphFilters.birthBefore != null) n += 1;
  if (graphFilters.vitality !== "all") n += 1;
  if (graphFilters.bookEvidence) n += 1;
  if (graphFilters.linkKind !== "all") n += 1;
  return n;
}

function hasActiveGraphFilters() {
  return countActiveGraphFilters() > 0;
}

function clearGraphFiltersState() {
  graphFilters = {
    query: "",
    sex: "all",
    birthAfter: null,
    birthBefore: null,
    vitality: "all",
    bookEvidence: false,
    linkKind: "all",
  };
  writeFiltersToDom();
  persistGraphFilters();
  syncFiltersBadge();
}

/** Prefer depth = 1 (upto) so a click can reveal immediate neighbors. */
function setDepthToDirectNeighbors() {
  currentLinkDepthMode = "upto";
  localStorage.setItem("cm_link_depth_mode", "upto");
  // Persist a concrete "1" (not "max") so a later rebuild with a larger
  // family diameter does not reopen the whole tree.
  localStorage.setItem("cm_link_depth", "1");
  currentLinkDepth = graphDiameter > 0 ? Math.min(1, graphDiameter) : 0;
  syncLinkDepthControl();
}

/**
 * Click beats filters: always dismiss the filters popover; if any graph filter
 * was active, clear it, force direct-neighborhood depth, and rebuild.
 * @returns {boolean} true if a rebuild is required
 */
function prioritizeClickOverFilters() {
  // Node/link clicks stopPropagation, so the outside-click closer never runs —
  // always hide the filters UI explicitly.
  setFiltersPopoverOpen(false);

  const hadFilters = hasActiveGraphFilters();
  if (!hadFilters) {
    if (currentLinkDepth < 1 && graphDiameter > 0) {
      setDepthToDirectNeighbors();
      applyLinkDepthVisibility();
    }
    return false;
  }
  clearGraphFiltersState();
  setDepthToDirectNeighbors();
  return true;
}

function syncFiltersBadge() {
  const badge = document.getElementById("filtersBadge");
  const toggle = document.getElementById("filtersToggle");
  const count = countActiveGraphFilters();
  if (badge) {
    badge.textContent = String(count);
    badge.classList.toggle("is-hidden", count === 0);
  }
  toggle?.classList.toggle("has-active-filters", count > 0);
}

function isPersonDeceasedForFilter(person) {
  if (currentNarrativeTime) {
    const age = ageAtNarrative(person, currentNarrativeTime);
    if (age?.kind === "dead") return true;
    if (age?.kind === "alive" || age?.kind === "unborn") return false;
  }
  return Boolean(person.death?.status);
}

function nodeMatchesGraphFilters(node) {
  const q = graphFilters.query.trim().toLowerCase();
  if (q) {
    const name = String(node.name || "").toLowerCase();
    const nicks = [
      node.nickname,
      ...(Array.isArray(node.nicknames) ? node.nicknames : []),
    ]
      .filter(Boolean)
      .map((n) => String(n).toLowerCase());
    const hit =
      name.includes(q) ||
      nicks.some((nick) => nick.includes(q)) ||
      name.split(/\s+/).some((part) => part.includes(q));
    if (!hit) return false;
  }

  if (graphFilters.sex !== "all" && node.sex !== graphFilters.sex) return false;

  const birthYear = parseBirthYear(node.birth?.date);
  if (graphFilters.birthAfter != null) {
    if (birthYear == null || birthYear <= graphFilters.birthAfter) return false;
  }
  if (graphFilters.birthBefore != null) {
    if (birthYear == null || birthYear >= graphFilters.birthBefore) return false;
  }

  if (graphFilters.vitality === "deceased" && !isPersonDeceasedForFilter(node)) {
    return false;
  }
  if (graphFilters.vitality === "living" && isPersonDeceasedForFilter(node)) {
    return false;
  }

  if (graphFilters.bookEvidence) {
    if (!(node.firstMentions && node.firstMentions.length)) return false;
  }

  return true;
}

function linkMatchesKindFilter(link) {
  if (graphFilters.linkKind === "blood") return link.type === "family";
  if (graphFilters.linkKind === "other") return link.type !== "family";
  return true;
}

function getFilteredGraphData() {
  const sourceNodes = window.allNodes || [];
  const sourceLinks = window.allLinks || [];
  const nodes = sourceNodes.filter(nodeMatchesGraphFilters);
  const ids = new Set(nodes.map((n) => n.id));
  const links = sourceLinks.filter((l) => {
    const { sourceId, targetId } = linkEnds(l);
    if (!ids.has(sourceId) || !ids.has(targetId)) return false;
    return linkMatchesKindFilter(l);
  });
  return { nodes, links };
}

function readFiltersFromDom() {
  const search = document.getElementById("searchBox");
  graphFilters.query = search?.value || "";
  const sex =
    document.querySelector('input[name="filterSex"]:checked')?.value || "all";
  graphFilters.sex = sex === "M" || sex === "F" ? sex : "all";
  graphFilters.birthAfter = parseFilterYear(
    document.getElementById("filterBirthAfter")?.value
  );
  graphFilters.birthBefore = parseFilterYear(
    document.getElementById("filterBirthBefore")?.value
  );
  const vitality =
    document.querySelector('input[name="filterVitality"]:checked')?.value ||
    "all";
  graphFilters.vitality =
    vitality === "living" || vitality === "deceased" ? vitality : "all";
  graphFilters.bookEvidence = Boolean(
    document.getElementById("filterBookEvidence")?.checked
  );
  const linkKind =
    document.querySelector('input[name="filterLinkKind"]:checked')?.value ||
    "all";
  graphFilters.linkKind =
    linkKind === "blood" || linkKind === "other" ? linkKind : "all";
}

function writeFiltersToDom() {
  const search = document.getElementById("searchBox");
  if (search) search.value = graphFilters.query;
  document.querySelectorAll('input[name="filterSex"]').forEach((el) => {
    el.checked = el.value === graphFilters.sex;
  });
  const after = document.getElementById("filterBirthAfter");
  const before = document.getElementById("filterBirthBefore");
  if (after) after.value = graphFilters.birthAfter ?? "";
  if (before) before.value = graphFilters.birthBefore ?? "";
  document.querySelectorAll('input[name="filterVitality"]').forEach((el) => {
    el.checked = el.value === graphFilters.vitality;
  });
  document.querySelectorAll('input[name="filterLinkKind"]').forEach((el) => {
    el.checked = el.value === graphFilters.linkKind;
  });
  const book = document.getElementById("filterBookEvidence");
  if (book) book.checked = graphFilters.bookEvidence;
  syncFiltersBadge();
}

function persistGraphFilters() {
  try {
    localStorage.setItem("cm_graph_filters", JSON.stringify(graphFilters));
  } catch (_) {
    /* ignore */
  }
}

function loadGraphFilters() {
  try {
    const raw = localStorage.getItem("cm_graph_filters");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    graphFilters = {
      query: String(parsed.query || ""),
      sex: parsed.sex === "M" || parsed.sex === "F" ? parsed.sex : "all",
      birthAfter: parseFilterYear(parsed.birthAfter),
      birthBefore: parseFilterYear(parsed.birthBefore),
      vitality:
        parsed.vitality === "living" || parsed.vitality === "deceased"
          ? parsed.vitality
          : "all",
      bookEvidence: Boolean(parsed.bookEvidence),
      linkKind:
        parsed.linkKind === "blood" || parsed.linkKind === "other"
          ? parsed.linkKind
          : "all",
    };
  } catch (_) {
    /* ignore */
  }
}

function applyGraphFilters({ debounce = false } = {}) {
  if (debounce) {
    clearTimeout(filtersApplyTimer);
    filtersApplyTimer = setTimeout(() => applyGraphFilters({ debounce: false }), 140);
    return;
  }
  readFiltersFromDom();
  persistGraphFilters();
  syncFiltersBadge();
  if (!window.allNodes?.length) return;
  rebuildCurrentGraph();
}

function resetGraphFilters() {
  clearGraphFiltersState();
  if (!window.allNodes?.length) return;
  rebuildCurrentGraph();
}

function setFiltersPopoverOpen(open) {
  const pop = document.getElementById("filtersPopover");
  const toggle = document.getElementById("filtersToggle");
  if (!pop || !toggle) return;
  pop.classList.toggle("is-hidden", !open);
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) {
    document.getElementById("searchBox")?.focus();
  }
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

  const filtered = getFilteredGraphData();
  createGraph({
    nodes: filtered.nodes.map((n) => ({
      ...n,
      fx: null,
      fy: null,
      vx: 0,
      vy: 0,
    })),
    links: filtered.links.map((l) => ({
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
    if (!lastFocusedNode) {
      // Focused character hidden by filters — clear pin, keep modal closed later
      lastFocusedNode = null;
    }
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

/**
 * Pedigree generations from family links only (no dates).
 * Parent → child increases generation; spouses & siblings share a band.
 * Top of the graph = oldest generation (ancestors), bottom = descendants.
 */
function assignGenerations(nodes, links) {
  const idSet = new Set(nodes.map((n) => n.id));
  const parentsOf = new Map();
  const spousesOf = new Map();
  const siblingsOf = new Map();

  function addUndirected(map, a, b) {
    if (!map.has(a)) map.set(a, []);
    if (!map.has(b)) map.set(b, []);
    map.get(a).push(b);
    map.get(b).push(a);
  }

  links.forEach((l) => {
    if (l.type !== "family") return;
    const sid = typeof l.source === "object" ? l.source.id : l.source;
    const tid = typeof l.target === "object" ? l.target.id : l.target;
    if (!idSet.has(sid) || !idSet.has(tid)) return;
    if (l.relation === "Parent") {
      if (!parentsOf.has(tid)) parentsOf.set(tid, []);
      parentsOf.get(tid).push(sid);
    } else if (l.relation === "Spouse") {
      addUndirected(spousesOf, sid, tid);
    } else if (l.relation === "Sibling") {
      addUndirected(siblingsOf, sid, tid);
    }
  });

  const gen = new Map();
  nodes.forEach((n) => gen.set(n.id, 0));

  let changed = true;
  let guard = 0;
  const maxIter = Math.max(8, nodes.length * 3);
  while (changed && guard++ < maxIter) {
    changed = false;
    nodes.forEach((n) => {
      const parents = parentsOf.get(n.id);
      if (parents?.length) {
        const next = Math.max(...parents.map((p) => gen.get(p) ?? 0)) + 1;
        if (next > (gen.get(n.id) ?? 0)) {
          gen.set(n.id, next);
          changed = true;
        }
      }
    });
    const equalize = (map) => {
      nodes.forEach((n) => {
        const peers = map.get(n.id);
        if (!peers?.length) return;
        let m = gen.get(n.id) ?? 0;
        peers.forEach((p) => {
          m = Math.max(m, gen.get(p) ?? 0);
        });
        if (m > (gen.get(n.id) ?? 0)) {
          gen.set(n.id, m);
          changed = true;
        }
        peers.forEach((p) => {
          if (m > (gen.get(p) ?? 0)) {
            gen.set(p, m);
            changed = true;
          }
        });
      });
    };
    equalize(spousesOf);
    equalize(siblingsOf);
  }

  const vals = [...gen.values()];
  const minG = vals.length ? Math.min(...vals) : 0;
  nodes.forEach((n) => {
    n.generation = (gen.get(n.id) ?? 0) - minG;
  });
  return nodes;
}

/** Spread nodes across layout width within the same vertical band key. */
function assignBandX(nodes, marginLeft, layoutWidth, bandKeyFn) {
  const cohorts = new Map();
  nodes.forEach((n) => {
    const key = bandKeyFn(n);
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
      node.x = marginLeft + 40 + t * (layoutWidth - 80);
    });
  });
}

/** Spread nodes across layout width by birth-year cohorts (chrono). */
function assignCohortX(nodes, marginLeft, layoutWidth) {
  const years = nodes.map((n) => n.birthYear).filter((y) => y != null);
  if (!years.length) {
    assignBandX(nodes, marginLeft, layoutWidth, () => 0);
    return;
  }
  const band = Math.max(8, (Math.max(...years) - Math.min(...years)) / 12);
  const fallback = Math.min(...years);
  assignBandX(nodes, marginLeft, layoutWidth, (n) =>
    Math.round((n.birthYear ?? fallback) / band) * band
  );
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
    return String(name || "")
      .replace(/\//g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function addNickname(indi, raw) {
    const v = String(raw || "")
      .replace(/^["'«]+|["'»]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!v || !indi) return;
    if (!Array.isArray(indi.nicknames)) indi.nicknames = [];
    const key = v.toLowerCase();
    if (indi.nicknames.some((n) => n.toLowerCase() === key)) return;
    if (String(indi.name || "").toLowerCase() === key) return;
    indi.nicknames.push(v);
    indi.nickname = indi.nicknames.join(" · ");
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
          nickname: null,
          nicknames: [],
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
            case "NAME": {
              const formatted = formatName(value);
              if (!currentIndividual.name) {
                currentIndividual.name = formatted;
              } else {
                addNickname(currentIndividual, formatted);
              }
              currentContext = "name";
              currentField = null;
              break;
            }
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
              if (tag === "NICK" || tag === "_AKA" || tag === "AKA") {
                addNickname(currentIndividual, value);
              }
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

  // Deduplicate symmetric family edges for cleaner layered drawing
  if (isLayeredLayout(layoutMode)) {
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
  if (layoutMode === "genealogy") {
    assignGenerations(data.nodes, data.links);
  }

  const years = data.nodes.map((n) => n.birthYear).filter((y) => y != null);
  const minYear = years.length ? Math.min(...years) : 1200;
  const maxYear = years.length ? Math.max(...years) : 1400;
  const yearSpan = Math.max(maxYear - minYear, 1);
  const gens = data.nodes.map((n) => n.generation).filter((g) => g != null);
  const minGen = gens.length ? Math.min(...gens) : 0;
  const maxGen = gens.length ? Math.max(...gens) : 0;

  const spread = getHorizontalSpread();
  const margin = {
    top: 56,
    right: 120,
    bottom: 56,
    left: isLayeredLayout(layoutMode) ? 72 : 40,
  };
  const innerH = Math.max(height - margin.top - margin.bottom, 200);

  const layeredY = (d) => {
    if (layoutMode === "genealogy") {
      if (maxGen === minGen) return margin.top + innerH / 2;
      const t = ((d.generation ?? 0) - minGen) / (maxGen - minGen);
      return margin.top + t * innerH;
    }
    const t = (d.birthYear - minYear) / yearSpan;
    return margin.top + t * innerH;
  };
  // Virtual canvas wider than the viewport — pan horizontally to explore
  const layoutWidth = Math.max(
    (width - margin.left - margin.right) * spread,
    320
  );
  const worldCenterX = margin.left + layoutWidth / 2;

  // Initial positions
  const sorted =
    layoutMode === "genealogy"
      ? [...data.nodes].sort(
          (a, b) => (a.generation ?? 0) - (b.generation ?? 0)
        )
      : [...data.nodes].sort((a, b) => a.birthYear - b.birthYear);
  sorted.forEach((n) => {
    if (isLayeredLayout(layoutMode)) {
      n.fy = layeredY(n);
      n.y = n.fy;
      n.fx = null;
    } else {
      n.fy = null;
      n.fx = null;
      n.x = worldCenterX + (Math.random() - 0.5) * layoutWidth * 0.55;
      n.y = height / 2 + (Math.random() - 0.5) * height * 0.45;
    }
  });
  if (layoutMode === "chrono") {
    assignCohortX(sorted, margin.left, layoutWidth);
  } else if (layoutMode === "genealogy") {
    assignBandX(
      sorted,
      margin.left,
      layoutWidth,
      (n) => n.generation ?? 0
    );
  }

  const zoomRoot = svg.append("g").attr("class", "zoom-root");
  // Invisible hit surface so empty-space clicks clear selection
  zoomRoot
    .append("rect")
    .attr("class", "graph-backdrop")
    .attr("x", -4000)
    .attr("y", -4000)
    .attr("width", 12000)
    .attr("height", 12000)
    .attr("fill", "transparent")
    .style("cursor", "default")
    .on("click", (event) => {
      if (event.defaultPrevented) return;
      event.stopPropagation();
      clearGraphSelection();
    });
  const container = zoomRoot.append("g").attr("class", "graph-root");
  let zoomPanMoved = false;
  const zoom = d3
    .zoom()
    .scaleExtent([0.15, 4])
    .on("start", () => {
      zoomPanMoved = false;
    })
    .on("zoom", (e) => {
      zoomRoot.attr("transform", e.transform);
      const src = e.sourceEvent;
      if (
        src &&
        (src.type === "mousemove" ||
          src.type === "touchmove" ||
          src.type === "wheel")
      ) {
        zoomPanMoved = true;
      }
    })
    .on("end", () => {
      // Keep pan flag until after the trailing click, then release
      setTimeout(() => {
        zoomPanMoved = false;
      }, 50);
    });
  svg.call(zoom);
  svg.on("click.clearFocus", (event) => {
    if (event.defaultPrevented || zoomPanMoved) return;
    // Node / link handlers stopPropagation; anything else is empty canvas
    clearGraphSelection();
  });

  // Side axis for layered layouts (years or generations)
  if (isLayeredLayout(layoutMode)) {
    const axis = container.append("g").attr("class", "timeline-axis");
    if (layoutMode === "genealogy") {
      const tickCount = maxGen - minGen;
      for (let g = minGen; g <= maxGen; g++) {
        const y =
          tickCount === 0
            ? margin.top + innerH / 2
            : margin.top + ((g - minGen) / tickCount) * innerH;
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
          .text(
            window.t
              ? window.t("generationLabel", { n: g })
              : `Gen. ${g}`
          );
      }
      axis
        .append("text")
        .attr("class", "timeline-caption")
        .attr("x", 12)
        .attr("y", 22)
        .text(window.t ? window.t("generationAncestors") : "Ancestors ↑");
      axis
        .append("text")
        .attr("class", "timeline-caption")
        .attr("x", 12)
        .attr("y", height - 18)
        .text(window.t ? window.t("generationDescendants") : "↓ Descendants");
    } else {
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
  }

  const familyLinks = data.links.filter((l) => l.type === "family");
  const assocLinks = data.links.filter((l) => l.type !== "family");

  if (isLayeredLayout(layoutMode)) {
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
      .force("y", d3.forceY(layeredY).strength(0.95))
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
    if (!isLayeredLayout(layoutMode)) {
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
      // Locked selection: ignore greyed-out nodes entirely
      if (!isPinnedNode(d.id)) return;
      cancelHoverRestore();

      // After a node click: hovering another node highlights the pair
      // (and their link, with the same tooltip as hovering that link).
      if (
        lastFocusedNode &&
        d.id !== lastFocusedNode.id &&
        !lastFocusedLink
      ) {
        applyPinnedNodePairHover(lastFocusedNode.id, d, tooltip, event);
        return;
      }

      activeHover = { kind: "node", id: d.id };
      showPersonHoverTooltip(d, tooltip, event);
      if (isSelectionPinned()) return;
      emphasizeNeighborhood(d.id, {
        raiseId: null,
        duration: 100,
        raise: false,
      });
    })
    .on("mousemove", (event, d) => {
      if (!isPinnedNode(d.id)) return;
      tooltip
        .style("top", event.pageY + 10 + "px")
        .style("left", event.pageX + 10 + "px");
    })
    .on("mouseleave", (event, d) => {
      if (!isPinnedNode(d.id) && isSelectionPinned()) return;
      if (
        activeHover?.kind === "node" ||
        activeHover?.kind === "pair" ||
        activeHover?.kind === "link"
      ) {
        activeHover = null;
      }
      tooltip.style("display", "none");
      scheduleHoverRestore();
    });

  // Leaving the canvas entirely must always clear hover emphasis
  svg.on("mouseleave.hoverClear", () => {
    activeHover = null;
    tooltip.style("display", "none");
    scheduleHoverRestore();
  });

  let pressTimer;
  const longPressDuration = 500;

  node.on("click", (event, d) => {
    // d3-drag marks defaultPrevented when a real drag happened
    if (event.defaultPrevented || nodeDragMoved) return;
    // While pinned, only the focused neighborhood stays clickable
    if (isSelectionPinned() && !isPinnedNode(d.id)) {
      event.stopPropagation();
      return;
    }
    cancelHoverRestore();
    event.stopPropagation();
    focusNode(d);
  });

  node
    .on("mousedown", (event, d) => {
      if (isSelectionPinned() && !isPinnedNode(d.id)) return;
      pressTimer = setTimeout(() => {
        cancelHoverRestore();
        focusNode(d);
      }, longPressDuration);
    })
    .on("mouseup", () => clearTimeout(pressTimer))
    .on("mouseleave", () => clearTimeout(pressTimer));

  node
    .on("touchstart", (event, d) => {
      if (isSelectionPinned() && !isPinnedNode(d.id)) return;
      pressTimer = setTimeout(() => {
        cancelHoverRestore();
        focusNode(d);
      }, longPressDuration);
    })
    .on("touchend", () => clearTimeout(pressTimer));

  simulation.on("tick", () => {
    if (isLayeredLayout(layoutMode)) {
      data.nodes.forEach((d) => {
        const targetY = layeredY(d);
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
  updateLinkDepthModel(data.nodes, data.links);
  if (isSelectionPinned()) restorePersistentEmphasis();
}

function linkEnds(link) {
  return {
    sourceId: typeof link.source === "object" ? link.source.id : link.source,
    targetId: typeof link.target === "object" ? link.target.id : link.target,
  };
}

/**
 * Immediate family nucleus: ego + parents / children / siblings
 * (Parent / Sibling edges only — no spouses, no ASSO).
 * @param {"all"|"parents"|"children"|"siblings"} kind
 */
function familyNucleusIds(nodeId, kind = nucleusKind, links = allLinks) {
  const ids = new Set([nodeId]);
  const wantParents = kind === "all" || kind === "parents";
  const wantChildren = kind === "all" || kind === "children";
  const wantSiblings = kind === "all" || kind === "siblings";

  links.forEach((link) => {
    if (link.type !== "family") return;
    const { sourceId, targetId } = linkEnds(link);
    if (link.relation === "Parent") {
      // source = parent, target = child
      if (wantParents && targetId === nodeId) ids.add(sourceId);
      if (wantChildren && sourceId === nodeId) ids.add(targetId);
      return;
    }
    if (link.relation === "Sibling" && wantSiblings) {
      if (sourceId === nodeId) ids.add(targetId);
      if (targetId === nodeId) ids.add(sourceId);
    }
  });
  return ids;
}

function makeNucleusLinkKeep(ids, kind = nucleusKind) {
  return (link) => {
    if (link.type !== "family") return false;
    const { sourceId, targetId } = linkEnds(link);
    if (!ids.has(sourceId) || !ids.has(targetId)) return false;
    if (kind === "parents" || kind === "children") {
      return link.relation === "Parent";
    }
    if (kind === "siblings") return link.relation === "Sibling";
    return link.relation === "Parent" || link.relation === "Sibling";
  };
}

function neighborIdsFor(nodeId) {
  if (focusScope === "nucleus") return familyNucleusIds(nodeId);
  return focusNeighborhoodIds(nodeId, currentLinkDepth);
}

function focusedLinkKeep(nodeId) {
  if (focusScope === "nucleus") {
    const ids = familyNucleusIds(nodeId);
    return makeNucleusLinkKeep(ids);
  }
  return makeFocusLinkKeep(nodeId, currentLinkDepth);
}

function isSelectionPinned() {
  return Boolean(lastFocusedNode || lastFocusedLink);
}

function isPinnedNode(id) {
  if (!isSelectionPinned()) return true;
  if (lastFocusedNode) return neighborIdsFor(lastFocusedNode.id).has(id);
  if (lastFocusedLink) {
    const { sourceId, targetId } = linkEnds(lastFocusedLink);
    return id === sourceId || id === targetId;
  }
  return true;
}

function isPinnedLink(link) {
  if (!isSelectionPinned()) return true;
  if (lastFocusedNode) {
    return focusedLinkKeep(lastFocusedNode.id)(link);
  }
  if (lastFocusedLink) {
    const a = linkEnds(lastFocusedLink);
    const e = linkEnds(link);
    return (
      (e.sourceId === a.sourceId && e.targetId === a.targetId) ||
      (e.sourceId === a.targetId && e.targetId === a.sourceId)
    );
  }
  return true;
}

function linkKeepBetween(aId, bId) {
  return (l) => {
    const e = linkEnds(l);
    return (
      (e.sourceId === aId && e.targetId === bId) ||
      (e.sourceId === bId && e.targetId === aId)
    );
  };
}

/** Any graph edge (family or ASSO) between two characters. */
function findAnyLinkBetween(aId, bId, links = allLinks) {
  return (
    links.find((l) => {
      const { sourceId, targetId } = linkEnds(l);
      return (
        (sourceId === aId && targetId === bId) ||
        (sourceId === bId && targetId === aId)
      );
    }) || null
  );
}

function emphasizeNodePair(aId, bId, { duration = 100, raise = false } = {}) {
  const keep = linkKeepBetween(aId, bId);
  emphasizeGraph({
    nodeIds: new Set([aId, bId]),
    linkKeep: keep,
    raiseId: bId,
    duration,
    raise,
    // Pair hover should show the connecting edge even if depth-filtered
    revealKeptLinks: true,
  });
}

function showPersonHoverTooltip(person, tooltip, event) {
  if (!person || !tooltip) return;
  const yearLabel =
    person.birthYear != null
      ? `${person.birthYearInferred ? "~" : ""}${Math.round(person.birthYear)}`
      : "?";
  tooltip.style("display", "block");
  tooltip.html(
    `<strong>${person.name}</strong><br>${person.occupation || ""}<br>${
      window.t ? window.t("birth") : "Birth"
    }: ${yearLabel}`
  );
  if (event) {
    tooltip
      .style("top", event.pageY + 10 + "px")
      .style("left", event.pageX + 10 + "px");
  }
}

function showLinkHoverTooltip(link, tooltip, event) {
  if (!link || !tooltip) return;
  const { sourceId, targetId } = linkEnds(link);
  const source = allNodes.find((n) => n.id === sourceId);
  const target = allNodes.find((n) => n.id === targetId);
  if (!source || !target) return;
  const t = window.t || ((k) => k);
  const reverseLink = allLinks.find((l) => {
    const e = linkEnds(l);
    return e.sourceId === targetId && e.targetId === sourceId;
  });
  const phrasesHtml = formatLinkRelationHeaderHtml(
    link,
    reverseLink,
    source,
    target,
    t
  );
  const evidenceHtml = formatRelationEvidenceHtml(link, reverseLink);
  tooltip.style("display", "block").html(`${phrasesHtml}${evidenceHtml}`);
  if (event) {
    tooltip
      .style("top", event.pageY + 10 + "px")
      .style("left", event.pageX + 10 + "px");
  }
}

/**
 * While a character is focused, hovering another node highlights both
 * (and their connecting edge when it exists — with the link tooltip).
 */
function applyPinnedNodePairHover(focusedId, hoveredNode, tooltip, event) {
  const hoveredId = hoveredNode.id;
  const link = findAnyLinkBetween(focusedId, hoveredId);
  if (link) {
    const { sourceId, targetId } = linkEnds(link);
    activeHover = { kind: "link", key: `${sourceId}→${targetId}` };
    emphasizeNodePair(focusedId, hoveredId, { duration: 100, raise: true });
    showLinkHoverTooltip(link, tooltip, event);
    return;
  }
  activeHover = { kind: "pair", ids: [focusedId, hoveredId] };
  emphasizeGraph({
    nodeIds: new Set([focusedId, hoveredId]),
    linkKeep: () => false,
    raiseId: hoveredId,
    duration: 100,
    raise: true,
  });
  showPersonHoverTooltip(hoveredNode, tooltip, event);
}

function syncHitPointerEvents(keepLink, locked, revealKeptLinks = false) {
  const linkVisible = (l) =>
    (revealKeptLinks && keepLink(l)) || isLinkInDepth(l);
  d3.selectAll(".link-hit")
    .classed("is-emphasized", (l) => keepLink(l) && linkVisible(l))
    .classed("is-dimmed", (l) => locked && !keepLink(l))
    .classed("is-depth-hidden", (l) => !linkVisible(l))
    .style("pointer-events", (l) => {
      if (!linkVisible(l)) return "none";
      return !locked || keepLink(l) ? "stroke" : "none";
    });
}

function emphasizeGraph({
  nodeIds = null,
  linkKeep = null,
  raiseId = null,
  duration = 140,
  raise = true,
  revealKeptLinks = false,
} = {}) {
  const keepNode = nodeIds ? (id) => nodeIds.has(id) : () => true;
  const keepLink =
    linkKeep ||
    ((l) => {
      if (!nodeIds) return true;
      const { sourceId, targetId } = linkEnds(l);
      return keepNode(sourceId) && keepNode(targetId);
    });
  const locked = Boolean(nodeIds);
  const linkVisible = (l) =>
    (revealKeptLinks && keepLink(l)) || isLinkInDepth(l);

  d3.selectAll(".node")
    .classed("is-emphasized", (d) => keepNode(d.id))
    .classed("is-dimmed", (d) => locked && !keepNode(d.id))
    .classed("is-locked-out", (d) => isSelectionPinned() && !keepNode(d.id))
    .interrupt()
    .transition()
    .duration(duration)
    .style("opacity", (d) => (keepNode(d.id) ? 1 : 0.12));

  d3.selectAll(".link")
    .classed("is-emphasized", (l) => keepLink(l) && linkVisible(l))
    .classed("is-dimmed", (l) => locked && !keepLink(l))
    .classed("is-depth-hidden", (l) => !linkVisible(l))
    .interrupt()
    .transition()
    .duration(duration)
    .style("opacity", (l) => {
      if (!linkVisible(l)) return 0;
      return keepLink(l) ? 1 : 0.07;
    });

  // dimmed hits must not capture hover/click while a selection is active
  syncHitPointerEvents(
    keepLink,
    locked || isSelectionPinned(),
    revealKeptLinks
  );

  if (!raise) return;

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
}

function cancelHoverRestore() {
  clearTimeout(hoverRestoreTimer);
  hoverRestoreTimer = null;
}

function scheduleHoverRestore() {
  cancelHoverRestore();
  hoverRestoreTimer = setTimeout(() => {
    hoverRestoreTimer = null;
    // Pointer moved to another node/link — keep that hover
    if (activeHover) return;
    restorePersistentEmphasis();
  }, 40);
}

function emphasizeNeighborhood(
  nodeId,
  { raiseId = nodeId, duration = 140, raise = true } = {}
) {
  const depth = currentLinkDepth;
  const ids = focusNeighborhoodIds(nodeId, depth);
  emphasizeGraph({
    nodeIds: ids,
    linkKeep: makeFocusLinkKeep(nodeId, depth),
    raiseId,
    duration,
    raise,
  });
}

function emphasizeFamilyNucleus(
  nodeId,
  { raiseId = nodeId, duration = 140, raise = true, kind = nucleusKind } = {}
) {
  const ids = familyNucleusIds(nodeId, kind);
  emphasizeGraph({
    nodeIds: ids,
    linkKeep: makeNucleusLinkKeep(ids, kind),
    raiseId,
    duration,
    raise,
  });
}

/** Respect current focusScope (depth neighborhood vs family nucleus). */
function emphasizeFocusedNode(
  nodeId,
  { raiseId = nodeId, duration = 140, raise = true } = {}
) {
  if (focusScope === "nucleus") {
    emphasizeFamilyNucleus(nodeId, { raiseId, duration, raise });
  } else {
    emphasizeNeighborhood(nodeId, { raiseId, duration, raise });
  }
}

function clearGraphEmphasis(duration = 160) {
  activeHover = null;
  d3.selectAll(".node")
    .classed("is-dimmed", false)
    .classed("is-emphasized", false)
    .classed("is-locked-out", false)
    .interrupt()
    .transition()
    .duration(duration)
    .style("opacity", 1);
  d3.selectAll(".link, .link-hit")
    .classed("is-dimmed", false)
    .classed("is-emphasized", false)
    .classed("is-locked-out", false)
    .classed("is-depth-hidden", (l) => !isLinkInDepth(l))
    .interrupt()
    .transition()
    .duration(duration)
    .style("opacity", (l) => (isLinkInDepth(l) ? 1 : 0));
  d3.selectAll(".link-hit").style("pointer-events", (l) =>
    isLinkInDepth(l) ? "stroke" : "none"
  );
  d3.selectAll(".node circle, .node text")
    .interrupt()
    .transition()
    .duration(duration)
    .style("opacity", null);
}

function restorePersistentEmphasis() {
  // Active hover preview wins — including pair/link preview while pinned
  if (activeHover?.kind === "link") {
    const [sourceId, targetId] = activeHover.key.split("→");
    emphasizeNodePair(sourceId, targetId, { duration: 80, raise: false });
    return;
  }
  if (activeHover?.kind === "pair" && activeHover.ids?.length === 2) {
    const [aId, bId] = activeHover.ids;
    emphasizeGraph({
      nodeIds: new Set([aId, bId]),
      linkKeep: () => false,
      raiseId: bId,
      duration: 80,
      raise: false,
    });
    return;
  }
  if (activeHover?.kind === "node" && !lastFocusedLink) {
    // Hovering the focused node itself (or free exploration): neighborhood
    if (!isSelectionPinned() || activeHover.id === lastFocusedNode?.id) {
      if (isSelectionPinned() && focusScope === "nucleus") {
        emphasizeFocusedNode(activeHover.id, {
          raiseId: activeHover.id,
          duration: 80,
          raise: true,
        });
      } else {
        emphasizeNeighborhood(activeHover.id, {
          raiseId: isSelectionPinned() ? activeHover.id : null,
          duration: 80,
          raise: isSelectionPinned(),
        });
      }
      return;
    }
  }

  if (lastFocusedNode) {
    const id = lastFocusedNode.id;
    lastFocusedNode = allNodes.find((n) => n.id === id) || lastFocusedNode;
    emphasizeFocusedNode(id, {
      raiseId: id,
      duration: 120,
      raise: true,
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
    emphasizeNodePair(sourceId, targetId, { duration: 120, raise: true });
    return;
  }
  clearGraphEmphasis();
}

function enrichLinkTooltips() {
  const tooltip = d3.select(".tooltip");

  d3.selectAll(".link-hit")
    .on("mouseenter", function (event, d) {
      if (!isPinnedLink(d)) return;
      cancelHoverRestore();
      const { sourceId, targetId } = linkEnds(d);
      const source = allNodes.find((n) => n.id === sourceId);
      const target = allNodes.find((n) => n.id === targetId);
      if (!source || !target) return;

      activeHover = { kind: "link", key: `${sourceId}→${targetId}` };
      showLinkHoverTooltip(d, tooltip, event);
      // Always isolate the pair (also while a character is focused)
      emphasizeNodePair(sourceId, targetId, { duration: 100, raise: false });
    })
    .on("mousemove", function (event, d) {
      if (!isPinnedLink(d)) return;
      tooltip
        .style("top", event.pageY + 10 + "px")
        .style("left", event.pageX + 10 + "px");
    })
    .on("mouseleave", function (event, d) {
      if (!isPinnedLink(d) && isSelectionPinned()) return;
      if (activeHover?.kind === "link") activeHover = null;
      tooltip.style("display", "none");
      scheduleHoverRestore();
    })
    .on("click", function (event, d) {
      if (isSelectionPinned() && !isPinnedLink(d)) {
        event.stopPropagation();
        return;
      }
      cancelHoverRestore();
      activeHover = null;
      const ends = linkEnds(d);
      lastFocusedLink = d;
      lastFocusedNode = null;

      if (prioritizeClickOverFilters()) {
        rebuildCurrentGraph();
        lastFocusedLink =
          allLinks.find((l) => {
            const e = linkEnds(l);
            return (
              (e.sourceId === ends.sourceId &&
                e.targetId === ends.targetId) ||
              (e.sourceId === ends.targetId &&
                e.targetId === ends.sourceId)
            );
          }) || lastFocusedLink;
      }

      const { sourceId, targetId } = linkEnds(lastFocusedLink);
      const source =
        allNodes.find((n) => n.id === sourceId) ||
        (window.allNodes || []).find((n) => n.id === sourceId);
      const target =
        allNodes.find((n) => n.id === targetId) ||
        (window.allNodes || []).find((n) => n.id === targetId);
      const reverseLink = allLinks.find((l) => {
        const e = linkEnds(l);
        return e.sourceId === targetId && e.targetId === sourceId;
      });

      const t = window.t || ((k) => k);
      const evidenceHtml = formatRelationEvidenceHtml(
        lastFocusedLink,
        reverseLink
      );
      const phrasesHtml = formatLinkRelationHeaderHtml(
        lastFocusedLink,
        reverseLink,
        source,
        target,
        t
      );

      showModalContent(source, target, `${phrasesHtml}${evidenceHtml}`);

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
        raise: true,
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
    blood: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.8c2.8 3.6 6.5 7.6 6.5 11.2A6.5 6.5 0 0 1 12 20.5 6.5 6.5 0 0 1 5.5 14C5.5 10.4 9.2 6.4 12 2.8Z"/></svg>`,
    link: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10.5 13.5a3.5 3.5 0 0 1 0-5l2.2-2.2a3.5 3.5 0 0 1 5 5l-1 1-1.4-1.4 1-1a1.5 1.5 0 0 0-2.1-2.1l-2.2 2.2a1.5 1.5 0 0 0 0 2.1Zm3 3a3.5 3.5 0 0 1 0 5l-2.2 2.2a3.5 3.5 0 1 1-5-5l1-1 1.4 1.4-1 1a1.5 1.5 0 1 0 2.1 2.1l2.2-2.2a1.5 1.5 0 0 0 0-2.1ZM9.4 16l6.6-6.6L17.4 11l-6.6 6.6Z"/></svg>`,
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

function renderCollapsibleSheetSection(
  icon,
  title,
  bodyHtml,
  { open = false, count = null, extraClass = "" } = {}
) {
  if (!bodyHtml) return "";
  const countHtml =
    count != null
      ? `<span class="sheet-count">${escapeHtml(String(count))}</span>`
      : "";
  return `
    <details class="sheet-section sheet-section--fold ${extraClass}" ${
      open ? "open" : ""
    }>
      <summary class="sheet-section-head">
        <span class="sheet-icon">${sheetIcon(icon)}</span>
        <h3>${escapeHtml(title)}</h3>
        ${countHtml}
        <span class="sheet-fold-chevron" aria-hidden="true"></span>
      </summary>
      <div class="sheet-section-body">${bodyHtml}</div>
    </details>
  `;
}

function masterNodes() {
  return window.allNodes?.length ? window.allNodes : allNodes;
}

function masterLinks() {
  return window.allLinks?.length ? window.allLinks : allLinks;
}

function findFamilyLinkBetween(aId, bId, links = masterLinks()) {
  return (
    links.find((l) => {
      if (l.type !== "family") return false;
      const { sourceId, targetId } = linkEnds(l);
      return (
        (sourceId === aId && targetId === bId) ||
        (sourceId === bId && targetId === aId)
      );
    }) || null
  );
}

function findAssocLinksBetween(aId, bId, links = masterLinks()) {
  const forward =
    links.find((l) => {
      if (l.type === "family") return false;
      const { sourceId, targetId } = linkEnds(l);
      return sourceId === aId && targetId === bId;
    }) || null;
  const reverse =
    links.find((l) => {
      if (l.type === "family") return false;
      const { sourceId, targetId } = linkEnds(l);
      return sourceId === bId && targetId === aId;
    }) || null;
  return { forward, reverse };
}

/** Direction of one family hop from `fromId` toward `toId`. */
function familyStepKind(fromId, toId, link) {
  if (!link) return "family";
  const { sourceId, targetId } = linkEnds(link);
  if (link.relation === "Spouse") return "spouse";
  if (link.relation === "Sibling") return "sibling";
  if (link.relation === "Parent") {
    if (sourceId === fromId && targetId === toId) return "child";
    if (sourceId === toId && targetId === fromId) return "parent";
  }
  return "family";
}

function invertKinSteps(steps) {
  const inv = { parent: "child", child: "parent", spouse: "spouse", sibling: "sibling", family: "family" };
  return steps.map((s) => inv[s] || "family").reverse();
}

function shortestFamilyPath(fromId, toId, adj = null) {
  const graph = adj || familyAdj;
  if (fromId === toId) return [fromId];
  if (!graph.has(fromId)) return null;
  const prev = new Map([[fromId, null]]);
  const queue = [fromId];
  for (let i = 0; i < queue.length; i++) {
    const u = queue[i];
    for (const v of graph.get(u) || []) {
      if (prev.has(v)) continue;
      prev.set(v, u);
      if (v === toId) {
        const path = [toId];
        for (let x = u; x != null; x = prev.get(x)) path.push(x);
        return path.reverse();
      }
      queue.push(v);
    }
  }
  return null;
}

/** "de Isabelle" / "d'Édouard" / "of Edward" / "de Eduardo" */
function formatOfObject(name) {
  const n = String(name || "").trim();
  const lang = window.getLang ? window.getLang() : "en";
  if (lang === "fr") {
    return /^[aeiouàâäéèêëïîôöùûüœy]/i.test(n) ? `d’${n}` : `de ${n}`;
  }
  if (lang === "es") return `de ${n}`;
  return `of ${n}`;
}

/**
 * Steps are traversal directions on Parent edges:
 * - "child"  = walked parent→child  → subject is a parent of object
 * - "parent" = walked child→parent  → subject is a child of object
 */
function kinshipRoleKeyFromSteps(steps) {
  if (!steps.length) return "kinFamilyDegreeOf";
  const key = steps.join(".");
  const exact = {
    child: "kinParentOf",
    parent: "kinChildOf",
    spouse: "spouseOf",
    sibling: "siblingOf",
    "child.child": "kinGrandparentOf",
    "parent.parent": "kinGrandchildOf",
    "child.child.child": "kinGreatGrandparentOf",
    "parent.parent.parent": "kinGreatGrandchildOf",
    "child.child.child.child": "kinGreatGreatGrandparentOf",
    "parent.parent.parent.parent": "kinGreatGreatGrandchildOf",
    // subject → parent → parent's sibling = uncle/aunt of that sibling? 
    // subject walked up then sideways: subject is nephew/niece of the uncle
    "parent.sibling": "kinNephewNieceOf",
    // subject → sibling → sibling's child = uncle/aunt
    "sibling.child": "kinUncleAuntOf",
    "parent.sibling.child": "kinCousinOf",
    // subject → child → child's spouse = parent-in-law
    "child.spouse": "kinParentInLawOf",
    // subject → spouse → spouse's parent = child-in-law
    "spouse.parent": "kinChildInLawOf",
    // subject → spouse → spouse's child
    "spouse.child": "kinSpouseChildOf",
    // subject → parent → parent's spouse = stepchild of that spouse / child of step-parent
    "parent.spouse": "kinStepParentOf",
    "sibling.spouse": "kinSiblingInLawOf",
    "spouse.sibling": "kinSiblingInLawOf",
  };
  if (exact[key]) return exact[key];
  // walked only upward toward ancestors → subject is descendant
  if (steps.every((s) => s === "parent")) return "kinDescendantDegreeOf";
  // walked only downward toward descendants → subject is ancestor
  if (steps.every((s) => s === "child")) return "kinAncestorDegreeOf";
  return "kinFamilyDegreeOf";
}

function kinshipRoleLabel(steps, t) {
  const roleKey = kinshipRoleKeyFromSteps(steps);
  return t(roleKey, { degree: steps.length });
}

/**
 * Lineal ancestor label (subject is parent / grand-parent / arrière-… of object).
 * degree = number of parent→child hops from subject down to object.
 */
function linealAncestorRoleLabel(degree, sex, t) {
  const lang = window.getLang ? window.getLang() : "en";
  if (degree <= 0) return t("kinRoleRelative");
  if (lang === "fr") {
    if (degree === 1) {
      return sex === "M"
        ? t("kinRoleFather")
        : sex === "F"
          ? t("kinRoleMother")
          : t("kinRoleParent");
    }
    if (degree === 2) {
      return sex === "M"
        ? "grand-père"
        : sex === "F"
          ? "grand-mère"
          : "grand-parent";
    }
    const prefix = "arrière-".repeat(degree - 2);
    return sex === "M"
      ? `${prefix}grand-père`
      : sex === "F"
        ? `${prefix}grand-mère`
        : `${prefix}grand-parent`;
  }
  if (lang === "es") {
    if (degree === 1) {
      return sex === "M"
        ? t("kinRoleFather")
        : sex === "F"
          ? t("kinRoleMother")
          : t("kinRoleParent");
    }
    if (degree === 2) {
      return sex === "M" ? "abuelo" : sex === "F" ? "abuela" : "abuelo/a";
    }
    if (degree === 3) {
      return sex === "M"
        ? "bisabuelo"
        : sex === "F"
          ? "bisabuela"
          : "bisabuelo/a";
    }
    if (degree === 4) {
      return sex === "M"
        ? "tatarabuelo"
        : sex === "F"
          ? "tatarabuela"
          : "tatarabuelo/a";
    }
    return t("kinAncestorDegreeOf", { degree });
  }
  // English
  if (degree === 1) {
    return sex === "M"
      ? t("kinRoleFather")
      : sex === "F"
        ? t("kinRoleMother")
        : t("kinRoleParent");
  }
  if (degree === 2) {
    return sex === "M"
      ? "grandfather"
      : sex === "F"
        ? "grandmother"
        : "grandparent";
  }
  const greats = "great-".repeat(degree - 2);
  return sex === "M"
    ? `${greats}grandfather`
    : sex === "F"
      ? `${greats}grandmother`
      : `${greats}grandparent`;
}

/**
 * Lineal descendant label (subject is child / petit-fils / arrière-… of object).
 * degree = number of child→parent hops from subject up to object.
 */
function linealDescendantRoleLabel(degree, sex, t) {
  const lang = window.getLang ? window.getLang() : "en";
  if (degree <= 0) return t("kinRoleRelative");
  if (lang === "fr") {
    if (degree === 1) {
      return sex === "M"
        ? t("kinRoleSon")
        : sex === "F"
          ? t("kinRoleDaughter")
          : t("kinRoleChild");
    }
    if (degree === 2) {
      return sex === "M"
        ? "petit-fils"
        : sex === "F"
          ? "petite-fille"
          : "petit-enfant";
    }
    const prefix = "arrière-".repeat(degree - 2);
    return sex === "M"
      ? `${prefix}petit-fils`
      : sex === "F"
        ? `${prefix}petite-fille`
        : `${prefix}petit-enfant`;
  }
  if (lang === "es") {
    if (degree === 1) {
      return sex === "M"
        ? t("kinRoleSon")
        : sex === "F"
          ? t("kinRoleDaughter")
          : t("kinRoleChild");
    }
    if (degree === 2) {
      return sex === "M" ? "nieto" : sex === "F" ? "nieta" : "nieto/a";
    }
    if (degree === 3) {
      return sex === "M"
        ? "bisnieto"
        : sex === "F"
          ? "bisnieta"
          : "bisnieto/a";
    }
    if (degree === 4) {
      return sex === "M"
        ? "tataranieto"
        : sex === "F"
          ? "tataranieta"
          : "tataranieto/a";
    }
    return t("kinDescendantDegreeOf", { degree });
  }
  if (degree === 1) {
    return sex === "M"
      ? t("kinRoleSon")
      : sex === "F"
        ? t("kinRoleDaughter")
        : t("kinRoleChild");
  }
  if (degree === 2) {
    return sex === "M"
      ? "grandson"
      : sex === "F"
        ? "granddaughter"
        : "grandchild";
  }
  const greats = "great-".repeat(degree - 2);
  return sex === "M"
    ? `${greats}grandson`
    : sex === "F"
      ? `${greats}granddaughter`
      : `${greats}grandchild`;
}

/** Resolve M/F from a person object or id (master + live graph). */
function resolvePersonSex(subjectRef) {
  if (subjectRef && typeof subjectRef === "object") {
    if (subjectRef.sex === "M" || subjectRef.sex === "F") return subjectRef.sex;
    subjectRef = subjectRef.id;
  }
  if (!subjectRef) return null;
  const n =
    nodeById(subjectRef) ||
    allNodes.find((x) => x.id === subjectRef) ||
    (window.allNodes || []).find((x) => x.id === subjectRef);
  return n?.sex === "M" || n?.sex === "F" ? n.sex : null;
}

function personRefId(subjectRef) {
  return subjectRef && typeof subjectRef === "object"
    ? subjectRef.id
    : subjectRef;
}

function personRefName(subjectRef) {
  if (subjectRef && typeof subjectRef === "object" && subjectRef.name) {
    return subjectRef.name;
  }
  return nodeNameById(personRefId(subjectRef));
}

/** Sex-aware label for a kinshipRoleKeyFromSteps key. */
function genderedRoleFromKey(roleKey, sex, degree, t) {
  switch (roleKey) {
    case "spouseOf":
      return sex === "M"
        ? t("kinRoleHusband")
        : sex === "F"
          ? t("kinRoleWife")
          : t("kinRoleSpouse");
    case "siblingOf":
      return sex === "M"
        ? t("kinRoleBrother")
        : sex === "F"
          ? t("kinRoleSister")
          : t("kinRoleSibling");
    case "kinParentOf":
      return sex === "M"
        ? t("kinRoleFather")
        : sex === "F"
          ? t("kinRoleMother")
          : t("kinRoleParent");
    case "kinChildOf":
      return sex === "M"
        ? t("kinRoleSon")
        : sex === "F"
          ? t("kinRoleDaughter")
          : t("kinRoleChild");
    case "kinGrandparentOf":
      return linealAncestorRoleLabel(2, sex, t);
    case "kinGrandchildOf":
      return linealDescendantRoleLabel(2, sex, t);
    case "kinGreatGrandparentOf":
      return linealAncestorRoleLabel(3, sex, t);
    case "kinGreatGrandchildOf":
      return linealDescendantRoleLabel(3, sex, t);
    case "kinGreatGreatGrandparentOf":
      return linealAncestorRoleLabel(4, sex, t);
    case "kinGreatGreatGrandchildOf":
      return linealDescendantRoleLabel(4, sex, t);
    case "kinUncleAuntOf":
      return sex === "M"
        ? t("kinRoleUncle")
        : sex === "F"
          ? t("kinRoleAunt")
          : t("kinUncleAuntOf");
    case "kinNephewNieceOf":
      return sex === "M"
        ? t("kinRoleNephew")
        : sex === "F"
          ? t("kinRoleNiece")
          : t("kinNephewNieceOf");
    case "kinCousinOf":
      return sex === "M"
        ? t("kinRoleCousinM")
        : sex === "F"
          ? t("kinRoleCousinF")
          : t("kinCousinOf");
    case "kinSiblingInLawOf":
      return sex === "M"
        ? t("kinRoleBrotherInLaw")
        : sex === "F"
          ? t("kinRoleSisterInLaw")
          : t("kinSiblingInLawOf");
    case "kinChildInLawOf":
      return sex === "M"
        ? t("kinRoleSonInLaw")
        : sex === "F"
          ? t("kinRoleDaughterInLaw")
          : t("kinChildInLawOf");
    case "kinParentInLawOf":
      return sex === "M"
        ? t("kinRoleFatherInLaw")
        : sex === "F"
          ? t("kinRoleMotherInLaw")
          : t("kinParentInLawOf");
    case "kinSpouseChildOf":
      return sex === "M"
        ? t("kinRoleStepfather")
        : sex === "F"
          ? t("kinRoleStepmother")
          : t("kinSpouseChildOf");
    case "kinStepParentOf":
      return sex === "M"
        ? t("kinRoleStepson")
        : sex === "F"
          ? t("kinRoleStepdaughter")
          : t("kinStepParentOf");
    case "kinAncestorDegreeOf":
      return linealAncestorRoleLabel(degree, sex, t);
    case "kinDescendantDegreeOf":
      return linealDescendantRoleLabel(degree, sex, t);
    default:
      return t(roleKey, { degree });
  }
}

/** Compact role for a path: lineal arrière-/great- labels, else mapped kinship role. */
function compactKinshipRoleLabel(steps, subjectRef, t) {
  const sex = resolvePersonSex(subjectRef);
  if (steps.length && steps.every((s) => s === "child")) {
    return linealAncestorRoleLabel(steps.length, sex, t);
  }
  if (steps.length && steps.every((s) => s === "parent")) {
    return linealDescendantRoleLabel(steps.length, sex, t);
  }
  if (steps.length === 1) {
    return atomicStepRoleLabel(subjectRef, steps[0], t);
  }
  return genderedRoleFromKey(
    kinshipRoleKeyFromSteps(steps),
    sex,
    steps.length,
    t
  );
}

function formatCompactKinshipPhrase(subjectRef, objectName, steps, t) {
  return formatRelationSentencePlain(
    formatRelationSentenceParts(
      personRefName(subjectRef),
      compactKinshipRoleLabel(steps, subjectRef, t),
      objectName,
      t
    )
  );
}

function formatCompactKinshipPhraseHtml(subjectRef, objectName, steps, t) {
  return formatRelationSentenceHtml(
    formatRelationSentenceParts(
      personRefName(subjectRef),
      compactKinshipRoleLabel(steps, subjectRef, t),
      objectName,
      t
    )
  );
}

/**
 * Atomic hop label from subject → object (sex-aware when possible).
 * step "child"  = subject is parent of object
 * step "parent" = subject is child of object
 */
function atomicStepRoleLabel(subjectRef, step, t) {
  const sex = resolvePersonSex(subjectRef);
  if (step === "child") {
    if (sex === "M") return t("kinRoleFather");
    if (sex === "F") return t("kinRoleMother");
    return t("kinRoleParent");
  }
  if (step === "parent") {
    if (sex === "M") return t("kinRoleSon");
    if (sex === "F") return t("kinRoleDaughter");
    return t("kinRoleChild");
  }
  if (step === "spouse") {
    if (sex === "M") return t("kinRoleHusband");
    if (sex === "F") return t("kinRoleWife");
    return t("kinRoleSpouse");
  }
  if (step === "sibling") {
    if (sex === "M") return t("kinRoleBrother");
    if (sex === "F") return t("kinRoleSister");
    return t("kinRoleSibling");
  }
  return t("kinRoleRelative");
}

/**
 * Explain a multi-hop blood path as a readable chain, e.g.
 * "A is father of B, who is mother of C, who is sister of D".
 */
function formatKinshipPathChainPlain(pathIds, steps, t) {
  if (!pathIds || pathIds.length < 2 || !steps?.length) return "";
  const names = pathIds.map((id) => nodeNameById(id));
  const role0 = atomicStepRoleLabel(pathIds[0], steps[0], t);
  let text = `${names[0]} ${t("kinIs")} ${role0} ${formatOfObject(names[1])}`;
  for (let i = 1; i < steps.length; i++) {
    const role = atomicStepRoleLabel(pathIds[i], steps[i], t);
    text += `, ${t("kinPathWhoIs")} ${role} ${formatOfObject(names[i + 1])}`;
  }
  return text;
}

function formatKinshipPathChainHtml(pathIds, steps, t) {
  if (!pathIds || pathIds.length < 2 || !steps?.length) return "";
  const names = pathIds.map((id) => nodeNameById(id));
  const role0 = atomicStepRoleLabel(pathIds[0], steps[0], t);
  let html = `${escapeHtml(names[0])} ${escapeHtml(t("kinIs"))} <strong class="rel-role">${escapeHtml(
    role0
  )}</strong> ${escapeHtml(formatOfObject(names[1]))}`;
  for (let i = 1; i < steps.length; i++) {
    const role = atomicStepRoleLabel(pathIds[i], steps[i], t);
    html += `, ${escapeHtml(t("kinPathWhoIs"))} <strong class="rel-role">${escapeHtml(
      role
    )}</strong> ${escapeHtml(formatOfObject(names[i + 1]))}`;
  }
  return html;
}

function formatRelationSentenceParts(subject, relation, object, t) {
  return {
    subject: String(subject || "").trim(),
    is: t("kinIs"),
    relation: String(relation || "").trim(),
    ofObject: formatOfObject(object),
  };
}

function formatRelationSentencePlain(parts) {
  if (!parts?.subject || !parts?.relation) return "";
  return `${parts.subject} ${parts.is} ${parts.relation} ${parts.ofObject}`;
}

function formatRelationSentenceHtml(parts) {
  if (!parts?.subject || !parts?.relation) return "";
  return `${escapeHtml(parts.subject)} ${escapeHtml(
    parts.is
  )} <strong class="rel-role">${escapeHtml(parts.relation)}</strong> ${escapeHtml(
    parts.ofObject
  )}`;
}

function formatKinshipPhrase(subject, object, steps, t) {
  return formatRelationSentencePlain(
    formatRelationSentenceParts(subject, kinshipRoleLabel(steps, t), object, t)
  );
}

function formatKinshipPhraseHtml(subject, object, steps, t) {
  return formatRelationSentenceHtml(
    formatRelationSentenceParts(subject, kinshipRoleLabel(steps, t), object, t)
  );
}

function formatAssocPhrase(subject, object, relationLabel, t) {
  if (!relationLabel || relationLabel === t("unknown")) {
    return null;
  }
  return formatRelationSentencePlain(
    formatRelationSentenceParts(subject, relationLabel, object, t)
  );
}

function formatAssocPhraseHtml(subject, object, relationLabel, t) {
  if (!relationLabel || relationLabel === t("unknown")) {
    return null;
  }
  return formatRelationSentenceHtml(
    formatRelationSentenceParts(subject, relationLabel, object, t)
  );
}

function renderRelationPhraseListHtml(phraseHtmls) {
  const items = (phraseHtmls || []).filter(Boolean);
  if (!items.length) return "";
  return `<ul class="relation-phrase-list">${items
    .map((html) => `<li class="relation-phrase">${html}</li>`)
    .join("")}</ul>`;
}

/**
 * Blood phrases: compact label first; optional hop-by-hop detail revealed on click.
 * @param {{ compactHtml: string, detailHtml?: string|null }[]} items
 */
function renderBloodPhraseListHtml(items, t) {
  const rows = (items || []).filter((it) => it?.compactHtml);
  if (!rows.length) return "";
  return `<ul class="relation-phrase-list">${rows
    .map((it) => {
      const detail = it.detailHtml
        ? `<button type="button" class="rel-path-toggle" data-rel-path-toggle aria-expanded="false">
            ${escapeHtml(t("kinPathShowDetail"))}
          </button>
          <div class="rel-path-detail" hidden>${it.detailHtml}</div>`
        : "";
      return `<li class="relation-phrase">
          <div class="relation-phrase-main">${it.compactHtml}</div>
          ${detail}
        </li>`;
    })
    .join("")}</ul>`;
}

/**
 * Explicit bidirectional phrases for a graph edge (family or ASSO).
 * Never emits "Unknown" — omits a side when there is no described relation.
 */
function formatLinkRelationPhrases(link, reverseLink, source, target, t) {
  const phrases = [];
  if (!source || !target) return phrases;

  if (link.type === "family") {
    const rel = link.relation;
    if (rel === "Parent") {
      // GED Parent edge: source → target means source is parent of target
      phrases.push(
        formatCompactKinshipPhrase(source, target.name, ["child"], t)
      );
      phrases.push(
        formatCompactKinshipPhrase(target, source.name, ["parent"], t)
      );
    } else if (rel === "Spouse") {
      phrases.push(
        formatCompactKinshipPhrase(source, target.name, ["spouse"], t)
      );
      phrases.push(
        formatCompactKinshipPhrase(target, source.name, ["spouse"], t)
      );
    } else if (rel === "Sibling") {
      phrases.push(
        formatCompactKinshipPhrase(source, target.name, ["sibling"], t)
      );
      phrases.push(
        formatCompactKinshipPhrase(target, source.name, ["sibling"], t)
      );
    } else {
      const step = familyStepKind(source.id, target.id, link);
      phrases.push(
        formatCompactKinshipPhrase(source, target.name, [step], t)
      );
      phrases.push(
        formatCompactKinshipPhrase(
          target,
          source.name,
          invertKinSteps([step]),
          t
        )
      );
    }
    return phrases;
  }

  const tr = window.translateRelation || ((r) => r);
  if (link.relation) {
    const fwd = formatAssocPhrase(
      source.name,
      target.name,
      tr(link.relation),
      t
    );
    if (fwd) phrases.push(fwd);
  }
  if (reverseLink?.relation) {
    const rev = formatAssocPhrase(
      target.name,
      source.name,
      tr(reverseLink.relation),
      t
    );
    if (rev) phrases.push(rev);
  }
  return phrases;
}

function formatLinkRelationPhrasesHtml(link, reverseLink, source, target, t) {
  const htmls = [];
  if (!source || !target) return htmls;

  if (link.type === "family") {
    const rel = link.relation;
    if (rel === "Parent") {
      htmls.push(
        formatCompactKinshipPhraseHtml(source, target.name, ["child"], t)
      );
      htmls.push(
        formatCompactKinshipPhraseHtml(target, source.name, ["parent"], t)
      );
    } else if (rel === "Spouse") {
      htmls.push(
        formatCompactKinshipPhraseHtml(source, target.name, ["spouse"], t)
      );
      htmls.push(
        formatCompactKinshipPhraseHtml(target, source.name, ["spouse"], t)
      );
    } else if (rel === "Sibling") {
      htmls.push(
        formatCompactKinshipPhraseHtml(source, target.name, ["sibling"], t)
      );
      htmls.push(
        formatCompactKinshipPhraseHtml(target, source.name, ["sibling"], t)
      );
    } else {
      const step = familyStepKind(source.id, target.id, link);
      htmls.push(
        formatCompactKinshipPhraseHtml(source, target.name, [step], t)
      );
      htmls.push(
        formatCompactKinshipPhraseHtml(
          target,
          source.name,
          invertKinSteps([step]),
          t
        )
      );
    }
    return htmls;
  }

  const tr = window.translateRelation || ((r) => r);
  if (link.relation) {
    const fwd = formatAssocPhraseHtml(
      source.name,
      target.name,
      tr(link.relation),
      t
    );
    if (fwd) htmls.push(fwd);
  }
  if (reverseLink?.relation) {
    const rev = formatAssocPhraseHtml(
      target.name,
      source.name,
      tr(reverseLink.relation),
      t
    );
    if (rev) htmls.push(rev);
  }
  return htmls;
}

function formatLinkRelationHeaderHtml(link, reverseLink, source, target, t) {
  return renderRelationPhraseListHtml(
    formatLinkRelationPhrasesHtml(link, reverseLink, source, target, t)
  );
}

function describeBloodRelation(fromId, toId, t, adj, links) {
  const path = shortestFamilyPath(fromId, toId, adj);
  if (!path || path.length < 2) return null;
  const steps = [];
  const edgeLinks = [];
  for (let i = 0; i < path.length - 1; i++) {
    const link = findFamilyLinkBetween(path[i], path[i + 1], links);
    edgeLinks.push(link);
    steps.push(familyStepKind(path[i], path[i + 1], link));
  }
  const toName = nodeNameById(toId);
  const fromName = nodeNameById(fromId);
  const revPath = [...path].reverse();
  const revSteps = invertKinSteps(steps);

  // Compact label (e.g. arrière-arrière-grand-père); detail chain on demand.
  const fromPerson = nodeById(fromId) || { id: fromId, name: fromName };
  const toPerson = nodeById(toId) || { id: toId, name: toName };
  const forwardPhrase = formatCompactKinshipPhrase(fromPerson, toName, steps, t);
  const reversePhrase = formatCompactKinshipPhrase(
    toPerson,
    fromName,
    revSteps,
    t
  );
  const forwardPhraseHtml = formatCompactKinshipPhraseHtml(
    fromPerson,
    toName,
    steps,
    t
  );
  const reversePhraseHtml = formatCompactKinshipPhraseHtml(
    toPerson,
    fromName,
    revSteps,
    t
  );
  const forwardDetailPlain =
    steps.length >= 2 ? formatKinshipPathChainPlain(path, steps, t) : null;
  const reverseDetailPlain =
    steps.length >= 2
      ? formatKinshipPathChainPlain(revPath, revSteps, t)
      : null;
  const forwardDetailHtml =
    steps.length >= 2 ? formatKinshipPathChainHtml(path, steps, t) : null;
  const reverseDetailHtml =
    steps.length >= 2
      ? formatKinshipPathChainHtml(revPath, revSteps, t)
      : null;

  const notes = [];
  const citations = [];
  const pushUnique = (arr, value) => {
    const v = String(value || "").trim();
    if (v && !arr.includes(v)) arr.push(v);
  };
  edgeLinks.forEach((l) => {
    (l?.notes || []).forEach((n) => pushUnique(notes, n));
    (l?.citations || []).forEach((c) => pushUnique(citations, c));
  });
  return {
    otherId: toId,
    degree: steps.length,
    path,
    forwardPhrase,
    reversePhrase,
    forwardPhraseHtml,
    reversePhraseHtml,
    forwardDetailPlain,
    reverseDetailPlain,
    forwardDetailHtml,
    reverseDetailHtml,
    notes,
    citations,
  };
}

function collectBloodRelationsFor(personId, t) {
  const nodes = masterNodes();
  const links = masterLinks();
  const adj = buildFamilyAdj(nodes, links);
  if (!adj.has(personId)) return [];
  const dist = bfsDistances(adj, personId);
  const rows = [];
  for (const [otherId, degree] of dist) {
    if (otherId === personId || degree <= 0) continue;
    const row = describeBloodRelation(personId, otherId, t, adj, links);
    if (row) rows.push(row);
  }
  rows.sort(
    (a, b) =>
      a.degree - b.degree ||
      String(nodeNameById(a.otherId)).localeCompare(
        String(nodeNameById(b.otherId)),
        undefined,
        { sensitivity: "base" }
      )
  );
  return rows;
}

function collectAssocRelationsFor(personId) {
  const links = masterLinks();
  const otherIds = new Set();
  links.forEach((link) => {
    if (link.type === "family") return;
    const { sourceId, targetId } = linkEnds(link);
    if (sourceId === personId) otherIds.add(targetId);
    if (targetId === personId) otherIds.add(sourceId);
  });
  const rows = [...otherIds].map((otherId) => {
    const both = findAssocLinksBetween(personId, otherId, links);
    return { otherId, forward: both.forward, reverse: both.reverse };
  });
  rows.sort((a, b) =>
    String(nodeNameById(a.otherId)).localeCompare(
      String(nodeNameById(b.otherId)),
      undefined,
      { sensitivity: "base" }
    )
  );
  return rows;
}

function nodeNameById(id) {
  const n = masterNodes().find((x) => x.id === id);
  return n?.name || id;
}

function nodeById(id) {
  return masterNodes().find((x) => x.id === id) || null;
}

function formatRelationEvidenceLists(notes, citations, t) {
  let html = "";
  if (notes?.length) {
    html += `<div class="evidence-block"><div class="evidence-label">${escapeHtml(
      t("relationContext")
    )}</div><ul>${notes
      .map((n) => `<li>${escapeHtml(n)}</li>`)
      .join("")}</ul></div>`;
  }
  if (citations?.length) {
    html += `<div class="evidence-block evidence-quote"><div class="evidence-label">${escapeHtml(
      t("bookEvidence")
    )}</div><ul>${citations
      .map(
        (c) =>
          `<li><em>« ${escapeHtml(stripQuoteMarks(c))} »</em></li>`
      )
      .join("")}</ul></div>`;
  }
  return html;
}

function relationSearchHaystack(name, phrases = []) {
  return [name, ...phrases]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function renderBloodRelationsBody(person, t) {
  const rows = collectBloodRelationsFor(person.id, t);
  if (!rows.length) {
    return `<p class="sheet-empty">${escapeHtml(t("noBloodLinks"))}</p>`;
  }
  return `<ul class="sheet-rel-list" data-rel-list="blood">${rows
    .map((row) => {
      const otherName = nodeNameById(row.otherId);
      const evidence = formatRelationEvidenceLists(
        row.notes,
        row.citations,
        t
      );
      const haystack = relationSearchHaystack(otherName, [
        row.forwardPhrase,
        row.reversePhrase,
        row.forwardDetailPlain,
        row.reverseDetailPlain,
      ]);
      return `
        <li class="sheet-rel sheet-rel--blood" data-rel-item data-search="${escapeHtml(
          haystack
        )}">
          <header class="sheet-rel-head">
            <button type="button" class="sheet-rel-name" data-jump-person="${escapeHtml(
              row.otherId
            )}">${escapeHtml(otherName)}</button>
            <span class="sheet-rel-degree">${escapeHtml(
              t("kinDegree", { degree: row.degree })
            )}</span>
          </header>
          ${renderBloodPhraseListHtml(
            [
              {
                compactHtml: row.forwardPhraseHtml,
                detailHtml: row.forwardDetailHtml,
              },
              {
                compactHtml: row.reversePhraseHtml,
                detailHtml: row.reverseDetailHtml,
              },
            ],
            t
          )}
          ${evidence}
        </li>`;
    })
    .join("")}</ul>`;
}

function renderAssocRelationsBody(person, t) {
  const tr = window.translateRelation || ((r) => r || t("unknown"));
  const rows = collectAssocRelationsFor(person.id);
  if (!rows.length) {
    return `<p class="sheet-empty">${escapeHtml(t("noOtherLinks"))}</p>`;
  }
  return `<ul class="sheet-rel-list" data-rel-list="assoc">${rows
    .map((row) => {
      const otherName = nodeNameById(row.otherId);
      const fwd = row.forward?.relation
        ? tr(row.forward.relation)
        : null;
      const rev = row.reverse?.relation
        ? tr(row.reverse.relation)
        : null;
      const phrases = [
        formatAssocPhrase(person.name, otherName, fwd, t),
        formatAssocPhrase(otherName, person.name, rev, t),
      ].filter(Boolean);
      const phraseHtmls = [
        formatAssocPhraseHtml(person.name, otherName, fwd, t),
        formatAssocPhraseHtml(otherName, person.name, rev, t),
      ].filter(Boolean);
      const { notes, citations } = collectRelationEvidence(
        row.forward,
        row.reverse
      );
      const evidence = formatRelationEvidenceLists(notes, citations, t);
      const haystack = relationSearchHaystack(otherName, phrases);
      return `
        <li class="sheet-rel sheet-rel--assoc" data-rel-item data-search="${escapeHtml(
          haystack
        )}">
          <header class="sheet-rel-head">
            <button type="button" class="sheet-rel-name" data-jump-person="${escapeHtml(
              row.otherId
            )}">${escapeHtml(otherName)}</button>
          </header>
          ${renderRelationPhraseListHtml(phraseHtmls)}
          ${evidence}
        </li>`;
    })
    .join("")}</ul>`;
}

function renderPersonLinksSection(person, t) {
  const bloodRows = collectBloodRelationsFor(person.id, t);
  const assocRows = collectAssocRelationsFor(person.id);
  const total = bloodRows.length + assocRows.length;
  const bloodInner = renderCollapsibleSheetSection(
    "blood",
    t("bloodLinks"),
    renderBloodRelationsBody(person, t),
    {
      open: false,
      count: bloodRows.length,
      extraClass: "sheet-section--blood sheet-section--nested",
    }
  );
  const assocInner = renderCollapsibleSheetSection(
    "link",
    t("otherLinks"),
    renderAssocRelationsBody(person, t),
    {
      open: false,
      count: assocRows.length,
      extraClass: "sheet-section--assoc sheet-section--nested",
    }
  );
  const body = `
    <label class="sheet-rel-search-wrap">
      <span class="sheet-rel-search-label" data-i18n="sheetRelSearch">
        ${escapeHtml(t("sheetRelSearch"))}
      </span>
      <input
        type="search"
        class="sheet-rel-search"
        data-sheet-rel-search
        data-i18n-placeholder="sheetRelSearchPlaceholder"
        placeholder="${escapeHtml(t("sheetRelSearchPlaceholder"))}"
        autocomplete="off"
      />
    </label>
    <p class="sheet-rel-search-status" data-sheet-rel-status hidden></p>
    <div class="sheet-rel-groups">
      ${bloodInner}
      ${assocInner}
    </div>
  `;
  return renderCollapsibleSheetSection("link", t("personLinks"), body, {
    open: true,
    count: total,
    extraClass: "sheet-section--links",
  });
}

function bindSheetRelationSearch(root) {
  const input = root?.querySelector("[data-sheet-rel-search]");
  const status = root?.querySelector("[data-sheet-rel-status]");
  const linksSection = root?.querySelector(".sheet-section--links");
  if (!input || !linksSection) return;

  const apply = () => {
    const raw = input.value.trim();
    const q = raw
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
    const items = linksSection.querySelectorAll("[data-rel-item]");
    let visible = 0;
    items.forEach((el) => {
      const hay = el.getAttribute("data-search") || "";
      const show = !q || hay.includes(q);
      el.classList.toggle("is-rel-filtered-out", !show);
      if (show) visible += 1;
    });

    linksSection.querySelectorAll(".sheet-section--nested").forEach((group) => {
      const groupItems = group.querySelectorAll("[data-rel-item]");
      const groupVisible = [...groupItems].some(
        (el) => !el.classList.contains("is-rel-filtered-out")
      );
      const hasItems = groupItems.length > 0;
      group.classList.toggle("is-rel-group-empty", hasItems && !groupVisible);
      if (q && groupVisible) group.open = true;
    });

    if (!status) return;
    if (!q) {
      status.hidden = true;
      status.textContent = "";
      return;
    }
    status.hidden = false;
    const t = window.t || ((k, p) => k);
    status.textContent =
      visible > 0
        ? t("sheetRelSearchHits", { n: visible, query: raw })
        : t("sheetRelSearchNone", { query: raw });
    status.classList.toggle("is-empty", visible === 0);
  };

  input.addEventListener("input", apply);
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
  const ageFacts = renderPersonAgeFacts(person, t);

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
      ${ageFacts}
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

  const linksSection = renderPersonLinksSection(person, t);
  const nucleusActive =
    focusScope === "nucleus" && lastFocusedNode?.id === person.id;
  const nucleusKinds = [
    ["all", "sheetNucleusAll"],
    ["parents", "sheetNucleusParents"],
    ["children", "sheetNucleusChildren"],
    ["siblings", "sheetNucleusSiblings"],
  ];
  const nucleusChips = nucleusKinds
    .map(([kind, key]) => {
      const active = nucleusActive && nucleusKind === kind;
      return `<button
          type="button"
          class="sheet-nucleus-chip${active ? " is-active" : ""}"
          data-nucleus-kind="${kind}"
          data-nucleus-person="${escapeHtml(person.id)}"
          aria-pressed="${active ? "true" : "false"}"
        >${escapeHtml(t(key))}</button>`;
    })
    .join("");

  return `
    <article class="person-sheet">
      <header class="sheet-hero">
        <div class="sheet-avatar ${sexClass}" aria-hidden="true">${escapeHtml(
          sexLabel
        )}</div>
        <div class="sheet-hero-text">
          <h2 class="sheet-name">${escapeHtml(person.name)}</h2>
          ${
            person.nickname
              ? `<p class="sheet-aka"><span class="sheet-aka-label">${escapeHtml(
                  t("nickname")
                )}</span> ${escapeHtml(person.nickname)}</p>`
              : ""
          }
          ${
            person.occupation
              ? `<p class="sheet-role">${escapeHtml(person.occupation)}</p>`
              : ""
          }
        </div>
      </header>
      <div class="sheet-actions">
        <button
          type="button"
          class="btn btn-ghost sheet-nucleus-btn${nucleusActive ? " is-active" : ""}"
          data-family-nucleus="${escapeHtml(person.id)}"
          aria-pressed="${nucleusActive ? "true" : "false"}"
          title="${escapeHtml(t("sheetFamilyNucleusHint"))}"
        >
          <i class="fa-solid fa-people-roof" aria-hidden="true"></i>
          <span>${escapeHtml(t("sheetFamilyNucleus"))}</span>
        </button>
        <div
          class="sheet-nucleus-chips${nucleusActive ? "" : " is-hidden"}"
          data-nucleus-chips="${escapeHtml(person.id)}"
          role="group"
          aria-label="${escapeHtml(t("sheetNucleusOptions"))}"
        >
          ${nucleusChips}
        </div>
      </div>
      ${factsHtml}
      ${linksSection}
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
      // Keep vertical band in layered layouts (chrono / genealogy)
      if (isLayeredLayout()) {
        d.fy = d.y;
      } else {
        d.fy = event.y;
      }
    })
    .on("end", (event, d) => {
      if (!event.active) sim.alphaTarget(0);
      d.fx = null;
      if (isLayeredLayout()) {
        // Re-lock to year / generation band after drag
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
  activeHover = null;
  focusScope = "depth";
  nucleusKind = "all";
  const id = clickedNode?.id;
  const master =
    (window.allNodes || []).find((n) => n.id === id) || clickedNode;

  lastFocusedNode = master;
  lastFocusedLink = null;

  if (prioritizeClickOverFilters()) {
    rebuildCurrentGraph();
  }

  lastFocusedNode = allNodes.find((n) => n.id === id) || master;
  if (!lastFocusedNode) return;

  emphasizeFocusedNode(lastFocusedNode.id, {
    raiseId: lastFocusedNode.id,
    duration: 220,
    raise: true,
  });
  showModalContent(lastFocusedNode);
  // Re-assert focus after layout shift from opening the detail panel
  requestAnimationFrame(() => {
    if (lastFocusedNode?.id === id && !activeHover) {
      emphasizeFocusedNode(id, { raiseId: id, duration: 160, raise: true });
    }
  });
  setTimeout(() => {
    if (lastFocusedNode?.id === id && !activeHover) {
      lastFocusedNode = allNodes.find((n) => n.id === id) || lastFocusedNode;
      emphasizeFocusedNode(id, { raiseId: id, duration: 160, raise: true });
    }
  }, 220);
}

function bindSheetRelationPathToggles(root) {
  const t = window.t || ((k) => k);
  root?.querySelectorAll("[data-rel-path-toggle]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const detail = btn.parentElement?.querySelector(".rel-path-detail");
      if (!detail) return;
      const open = detail.hasAttribute("hidden");
      if (open) detail.removeAttribute("hidden");
      else detail.setAttribute("hidden", "");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.textContent = open ? t("kinPathHideDetail") : t("kinPathShowDetail");
    });
  });
}

function syncSheetNucleusButtons(root) {
  root?.querySelectorAll("[data-family-nucleus]").forEach((btn) => {
    const id = btn.getAttribute("data-family-nucleus");
    const active = focusScope === "nucleus" && lastFocusedNode?.id === id;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
    const chips = root.querySelector(`[data-nucleus-chips="${id}"]`);
    chips?.classList.toggle("is-hidden", !active);
  });
  root?.querySelectorAll("[data-nucleus-kind]").forEach((chip) => {
    const id = chip.getAttribute("data-nucleus-person");
    const kind = chip.getAttribute("data-nucleus-kind");
    const active =
      focusScope === "nucleus" &&
      lastFocusedNode?.id === id &&
      nucleusKind === kind;
    chip.classList.toggle("is-active", active);
    chip.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function activateFamilyNucleus(personId, kind = "all") {
  const person =
    allNodes.find((n) => n.id === personId) ||
    (window.allNodes || []).find((n) => n.id === personId);
  if (!person) return false;
  cancelHoverRestore();
  activeHover = null;
  lastFocusedNode = person;
  lastFocusedLink = null;
  focusScope = "nucleus";
  nucleusKind =
    kind === "parents" || kind === "children" || kind === "siblings"
      ? kind
      : "all";
  emphasizeFamilyNucleus(personId, {
    raiseId: personId,
    duration: 220,
    raise: true,
    kind: nucleusKind,
  });
  return true;
}

function bindSheetFamilyNucleus(root) {
  root?.querySelectorAll("[data-family-nucleus]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const id = btn.getAttribute("data-family-nucleus");
      const person =
        allNodes.find((n) => n.id === id) ||
        (window.allNodes || []).find((n) => n.id === id) ||
        lastFocusedNode;
      if (!person || person.id !== id) return;

      if (focusScope === "nucleus" && lastFocusedNode?.id === id) {
        focusScope = "depth";
        nucleusKind = "all";
        cancelHoverRestore();
        activeHover = null;
        emphasizeFocusedNode(id, {
          raiseId: id,
          duration: 200,
          raise: true,
        });
      } else {
        activateFamilyNucleus(id, "all");
      }
      syncSheetNucleusButtons(root);
    });
  });

  root?.querySelectorAll("[data-nucleus-kind]").forEach((chip) => {
    chip.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const id = chip.getAttribute("data-nucleus-person");
      const kind = chip.getAttribute("data-nucleus-kind") || "all";
      if (!id) return;
      activateFamilyNucleus(id, kind);
      syncSheetNucleusButtons(root);
    });
  });
}

function bindSheetRelationJumps(root) {
  root?.querySelectorAll("[data-jump-person]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const id = btn.getAttribute("data-jump-person");
      const person = nodeById(id);
      if (person) focusNode(person);
    });
  });
  bindSheetRelationPathToggles(root);
  bindSheetRelationSearch(root);
  bindSheetFamilyNucleus(root);
}

let relationColResizeHandlers = null;

function bindRelationColumnResize(root) {
  const split = root?.querySelector(".relation-split");
  const handle = root?.querySelector("[data-relation-splitter]");
  const left = root?.querySelector(".profile-pane--left");
  const right = root?.querySelector(".profile-pane--right");
  if (!split || !handle || !left || !right) return;

  if (relationColResizeHandlers) {
    window.removeEventListener(
      "pointermove",
      relationColResizeHandlers.onMove
    );
    window.removeEventListener("pointerup", relationColResizeHandlers.onUp);
    relationColResizeHandlers = null;
  }

  const stored = Number(localStorage.getItem("cm_relation_split"));
  if (Number.isFinite(stored) && stored >= 28 && stored <= 72) {
    left.style.flex = `0 0 ${stored}%`;
    right.style.flex = `1 1 ${100 - stored}%`;
  }

  let dragging = false;
  const onMove = (event) => {
    if (!dragging) return;
    const rect = split.getBoundingClientRect();
    const vertical =
      window.getComputedStyle(split).flexDirection === "column";
    const size = vertical ? rect.height : rect.width;
    if (size < 80) return;
    const offset = vertical
      ? event.clientY - rect.top
      : event.clientX - rect.left;
    const clamped = Math.min(72, Math.max(28, (offset / size) * 100));
    left.style.flex = `0 0 ${clamped}%`;
    right.style.flex = `1 1 ${100 - clamped}%`;
    localStorage.setItem("cm_relation_split", String(Math.round(clamped)));
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove("is-resizing-cols");
    handle.classList.remove("is-active");
  };
  handle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    dragging = true;
    document.body.classList.add("is-resizing-cols");
    handle.classList.add("is-active");
    handle.setPointerCapture?.(event.pointerId);
  });
  relationColResizeHandlers = { onMove, onUp };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function bindModalWidthResize(modal) {
  if (!modal || modal.dataset.widthResizeBound) return;
  modal.dataset.widthResizeBound = "1";
  let handle = modal.querySelector(".modal-resize-handle");
  if (!handle) {
    handle = document.createElement("div");
    handle.className = "modal-resize-handle";
    handle.title = "Resize";
    handle.setAttribute("role", "separator");
    handle.setAttribute("aria-orientation", "vertical");
    modal.prepend(handle);
  }

  const applyWidth = (px) => {
    const min = modal.classList.contains("is-dual") ? 520 : 320;
    const max = Math.min(window.innerWidth * 0.92, 1100);
    const w = Math.min(max, Math.max(min, px));
    modal.style.width = `${w}px`;
    localStorage.setItem(
      modal.classList.contains("is-dual") ? "cm_modal_w_dual" : "cm_modal_w",
      String(Math.round(w))
    );
  };

  const restore = () => {
    const key = modal.classList.contains("is-dual")
      ? "cm_modal_w_dual"
      : "cm_modal_w";
    const stored = Number(localStorage.getItem(key));
    if (Number.isFinite(stored)) applyWidth(stored);
    else modal.style.width = "";
  };

  let dragging = false;
  handle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    dragging = true;
    document.body.classList.add("is-resizing-modal");
    handle.classList.add("is-active");
  });
  window.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    applyWidth(window.innerWidth - event.clientX);
  });
  window.addEventListener("pointerup", () => {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove("is-resizing-modal");
    handle.classList.remove("is-active");
  });

  modal._restoreModalWidth = restore;
  restore();
}

function showModalContent(nodeA, nodeB = null, relationInfo = null) {
  const modal = document.getElementById("modalContainer");
  const content = document.getElementById("modalContent");
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  bindModalWidthResize(modal);

  if (nodeB) {
    modal.classList.add("is-dual");
    content.classList.add("modal-flex");
    content.innerHTML = `
      <div class="relation-view">
        <header class="relation-header">
          <div class="relation-header-kicker">${escapeHtml(
            (window.t || ((k) => k))("relation")
          )}</div>
          ${relationInfo || ""}
        </header>
        <div class="relation-split">
          <div class="profile-pane profile-pane--left">
            ${renderPersonProfile(nodeA)}
          </div>
          <div
            class="relation-splitter"
            data-relation-splitter
            role="separator"
            aria-orientation="vertical"
            title="Resize columns"
          ></div>
          <div class="profile-pane profile-pane--right">
            ${renderPersonProfile(nodeB)}
          </div>
        </div>
      </div>
    `;
    bindRelationColumnResize(content);
  } else {
    modal.classList.remove("is-dual");
    content.classList.remove("modal-flex");
    content.innerHTML = `
      <div class="profile-pane profile-pane--single">
        ${renderPersonProfile(nodeA)}
      </div>
    `;
  }
  modal._restoreModalWidth?.();
  bindSheetRelationJumps(content);
}

function clearGraphSelection() {
  cancelHoverRestore();
  activeHover = null;
  d3.selectAll("body > .tooltip, .tooltip, .link-tooltip").style(
    "display",
    "none"
  );

  const modal = document.getElementById("modalContainer");
  const modalOpen = modal && !modal.classList.contains("hidden");
  const hadFocus = Boolean(lastFocusedNode || lastFocusedLink);

  lastFocusedNode = null;
  lastFocusedLink = null;
  focusScope = "depth";
  nucleusKind = "all";

  if (modalOpen) {
    modal.classList.add("hidden");
    modal.classList.remove("is-dual");
    document.body.style.overflow = "";
  }

  if (modalOpen || hadFocus) {
    clearGraphEmphasis(220);
    d3.selectAll(".node circle")
      .transition()
      .duration(220)
      .attr("fill", (d) => (d.sex === "M" ? "#2563eb" : "#db2777"));
  } else {
    clearGraphEmphasis(120);
  }
}

function closeModal() {
  clearGraphSelection();
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

      rebuildCurrentGraph();
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
    applyGraphFilters({ debounce: true });
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
      rebuildCurrentGraph();
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
      if (window.allNodes?.length) rebuildCurrentGraph();
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
    syncLinkDepthControl();
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

  function setSettingsPopoverOpen(open) {
    const pop = document.getElementById("settingsPopover");
    const toggle = document.getElementById("settingsToggle");
    if (!pop || !toggle) return;
    pop.classList.toggle("is-hidden", !open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) setFiltersPopoverOpen(false);
  }

  document.getElementById("settingsToggle")?.addEventListener("click", (event) => {
    event.stopPropagation();
    const pop = document.getElementById("settingsPopover");
    const open = pop?.classList.contains("is-hidden");
    setSettingsPopoverOpen(Boolean(open));
  });
  document.getElementById("settingsClose")?.addEventListener("click", () => {
    setSettingsPopoverOpen(false);
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

  const linkDepthSlider = document.getElementById("linkDepthSlider");
  linkDepthSlider?.addEventListener("input", () => {
    setLinkDepth(Number(linkDepthSlider.value));
  });
  document.querySelectorAll('input[name="linkDepthMode"]').forEach((el) => {
    el.addEventListener("change", () => {
      if (el.checked) setLinkDepthMode(el.value);
    });
  });
  syncLinkDepthControl();

  loadGraphFilters();
  writeFiltersToDom();

  document.getElementById("filtersToggle")?.addEventListener("click", (event) => {
    event.stopPropagation();
    const pop = document.getElementById("filtersPopover");
    const open = pop?.classList.contains("is-hidden");
    setFiltersPopoverOpen(Boolean(open));
    if (open) setSettingsPopoverOpen(false);
  });
  document.getElementById("filtersClose")?.addEventListener("click", () => {
    setFiltersPopoverOpen(false);
  });
  document.getElementById("filtersReset")?.addEventListener("click", () => {
    resetGraphFilters();
  });
  document.getElementById("searchBox")?.addEventListener("input", () => {
    applyGraphFilters({ debounce: true });
  });
  document
    .getElementById("filterBirthAfter")
    ?.addEventListener("input", () => applyGraphFilters({ debounce: true }));
  document
    .getElementById("filterBirthBefore")
    ?.addEventListener("input", () => applyGraphFilters({ debounce: true }));
  document.querySelectorAll('input[name="filterSex"]').forEach((el) => {
    el.addEventListener("change", () => applyGraphFilters());
  });
  document.querySelectorAll('input[name="filterVitality"]').forEach((el) => {
    el.addEventListener("change", () => applyGraphFilters());
  });
  document.querySelectorAll('input[name="filterLinkKind"]').forEach((el) => {
    el.addEventListener("change", () => applyGraphFilters());
  });
  document
    .getElementById("filterBookEvidence")
    ?.addEventListener("change", () => applyGraphFilters());

  document.addEventListener("click", (event) => {
    const filtersAnchor = document.querySelector(".filters-anchor");
    const filtersPop = document.getElementById("filtersPopover");
    if (
      filtersAnchor &&
      filtersPop &&
      !filtersPop.classList.contains("is-hidden") &&
      !filtersAnchor.contains(event.target)
    ) {
      setFiltersPopoverOpen(false);
    }
    const settingsAnchor = document.querySelector(".settings-anchor");
    const settingsPop = document.getElementById("settingsPopover");
    if (
      settingsAnchor &&
      settingsPop &&
      !settingsPop.classList.contains("is-hidden") &&
      !settingsAnchor.contains(event.target)
    ) {
      setSettingsPopoverOpen(false);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setFiltersPopoverOpen(false);
      setSettingsPopoverOpen(false);
    }
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

  function setNarrativeCollapsed(collapsed) {
    const panel = document.getElementById("narrativePanel");
    const toggle = document.getElementById("narrativeToggle");
    if (!panel || !toggle) return;
    panel.classList.toggle("is-collapsed", collapsed);
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    localStorage.setItem("cm_narrative_collapsed", collapsed ? "1" : "0");
  }

  setNarrativeCollapsed(localStorage.getItem("cm_narrative_collapsed") === "1");
  document.getElementById("narrativeToggle")?.addEventListener("click", () => {
    const panel = document.getElementById("narrativePanel");
    setNarrativeCollapsed(!panel?.classList.contains("is-collapsed"));
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
