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
/** @type {null | { kind: "node", id: string } | { kind: "link", key: string } | { kind: "pair", ids: string[], path?: string[] }} */
let activeHover = null;
/** Neighbor id while a focused-character pair/relation flyout is shown. */
let pairHoverNeighborId = null;
let nodeDragMoved = false;
/** Deferred single-click focus — cancelled when a dblclick activates the family nucleus. */
let nodeClickTimer = null;
const NODE_CLICK_DELAY_MS = 280;
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
/** Character ids highlighted for the active narrative event (`@I…@`). */
let activeNarrativeCast = null;
/** @type {{ query: string, sex: "all"|"M"|"F", birthAfter: number|null, birthBefore: number|null, vitality: "all"|"living"|"deceased", bookEvidence: boolean, linkKind: "all"|"blood"|"other" }} */
let graphFilters = {
  query: "",
  sex: "all",
  birthAfter: null,
  birthBefore: null,
  vitality: "all",
  bookEvidence: false,
  // Default: blood tree only; ASSO appear via filter all/other or node focus
  linkKind: "blood",
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

function sortedNarrativeMoments(narrative) {
  return [...(narrative?.moments || [])].sort(
    (a, b) => +new Date(a.at) - +new Date(b.at)
  );
}

function momentAtTime(narrative, atDate) {
  const moments = sortedNarrativeMoments(narrative);
  if (!moments.length) return null;
  let current = moments[0];
  for (const m of moments) {
    if (+new Date(m.at) <= +atDate) current = m;
    else break;
  }
  return current;
}

function momentIndexAtTime(narrative, atDate) {
  const moments = sortedNarrativeMoments(narrative);
  if (!moments.length) return -1;
  let idx = 0;
  for (let i = 0; i < moments.length; i++) {
    if (+new Date(moments[i].at) <= +atDate) idx = i;
    else break;
  }
  return idx;
}

function normalizeNarrativeCharacterId(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (s.startsWith("@") && s.endsWith("@")) return s;
  if (/^I\d+$/i.test(s)) return `@${s.toUpperCase()}@`;
  return s;
}

function narrativeCastIds(moment) {
  const ids = new Set();
  for (const raw of moment?.characters || []) {
    const id = normalizeNarrativeCharacterId(raw);
    if (id) ids.add(id);
  }
  return ids;
}

function shortDisplayName(node) {
  const name = String(node?.name || "").trim();
  if (!name) return node?.id || "";
  const parts = name.split(/\s+/);
  if (parts.length <= 3) return name;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function isNarrativeFriseOpen() {
  const panel = document.getElementById("narrativePanel");
  if (!panel || panel.classList.contains("is-hidden")) return false;
  return !panel.classList.contains("is-collapsed");
}

/** Drop event-cast highlight and restore free graph exploration (or pinned focus). */
function releaseNarrativeFriseHighlight() {
  cancelHoverRestore();
  activeHover = null;
  activeNarrativeCast = null;
  d3.selectAll("body > .tooltip, .tooltip, .link-tooltip").style(
    "display",
    "none"
  );
  d3.selectAll(".node, .node-label-root").classed("is-event-cast", false);
  if (lastFocusedNode || lastFocusedLink) {
    restorePersistentEmphasis();
  } else {
    clearGraphEmphasis(0);
  }
}

function emphasizeNarrativeCast(ids, { duration = 160 } = {}) {
  const cast = ids instanceof Set ? ids : new Set(ids || []);
  if (!isNarrativeFriseOpen()) {
    activeNarrativeCast = null;
    return;
  }
  activeNarrativeCast = cast.size ? cast : null;
  if (!cast.size) {
    if (!isSelectionPinned() && !activeHover) clearGraphEmphasis(duration);
    return;
  }
  d3.selectAll(".node, .node-label-root").classed("is-event-cast", (d) =>
    cast.has(d.id)
  );
  emphasizeGraph({
    nodeIds: cast,
    linkKeep: (l) => {
      const { sourceId, targetId } = linkEnds(l);
      return cast.has(sourceId) && cast.has(targetId);
    },
    raiseId: null,
    duration,
    raise: true,
    revealKeptLinks: true,
  });
}

function syncNarrativeCastFromTime({ force = false } = {}) {
  if (!currentNarrative || !currentNarrativeTime) {
    activeNarrativeCast = null;
    d3.selectAll(".node, .node-label-root").classed("is-event-cast", false);
    return;
  }
  if (!isNarrativeFriseOpen()) {
    // Keep time/ages, but never leave a cast highlight while collapsed
    if (activeNarrativeCast) releaseNarrativeFriseHighlight();
    else activeNarrativeCast = null;
    return;
  }
  const moment = momentAtTime(currentNarrative, currentNarrativeTime);
  const cast = narrativeCastIds(moment);
  if (!force && (isSelectionPinned() || activeHover)) {
    activeNarrativeCast = cast.size ? cast : null;
    return;
  }
  if (cast.size) emphasizeNarrativeCast(cast);
  else {
    activeNarrativeCast = null;
    if (!isSelectionPinned() && !activeHover) clearGraphEmphasis(120);
  }
}

function goToNarrativeMoment(index, { clearFocus = true } = {}) {
  if (!currentNarrative) return;
  const moments = sortedNarrativeMoments(currentNarrative);
  if (!moments.length) return;
  const i = Math.max(0, Math.min(moments.length - 1, index));
  const date = new Date(moments[i].at);
  if (Number.isNaN(+date)) return;
  if (clearFocus) {
    lastFocusedNode = null;
    lastFocusedLink = null;
    focusScope = "depth";
    nucleusKind = "all";
    syncFocusChip();
    restoreFocusNeighborSpread({ animate: false });
  }
  setNarrativeTime(date);
  syncNarrativeCastFromTime({ force: true });
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
  const years = d3.selectAll(".node-year");
  if (years.empty()) return;
  years.text((d) => nodeSecondaryLabel(d));
  const markDead = (d) => {
    if (!currentNarrativeTime) return false;
    const info = ageAtNarrative(d, currentNarrativeTime);
    return info?.kind === "dead";
  };
  d3.selectAll(".node").classed("is-dead-at-time", markDead);
  d3.selectAll(".node-label-root").classed("is-dead-at-time", markDead);
  resizeNodeLabelBackground(d3.selectAll(".node-label-group"));
}

function setNarrativeTime(date, { updateSlider = true, syncCast = true } = {}) {
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
  if (syncCast) syncNarrativeCastFromTime();
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
  const castEl = document.getElementById("narrativeCast");
  const indexEl = document.getElementById("narrativeEventIndex");
  const prevBtn = document.getElementById("narrativePrev");
  const nextBtn = document.getElementById("narrativeNext");

  if (when) {
    when.textContent = formatNarrativeClock(
      currentNarrativeTime,
      currentNarrative
    );
  }
  const whenCollapsed = document.getElementById("narrativeWhenCollapsed");
  if (whenCollapsed) {
    const moment = momentAtTime(currentNarrative, currentNarrativeTime);
    const momentLabel = moment
      ? localizeNarrativeField(moment.label)
      : when?.textContent || "";
    whenCollapsed.textContent = momentLabel;
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

  const moments = sortedNarrativeMoments(currentNarrative);
  const momentIdx = momentIndexAtTime(currentNarrative, currentNarrativeTime);
  const moment = momentIdx >= 0 ? moments[momentIdx] : null;

  if (indexEl) {
    indexEl.textContent = moments.length
      ? t("narrativeEventOf", {
          n: String(momentIdx + 1),
          total: String(moments.length),
        })
      : "";
  }
  if (prevBtn) prevBtn.disabled = momentIdx <= 0;
  if (nextBtn) nextBtn.disabled = momentIdx < 0 || momentIdx >= moments.length - 1;

  if (momentEl) {
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

  if (castEl) {
    const castIds = [...narrativeCastIds(moment)];
    const roster = window.allNodes || allNodes || [];
    const nodes = castIds
      .map((id) => roster.find((n) => n.id === id))
      .filter(Boolean);
    if (nodes.length) {
      castEl.hidden = false;
      castEl.innerHTML = nodes
        .map(
          (n) =>
            `<span class="narrative-cast-chip" title="${escapeHtmlGlobal(
              n.name || n.id
            )}">${escapeHtmlGlobal(shortDisplayName(n))}</span>`
        )
        .join("");
    } else {
      castEl.hidden = true;
      castEl.innerHTML = "";
    }
  }

  document.querySelectorAll(".narrative-tick").forEach((btn) => {
    const at = btn.dataset.at;
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
  if (slider && !slider.dataset.bound) {
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

  const prevBtn = document.getElementById("narrativePrev");
  const nextBtn = document.getElementById("narrativeNext");
  if (prevBtn && !prevBtn.dataset.bound) {
    prevBtn.dataset.bound = "1";
    prevBtn.addEventListener("click", () => {
      const idx = momentIndexAtTime(currentNarrative, currentNarrativeTime);
      if (idx > 0) goToNarrativeMoment(idx - 1);
    });
  }
  if (nextBtn && !nextBtn.dataset.bound) {
    nextBtn.dataset.bound = "1";
    nextBtn.addEventListener("click", () => {
      const moments = sortedNarrativeMoments(currentNarrative);
      const idx = momentIndexAtTime(currentNarrative, currentNarrativeTime);
      if (idx >= 0 && idx < moments.length - 1) goToNarrativeMoment(idx + 1);
    });
  }
}

function setChapterNarrative(narrative) {
  currentNarrative = narrative || null;
  window.__chapterNarrative = currentNarrative;
  activeNarrativeCast = null;
  const panel = document.getElementById("narrativePanel");
  const ticks = document.getElementById("narrativeTicks");
  bindNarrativePanel();

  const bounds = narrativeBounds(currentNarrative);
  if (!panel) return;

  if (!bounds) {
    panel.classList.add("is-hidden");
    currentNarrativeTime = null;
    window.__narrativeTime = null;
    d3.selectAll(".node, .node-label-root").classed("is-event-cast", false);
    refreshNodeAgeLabels();
    return;
  }

  panel.classList.remove("is-hidden");
  if (ticks) {
    const moments = sortedNarrativeMoments(currentNarrative);
    ticks.innerHTML = moments
      .map((m, i) => {
        const label = localizeNarrativeField(m.label);
        return `<button type="button" class="narrative-tick" role="listitem" data-at="${escapeHtmlGlobal(
          m.at
        )}" data-index="${i}" title="${escapeHtmlGlobal(label)}"><span>${escapeHtmlGlobal(
          label
        )}</span></button>`;
      })
      .join("");
    ticks.querySelectorAll(".narrative-tick").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.index);
        if (Number.isFinite(idx)) goToNarrativeMoment(idx);
      });
    });
  }

  setNarrativeTime(bounds.start, { syncCast: false });
  syncNarrativeCastFromTime({ force: true });
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
    return (link) => {
      if (link.type === "family") return true;
      // Direct ASSO of the focused character (filter may still hide them)
      const { sourceId, targetId } = linkEnds(link);
      return sourceId === nodeId || targetId === nodeId;
    };
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
  // Blood-default: hide ASSO until filter says otherwise or a node is focused
  if (!isAssocVisible(link)) return false;
  if (graphFilters.linkKind === "other" && link.type === "family") return false;

  if (mode === "all") {
    if (link.type === "family") return true;
    // ASSO already passed isAssocVisible (filter all/other, or focused ego)
    return true;
  }
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
  // "blood" is the default — only all/other count as an active link filter
  if (graphFilters.linkKind !== "blood") n += 1;
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
    linkKind: "blood",
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
  // "other" → ASSO only. "blood" / "all" keep both in the model so a node
  // click can reveal that character's ASSO without a rebuild.
  if (graphFilters.linkKind === "other") return link.type !== "family";
  return true;
}

/** Non-blood links: visible when filter is all/other, or on focused node. */
function isAssocVisible(link) {
  if (link.type === "family") return true;
  if (graphFilters.linkKind === "all" || graphFilters.linkKind === "other") {
    return true;
  }
  const ego = lastFocusedNode?.id;
  if (!ego) return false;
  const { sourceId, targetId } = linkEnds(link);
  return sourceId === ego || targetId === ego;
}

/** Set by createGraph — redraws node transforms + link paths. */
let redrawGraphGeometry = () => {};
/** Active d3.zoom behavior + svg selection (for focus fit). */
let graphZoom = null;
let graphSvg = null;

/** Manual zoom via chrome buttons (no auto-fit on load). */
function zoomGraphBy(factor) {
  if (!graphZoom || !graphSvg) return;
  graphSvg
    .transition()
    .duration(220)
    .ease(d3.easeCubicOut)
    .call(graphZoom.scaleBy, factor);
}
/** True while a focus fan-out has moved nodes off their home packing. */
let focusFanActive = false;

function snapshotHomePositionsIfNeeded() {
  (allNodes || []).forEach((n) => {
    if (n.homeX == null && n.x != null) {
      n.homeX = n.x;
      n.homeY = n.y;
      n.homeTargetX = n.targetX != null ? n.targetX : n.x;
    }
  });
}

function clearFocusLinkLanes() {
  (allLinks || []).forEach((l) => {
    delete l._focusLane;
    delete l._focusLaneCount;
  });
}

/** Collect direct neighbors used by focus fan / fit (family keep + ASSO). */
function focusDirectNeighborIds(egoId) {
  const keep = makeFocusLinkKeep(egoId, currentLinkDepth);
  const neighborIds = new Set();
  const assoLinks = [];
  (allLinks || []).forEach((l) => {
    const { sourceId, targetId } = linkEnds(l);
    if (sourceId !== egoId && targetId !== egoId) return;
    const other = sourceId === egoId ? targetId : sourceId;
    if (l.type === "family") {
      if (!keep(l)) return;
      neighborIds.add(other);
      return;
    }
    neighborIds.add(other);
    assoLinks.push({ link: l, otherId: other });
  });
  return { neighborIds, assoLinks };
}

function assignFocusAssoLanes(assoLinks, neighbors) {
  assoLinks.sort((a, b) => {
    const na = neighbors.findIndex((node) => node.id === a.otherId);
    const nb = neighbors.findIndex((node) => node.id === b.otherId);
    return na - nb;
  });
  assoLinks.forEach((a, i) => {
    a.link._focusLane = i;
    a.link._focusLaneCount = assoLinks.length;
  });
}

/**
 * On focus: separate stacked ASSO (lanes) and frame the neighborhood.
 * Layered layouts keep the packed tree — a radial fan was stacking labels
 * on top of unrelated nodes. Force layout still uses a ring fan.
 */
function applyFocusNeighborSpread(egoId, { animate = true } = {}) {
  const ego = (allNodes || []).find((n) => n.id === egoId);
  if (!ego || ego.x == null) return;

  snapshotHomePositionsIfNeeded();
  clearFocusLinkLanes();

  const { neighborIds, assoLinks } = focusDirectNeighborIds(egoId);
  const neighbors = (allNodes || []).filter((n) => neighborIds.has(n.id));

  const egoX = ego.homeX ?? ego.x;
  const egoY = ego.homeY ?? ego.y;
  neighbors.sort((a, b) => {
    const aa = Math.atan2((a.homeY ?? a.y) - egoY, (a.homeX ?? a.x) - egoX);
    const bb = Math.atan2((b.homeY ?? b.y) - egoY, (b.homeX ?? b.x) - egoX);
    return aa - bb;
  });
  assignFocusAssoLanes(assoLinks, neighbors);

  // Genealogy / chrono: preserve readable packing; only lane ASSO (never auto-zoom)
  if (isLayeredLayout()) {
    const hadFan = focusFanActive || (allNodes || []).some((n) => n.focusYOffset);
    focusFanActive = false;
    if (hadFan) {
      (allNodes || []).forEach((node) => {
        if (node.homeX != null) {
          node.x = node.homeX;
          node.targetX = node.homeTargetX ?? node.homeX;
        }
        node.focusYOffset = 0;
        if (node.homeY != null) {
          node.y = node.homeY;
          node.fy = node.homeY;
        }
      });
      redrawGraphGeometry();
    }
    return;
  }

  if (!neighbors.length) {
    focusFanActive = false;
    return;
  }

  const from = new Map(
    (allNodes || []).map((node) => [
      node.id,
      {
        x: node.x,
        y: node.y,
        yo: node.focusYOffset || 0,
      },
    ])
  );

  const n = neighbors.length;
  // Radius grows with neighbor count + label sizes so pills stay separable
  const avgHalf =
    neighbors.reduce((s, node) => s + estimateNodeLabelHalfWidth(node), 0) /
      Math.max(n, 1) || 60;
  const radius = Math.max(
    200,
    Math.min(420, 110 + n * (avgHalf * 0.55 + 16))
  );

  const toX = new Map();
  const toYo = new Map();

  (allNodes || []).forEach((node) => {
    if (!neighborIds.has(node.id) && node.id !== egoId) {
      toX.set(node.id, node.homeX ?? node.x);
      toYo.set(node.id, 0);
    }
  });
  toX.set(egoId, egoX);
  toYo.set(egoId, 0);
  ego.targetX = egoX;

  neighbors.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    const tx = egoX + Math.cos(angle) * radius;
    const ty = egoY + Math.sin(angle) * radius;
    toX.set(node.id, tx);
    node.targetX = tx;
    toYo.set(node.id, ty - (node.homeY ?? node.y));
  });

  focusFanActive = true;

  const applyAt = (t) => {
    (allNodes || []).forEach((node) => {
      const f = from.get(node.id);
      if (!f) return;
      const destX = toX.has(node.id) ? toX.get(node.id) : f.x;
      const destYo = toYo.has(node.id) ? toYo.get(node.id) : 0;
      node.x = f.x + (destX - f.x) * t;
      node.focusYOffset = f.yo + (destYo - f.yo) * t;
      const homeY = node.homeY ?? f.y - f.yo;
      node.y = homeY + node.focusYOffset;
      node.targetX = destX;
    });
    redrawGraphGeometry();
  };

  if (!animate) {
    applyAt(1);
    return;
  }

  if (simulation) simulation.stop();
  d3.transition("focus-fan")
    .duration(420)
    .ease(d3.easeCubicOut)
    .tween("focus-fan", () => (t) => applyAt(t));
}

function restoreFocusNeighborSpread({ animate = true } = {}) {
  if (!focusFanActive && !(allNodes || []).some((n) => n.focusYOffset)) {
    clearFocusLinkLanes();
    return;
  }
  clearFocusLinkLanes();
  const from = new Map(
    (allNodes || []).map((node) => [
      node.id,
      { x: node.x, y: node.y, yo: node.focusYOffset || 0 },
    ])
  );

  const finish = () => {
    (allNodes || []).forEach((node) => {
      if (node.homeX != null) {
        node.x = node.homeX;
        node.targetX = node.homeTargetX ?? node.homeX;
      }
      node.focusYOffset = 0;
      if (node.homeY != null) node.y = node.homeY;
      if (isLayeredLayout() && node.homeY != null) node.fy = node.homeY;
    });
    focusFanActive = false;
    redrawGraphGeometry();
    if (simulation) simulation.alpha(0.12).restart();
  };

  if (!animate) {
    finish();
    return;
  }

  if (simulation) simulation.stop();
  d3.transition("focus-fan")
    .duration(380)
    .ease(d3.easeCubicOut)
    .tween("focus-fan-restore", () => (t) => {
      (allNodes || []).forEach((node) => {
        const f = from.get(node.id);
        if (!f) return;
        const toX = node.homeX ?? f.x;
        const toY = node.homeY ?? f.y;
        node.x = f.x + (toX - f.x) * t;
        node.y = f.y + (toY - f.y) * t;
        node.focusYOffset = f.yo * (1 - t);
        node.targetX = toX;
        if (isLayeredLayout()) node.fy = node.y;
      });
      redrawGraphGeometry();
    })
    .on("end", finish);
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
    linkKind === "all" || linkKind === "other" ? linkKind : "blood";
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
        parsed.linkKind === "all" || parsed.linkKind === "other"
          ? parsed.linkKind
          : "blood",
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
  syncFocusChip();
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

/**
 * Connected components over blood edges (Parent/Spouse) so distinct
 * family trees can be laid out side-by-side without interleaving.
 */
function familyTreeComponents(nodes, links) {
  const ids = nodes.map((n) => n.id);
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (a) => {
    let cur = a;
    while (parent.get(cur) !== cur) cur = parent.get(cur);
    let walk = a;
    while (walk !== cur) {
      const next = parent.get(walk);
      parent.set(walk, cur);
      walk = next;
    }
    return cur;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  const idSet = new Set(ids);
  links.forEach((l) => {
    if (l.type !== "family") return;
    // Parent / Spouse / Sibling — keep blood siblings in the same tree component
    // (e.g. Marigny brothers with a CHIL-only FAM and no parents on record).
    const sid = typeof l.source === "object" ? l.source.id : l.source;
    const tid = typeof l.target === "object" ? l.target.id : l.target;
    if (!idSet.has(sid) || !idSet.has(tid)) return;
    union(sid, tid);
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const groups = new Map();
  ids.forEach((id) => {
    const r = find(id);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(byId.get(id));
  });
  return [...groups.values()];
}

/** Canvas text metrics matching label CSS (Manrope / 12px + 9.5px). */
let _labelMeasureCtx = null;
function getLabelMeasureCtx() {
  if (_labelMeasureCtx) return _labelMeasureCtx;
  const canvas = document.createElement("canvas");
  _labelMeasureCtx = canvas.getContext("2d");
  return _labelMeasureCtx;
}

/** Full label pill width (name + secondary line + padding). */
function estimateNodeLabelWidth(node) {
  const ctx = getLabelMeasureCtx();
  if (!ctx) {
    return Math.max(96, 28 + Math.min(String(node?.name || "").length, 32) * 7.2);
  }
  const name = String(node?.name || "?");
  const secondary =
    node?.birthYear != null
      ? `${node.birthYearInferred ? "~" : ""}${Math.round(node.birthYear)}`
      : "99 ans";
  ctx.font = '650 12px Manrope, "Segoe UI", sans-serif';
  const nameW = ctx.measureText(name).width;
  ctx.font = '600 9.5px Manrope, "Segoe UI", sans-serif';
  const secW = ctx.measureText(secondary).width;
  // padX 5 each side in resizeNodeLabelBackground + small safety
  return Math.ceil(Math.max(nameW, secW) + 18);
}

function estimateNodeLabelHalfWidth(node) {
  return estimateNodeLabelWidth(node) / 2;
}

/** Air between adjacent label pills (layered layouts). */
const LABEL_PILL_GAP = 18;
/** Vertical band where two under-node labels can collide. */
const LABEL_PILL_BAND_H = 48;

/**
 * Push nodes apart in X so under-node label pills never overlap
 * when they share a similar vertical band. Prefers shifting right
 * so left anchors stay stable.
 */
function resolveLabelPillOverlaps(nodes, getY) {
  if (!nodes?.length) return;
  const GAP = LABEL_PILL_GAP;
  for (let iter = 0; iter < 10; iter++) {
    const sorted = [...nodes].sort(
      (a, b) => (a.targetX ?? a.x ?? 0) - (b.targetX ?? b.x ?? 0)
    );
    let moved = false;
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i];
      const ax = a.targetX ?? a.x ?? 0;
      const ay = getY(a);
      const ha = estimateNodeLabelHalfWidth(a);
      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j];
        const bx = b.targetX ?? b.x ?? 0;
        const minDist = ha + estimateNodeLabelHalfWidth(b) + GAP;
        if (bx - ax > minDist + 240) break;
        if (Math.abs(getY(b) - ay) > LABEL_PILL_BAND_H) continue;
        if (bx - ax >= minDist) continue;
        const push = minDist - (bx - ax);
        for (let k = j; k < sorted.length; k++) {
          const n = sorted[k];
          n.targetX = (n.targetX ?? n.x ?? 0) + push;
          n.x = n.targetX;
        }
        moved = true;
        break;
      }
    }
    if (!moved) break;
  }
}

/**
 * MyHeritage-style layered genealogy placement:
 * family trees side-by-side, spouse units adjacent, children under parents.
 * Width grows with label sizes — never squeeze pills into the viewport.
 * Sets node.targetX (+ x). Returns content max X (right edge of labels).
 */
function layoutGenealogyPositions(nodes, links, marginLeft, _minLayoutWidth) {
  const comps = familyTreeComponents(nodes, links);
  const trees = comps.filter((c) => c.length > 1);
  const isolates = comps.filter((c) => c.length === 1).map((c) => c[0]);
  trees.sort((a, b) => {
    const size = b.length - a.length;
    if (size) return size;
    const na = String(a[0]?.name || "");
    const nb = String(b[0]?.name || "");
    return na.localeCompare(nb, "fr");
  });

  const treeGap = 220;
  let cursor = marginLeft + 36;

  trees.forEach((comp) => {
    layoutGenealogyComponent(comp, links, cursor);
    const right = Math.max(
      ...comp.map(
        (n) => (n.targetX ?? n.x ?? cursor) + estimateNodeLabelHalfWidth(n)
      ),
      cursor
    );
    cursor = right + treeGap;
  });

  // Loners (no blood ties in the snapshot) — spaced by their own label width
  if (isolates.length) {
    isolates.sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "fr")
    );
    let x = cursor + 40;
    isolates.forEach((n) => {
      const half = estimateNodeLabelHalfWidth(n);
      n.targetX = x + half;
      n.x = n.targetX;
      x = n.targetX + half + LABEL_PILL_GAP + 8;
    });
  }

  return nodes;
}

/**
 * Lay out one blood-connected family tree starting at originX.
 * Grows to the right as needed — no viewport width clamp.
 */
function layoutGenealogyComponent(nodes, links, originX) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const spouseOf = new Map();
  const parentsOf = new Map(); // child -> [parent ids]
  const childrenOf = new Map(); // parent -> [child ids]

  const add = (map, key, val) => {
    if (!map.has(key)) map.set(key, []);
    const arr = map.get(key);
    if (!arr.includes(val)) arr.push(val);
  };

  const siblingsOf = new Map();
  links.forEach((l) => {
    if (l.type !== "family") return;
    const sid = typeof l.source === "object" ? l.source.id : l.source;
    const tid = typeof l.target === "object" ? l.target.id : l.target;
    if (!byId.has(sid) || !byId.has(tid)) return;
    if (l.relation === "Spouse") {
      spouseOf.set(sid, tid);
      spouseOf.set(tid, sid);
    } else if (l.relation === "Parent") {
      add(parentsOf, tid, sid);
      add(childrenOf, sid, tid);
    } else if (l.relation === "Sibling") {
      add(siblingsOf, sid, tid);
      add(siblingsOf, tid, sid);
    }
  });

  const gens = [
    ...new Set(nodes.map((n) => n.generation ?? 0)),
  ].sort((a, b) => a - b);

  /** Build spouse-aware units per generation (pair or singleton). */
  function unitsForGen(g) {
    const members = nodes.filter((n) => (n.generation ?? 0) === g);
    const seen = new Set();
    const units = [];
    const sorted = [...members].sort((a, b) => {
      const ya = a.birthYear ?? 0;
      const yb = b.birthYear ?? 0;
      if (ya !== yb) return ya - yb;
      return String(a.name || "").localeCompare(String(b.name || ""), "fr");
    });
    sorted.forEach((n) => {
      if (seen.has(n.id)) return;
      const spId = spouseOf.get(n.id);
      const sp = spId ? byId.get(spId) : null;
      if (sp && (sp.generation ?? 0) === g && !seen.has(sp.id)) {
        // Husband / male left when sexes differ
        const left =
          n.sex === "M" && sp.sex !== "M"
            ? n
            : sp.sex === "M" && n.sex !== "M"
              ? sp
              : String(n.name || "").localeCompare(String(sp.name || ""), "fr") <=
                  0
                ? n
                : sp;
        const right = left === n ? sp : n;
        units.push({ ids: [left.id, right.id], nodes: [left, right] });
        seen.add(left.id);
        seen.add(right.id);
      } else {
        units.push({ ids: [n.id], nodes: [n] });
        seen.add(n.id);
      }
    });
    // Keep sibling units contiguous (CHIL-only FAMs have no parent barycenter)
    return clusterUnitsBySibling(units, siblingsOf);
  }

  /** Reorder generation units so sibling-linked units sit next to each other. */
  function clusterUnitsBySibling(units, sibMap) {
    if (units.length < 2) return units;
    const unitOfId = new Map();
    units.forEach((u, i) => u.ids.forEach((id) => unitOfId.set(id, i)));
    const parentIdx = units.map((_, i) => i);
    const findIdx = (i) => {
      let cur = i;
      while (parentIdx[cur] !== cur) cur = parentIdx[cur];
      let walk = i;
      while (walk !== cur) {
        const next = parentIdx[walk];
        parentIdx[walk] = cur;
        walk = next;
      }
      return cur;
    };
    const unionIdx = (a, b) => {
      const ra = findIdx(a);
      const rb = findIdx(b);
      if (ra !== rb) parentIdx[ra] = rb;
    };
    units.forEach((u, i) => {
      u.ids.forEach((id) => {
        (sibMap.get(id) || []).forEach((sid) => {
          if (unitOfId.has(sid)) unionIdx(i, unitOfId.get(sid));
        });
      });
    });
    const clusters = new Map();
    units.forEach((u, i) => {
      const r = findIdx(i);
      if (!clusters.has(r)) clusters.set(r, []);
      clusters.get(r).push(u);
    });
    const ordered = [];
    clusters.forEach((group) => {
      group.sort((a, b) =>
        String(a.nodes[0]?.name || "").localeCompare(
          String(b.nodes[0]?.name || ""),
          "fr"
        )
      );
      ordered.push(...group);
    });
    return ordered;
  }

  const unitsByGen = new Map();
  gens.forEach((g) => unitsByGen.set(g, unitsForGen(g)));

  const indexOf = new Map(); // nodeId -> unit index in its gen
  function reindex(g) {
    const units = unitsByGen.get(g) || [];
    units.forEach((u, i) => u.ids.forEach((id) => indexOf.set(id, i)));
  }
  gens.forEach(reindex);

  function unitBarycenter(unit, neighborIds) {
    const scores = [];
    unit.ids.forEach((id) => {
      (neighborIds(id) || []).forEach((nid) => {
        if (indexOf.has(nid)) scores.push(indexOf.get(nid));
      });
    });
    if (!scores.length) return null;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  const nameKey = (unit) => String(unit.nodes[0]?.name || "");

  // Barycenter sweeps to untangle
  for (let iter = 0; iter < 12; iter++) {
    for (let gi = 1; gi < gens.length; gi++) {
      const g = gens[gi];
      const units = unitsByGen.get(g);
      units.forEach((u) => {
        u._score = unitBarycenter(u, (id) => parentsOf.get(id));
      });
      units.sort((a, b) => {
        const sa = a._score;
        const sb = b._score;
        if (sa == null && sb == null) return 0;
        if (sa == null) return 1;
        if (sb == null) return -1;
        return (
          sa - sb ||
          nameKey(a).localeCompare(nameKey(b), "fr")
        );
      });
      reindex(g);
    }
    for (let gi = gens.length - 2; gi >= 0; gi--) {
      const g = gens[gi];
      const units = unitsByGen.get(g);
      units.forEach((u) => {
        u._score = unitBarycenter(u, (id) => childrenOf.get(id));
      });
      units.sort((a, b) => {
        const sa = a._score;
        const sb = b._score;
        if (sa == null && sb == null) return 0;
        if (sa == null) return 1;
        if (sb == null) return -1;
        return (
          sa - sb ||
          nameKey(a).localeCompare(nameKey(b), "fr")
        );
      });
      reindex(g);
    }
  }

  const unitGap = LABEL_PILL_GAP;

  function measureUnit(unit) {
    if (unit.nodes.length === 2) {
      const h0 = estimateNodeLabelHalfWidth(unit.nodes[0]);
      const h1 = estimateNodeLabelHalfWidth(unit.nodes[1]);
      // Centers far enough that the two pills never touch
      unit._spouseGap = Math.max(h0 + h1 + LABEL_PILL_GAP, 100);
      // Footprint: left pill edge → right pill edge
      unit._w = unit._spouseGap + h0 + h1;
    } else {
      const h = estimateNodeLabelHalfWidth(unit.nodes[0]);
      unit._spouseGap = 0;
      unit._w = h * 2;
    }
  }

  function assignUnitCenters(unit) {
    const cx = unit._cx;
    if (unit.nodes.length === 2) {
      unit.nodes[0].targetX = cx - unit._spouseGap / 2;
      unit.nodes[1].targetX = cx + unit._spouseGap / 2;
    } else {
      unit.nodes[0].targetX = cx;
    }
    unit.nodes.forEach((n) => {
      n.x = n.targetX;
    });
  }

  /** Prefer the member with the largest sibship so in-laws don't yank the block. */
  function primaryBloodChildId(unit, genMembers) {
    let bestId = null;
    let bestScore = -1;
    unit.ids.forEach((id) => {
      const parents = parentsOf.get(id) || [];
      if (!parents.length) return;
      const key = [...parents].sort().join("+");
      let score = 0;
      genMembers.forEach((n) => {
        if (unit.ids.includes(n.id)) return;
        const pp = parentsOf.get(n.id) || [];
        if (pp.length && [...pp].sort().join("+") === key) score += 1;
      });
      score += parents.length * 0.1;
      if (score > bestScore) {
        bestScore = score;
        bestId = id;
      }
    });
    return bestId;
  }

  function parentCoupleKey(unit, genMembers) {
    const primary = primaryBloodChildId(unit, genMembers);
    const parentIds = primary
      ? parentsOf.get(primary) || []
      : [...new Set(unit.ids.flatMap((id) => parentsOf.get(id) || []))];
    if (!parentIds.length) {
      return `solo:${unit.ids.slice().sort().join("-")}`;
    }
    return [...parentIds].sort().join("+");
  }

  function parentAnchorX(unit, genMembers) {
    const primary = primaryBloodChildId(unit, genMembers);
    const ids = primary ? [primary] : unit.ids;
    const refs = [];
    ids.forEach((id) => {
      (parentsOf.get(id) || []).forEach((p) => {
        const pn = byId.get(p);
        if (pn?.targetX != null) refs.push(pn.targetX);
      });
    });
    if (!refs.length) return null;
    return refs.reduce((a, b) => a + b, 0) / refs.length;
  }

  /**
   * Pack a generation: keep each sibship (same parents) as one contiguous
   * block centered under the parents. Never compress below label widths.
   */
  function placeRow(units, preferParentAnchor) {
    units.forEach(measureUnit);
    const genMembers = units.flatMap((u) => u.nodes);

    const groupMap = new Map();
    units.forEach((unit) => {
      const key = parentCoupleKey(unit, genMembers);
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key).push(unit);
    });

    const groups = [...groupMap.entries()].map(([key, members]) => {
      members.sort(
        (a, b) =>
          (a.nodes[0].birthYear ?? 0) - (b.nodes[0].birthYear ?? 0) ||
          nameKey(a).localeCompare(nameKey(b), "fr")
      );
      const anchors = members
        .map((m) => parentAnchorX(m, genMembers))
        .filter((x) => x != null);
      const desired =
        anchors.length > 0
          ? anchors.reduce((a, b) => a + b, 0) / anchors.length
          : null;
      const width =
        members.reduce((a, u) => a + u._w, 0) +
        unitGap * Math.max(0, members.length - 1);
      return { key, members, desired, width };
    });

    if (!preferParentAnchor || groups.every((g) => g.desired == null)) {
      let cursor = originX + 24;
      groups.forEach((group) => {
        group.cx = cursor + group.width / 2;
        cursor += group.width + unitGap;
      });
    } else {
      groups.forEach((group) => {
        group.cx =
          group.desired != null ? group.desired : originX + group.width / 2;
      });
      groups.sort(
        (a, b) =>
          (a.desired ?? 0) - (b.desired ?? 0) ||
          nameKey(a.members[0]).localeCompare(nameKey(b.members[0]), "fr")
      );

      // Push right only — never squeeze groups back together
      for (let i = 1; i < groups.length; i++) {
        const prev = groups[i - 1];
        const minCx =
          prev.cx + prev.width / 2 + unitGap + groups[i].width / 2;
        if (groups[i].cx < minCx) groups[i].cx = minCx;
      }

      // Keep the row starting near the tree origin (shift as a block if needed)
      if (groups.length) {
        const left = groups[0].cx - groups[0].width / 2;
        if (left < originX + 12) {
          const shift = originX + 12 - left;
          groups.forEach((g) => (g.cx += shift));
        }
      }
    }

    // Expand each group’s members left→right around group.cx
    groups.forEach((group) => {
      let x0 = group.cx - group.width / 2;
      group.members.forEach((unit) => {
        unit._cx = x0 + unit._w / 2;
        x0 += unit._w + unitGap;
        assignUnitCenters(unit);
      });
    });

    // Rewrite unitsByGen order for this gen (left → right)
    const ordered = [];
    groups
      .slice()
      .sort((a, b) => a.cx - b.cx)
      .forEach((g) => ordered.push(...g.members));
    return ordered;
  }

  gens.forEach((g, gi) => {
    const ordered = placeRow(unitsByGen.get(g) || [], gi > 0);
    unitsByGen.set(g, ordered);
    reindex(g);
  });

  // Light parent-centering pass without breaking sibship blocks
  for (let iter = 0; iter < 2; iter++) {
    gens.forEach((g, gi) => {
      if (gi === 0) return;
      const ordered = placeRow(unitsByGen.get(g) || [], true);
      unitsByGen.set(g, ordered);
      reindex(g);
    });
  }

  // Separate pills on the same generation row inside this tree
  resolveLabelPillOverlaps(nodes, (n) => (n.generation ?? 0) * 1000);

  return nodes;
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
        if (!currentFamily.childMeta) currentFamily.childMeta = {};
        switch (tag) {
          case "HUSB":
            currentFamily.husband = value;
            currentContext = "family";
            currentField = null;
            break;
          case "WIFE":
            currentFamily.wife = value;
            currentContext = "family";
            currentField = null;
            break;
          case "CHIL":
            currentFamily.children.push(value);
            if (!currentFamily.childMeta[value]) {
              currentFamily.childMeta[value] = { notes: [], citations: [] };
            }
            currentContext = "family-child";
            currentFamily._currentChild = value;
            currentField = null;
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
      } else if (currentFamily && level === "2" && currentContext === "family-child") {
        const childId = currentFamily._currentChild;
        const meta = childId ? currentFamily.childMeta?.[childId] : null;
        if (meta) {
          if (tag === "NOTE") {
            meta.notes.push(value);
            currentField = meta.notes;
          } else if (tag === "QUOT") {
            meta.citations.push(value);
            currentField = meta.citations;
          } else if (tag === "CONC" && currentField?.length) {
            currentField[currentField.length - 1] += value;
          } else if (tag === "CONT" && currentField?.length) {
            currentField[currentField.length - 1] += " " + value;
          }
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
  // FAM-level QUOT proves the couple / household in the text → Spouse only.
  // Per-child 2 QUOT/NOTE under 1 CHIL → Parent links for that child only.
  // Sibling edges stay clean (no recycled marriage quotes).
  Object.values(families).forEach((fam) => {
    const { husband, wife, children } = fam;
    const famNotes = fam.notes || [];
    const famCitations = fam.citations || [];
    const childMeta = fam.childMeta || {};

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
      const meta = childMeta[child] || {};
      const childNotes = meta.notes || [];
      const childCitations = meta.citations || [];
      if (husband) {
        links.push({
          source: husband,
          target: child,
          relation: "Parent",
          type: "family",
          notes: childNotes,
          citations: childCitations,
        });
      }
      if (wife) {
        links.push({
          source: wife,
          target: child,
          relation: "Parent",
          type: "family",
          notes: childNotes,
          citations: childCitations,
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
          notes: [],
          citations: [],
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
  // Generations drive horizontal family packing in both layered modes
  if (isLayeredLayout(layoutMode)) {
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
  const genCount = Math.max(1, maxGen - minGen + 1);
  const margin = {
    top: 72,
    right: 120,
    // Room for labels under nodes + narrative/legend chrome
    bottom: isLayeredLayout(layoutMode) ? 160 : 56,
    left: isLayeredLayout(layoutMode) ? 78 : 40,
  };
  const innerH = Math.max(height - margin.top - margin.bottom, 220);
  // Comfortable vertical rhythm between generation bands (MyHeritage-like)
  const genBandH =
    layoutMode === "genealogy"
      ? Math.max(innerH / Math.max(genCount - 1, 1), 188)
      : null;
  const genealogyInnerH =
    layoutMode === "genealogy"
      ? Math.max(innerH, genBandH * Math.max(genCount - 1, 1))
      : innerH;
  // Chrono: stretch the year axis a bit so birth bands breathe
  const chronoInnerH =
    layoutMode === "chrono" ? Math.max(innerH, 520) : innerH;

  const layeredY = (d) => {
    if (layoutMode === "genealogy") {
      if (maxGen === minGen) return margin.top + genealogyInnerH / 2;
      const t = ((d.generation ?? 0) - minGen) / (maxGen - minGen);
      return margin.top + t * genealogyInnerH;
    }
    const t = (d.birthYear - minYear) / yearSpan;
    return margin.top + t * chronoInnerH;
  };
  // Virtual canvas — layered layouts grow with label sizes (pan/zoom to explore)
  let layoutWidth = Math.max(
    (width - margin.left - margin.right) *
      (isLayeredLayout(layoutMode) ? Math.max(spread, 2.4) : spread),
    isLayeredLayout(layoutMode) ? 1100 : 320
  );
  let worldCenterX = margin.left + layoutWidth / 2;

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
      n.targetX = null;
      n.x = worldCenterX + (Math.random() - 0.5) * layoutWidth * 0.55;
      n.y = height / 2 + (Math.random() - 0.5) * height * 0.45;
    }
  });
  if (isLayeredLayout(layoutMode)) {
    // Same untangled family packing for genealogy + chrono (Y differs)
    layoutGenealogyPositions(sorted, data.links, margin.left, layoutWidth);
    // Separate pills that share a vertical band (critical for chrono)
    resolveLabelPillOverlaps(sorted, layeredY);
    const contentRight = Math.max(
      ...sorted.map(
        (n) => (n.targetX ?? n.x ?? margin.left) + estimateNodeLabelHalfWidth(n)
      ),
      margin.left + 400
    );
    layoutWidth = Math.max(layoutWidth, contentRight - margin.left + 100);
    worldCenterX = margin.left + layoutWidth / 2;
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
    .filter((event) => {
      // Accidental double-tap zoom is jarring on phones
      if (event.type === "dblclick") return false;
      // Multi-touch pinch always allowed
      if (event.touches && event.touches.length >= 2) return true;
      return (!event.ctrlKey || event.type === "wheel") && !event.button;
    })
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
          src.type === "pointermove" ||
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
  svg.call(zoom)
    .on("dblclick.zoom", null);
  graphZoom = zoom;
  graphSvg = svg;
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
            ? margin.top + genealogyInnerH / 2
            : margin.top + ((g - minGen) / tickCount) * genealogyInnerH;
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
        const y = margin.top + (chronoInnerH * i) / tickCount;
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
  // Keep ASSO + siblings in the DOM (visibility via isLinkInDepth / focus)
  const drawableLinks = data.links.filter((l) => {
    if (graphFilters.linkKind === "other") return l.type !== "family";
    return true;
  });

  const nodeById = new Map(data.nodes.map((n) => [n.id, n]));
  // co-parent lookup for MyHeritage parent elbows: parentId|childId → co-parent id
  const coParentId = new Map();
  if (isLayeredLayout(layoutMode)) {
    const parentsByChild = new Map();
    familyLinks.forEach((l) => {
      if (l.relation !== "Parent") return;
      const sid = typeof l.source === "object" ? l.source.id : l.source;
      const tid = typeof l.target === "object" ? l.target.id : l.target;
      if (!parentsByChild.has(tid)) parentsByChild.set(tid, []);
      const arr = parentsByChild.get(tid);
      if (!arr.includes(sid)) arr.push(sid);
    });
    parentsByChild.forEach((parents, childId) => {
      if (parents.length < 2) return;
      parents.forEach((p) => {
        const other = parents.find((x) => x !== p);
        if (other) coParentId.set(`${p}|${childId}`, other);
      });
    });
  }

  if (isLayeredLayout(layoutMode)) {
    // Deterministic family packing + light polish (ASSO never pull the tree)
    simulation = d3
      .forceSimulation(data.nodes)
      .force(
        "linkSpouse",
        d3
          .forceLink(familyLinks.filter((l) => l.relation === "Spouse"))
          .id((d) => d.id)
          .distance((d) => {
            const s = typeof d.source === "object" ? d.source : null;
            const t = typeof d.target === "object" ? d.target : null;
            if (s && t) {
              return (
                estimateNodeLabelHalfWidth(s) +
                estimateNodeLabelHalfWidth(t) +
                LABEL_PILL_GAP
              );
            }
            return 120;
          })
          .strength(0.25)
      )
      .force(
        "collide",
        d3
          .forceCollide()
          .radius((d) => estimateNodeLabelHalfWidth(d) + LABEL_PILL_GAP / 2)
          .strength(0.85)
      )
      .force("y", d3.forceY(layeredY).strength(1))
      .force(
        "x",
        d3
          .forceX((d) => d.targetX ?? worldCenterX)
          .strength(0.92)
      )
      .alphaDecay(0.12)
      .alphaMin(0.001);
  } else {
    const forceLinks =
      graphFilters.linkKind === "all" || graphFilters.linkKind === "other"
        ? data.links
        : familyLinks;
    simulation = d3
      .forceSimulation(data.nodes)
      .force(
        "link",
        d3
          .forceLink(forceLinks)
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

  const linkEndNode = (end) =>
    typeof end === "object" && end ? end : nodeById.get(end);

  const linkPath = (d) => {
    const src = linkEndNode(d.source);
    const tgt = linkEndNode(d.target);
    if (!src || !tgt || src.x == null || tgt.x == null) return "";
    const sx = src.x;
    const sy = src.y;
    const tx = tgt.x;
    const ty = tgt.y;
    if (!isLayeredLayout(layoutMode)) {
      return `M${sx},${sy}L${tx},${ty}`;
    }
    // Layered: orthogonal pedigree routing (couple bar → drop → sibship bar → child)
    if (d.type === "family") {
      if (d.relation === "Spouse") {
        const y = (sy + ty) / 2;
        return `M${sx},${y}L${tx},${y}`;
      }
      if (d.relation === "Parent") {
        const pid = src.id;
        const cid = tgt.id;
        const coId = coParentId.get(`${pid}|${cid}`);
        const co = coId ? nodeById.get(coId) : null;
        const coupleMidX = co && co.x != null ? (sx + co.x) / 2 : sx;
        const barY = sy + (ty - sy) * 0.55;
        return `M${sx},${sy}L${coupleMidX},${sy}L${coupleMidX},${barY}L${tx},${barY}L${tx},${ty}`;
      }
      const midY = Math.min(sy, ty) - 18;
      return `M${sx},${sy}C${sx},${midY} ${tx},${midY} ${tx},${ty}`;
    }
    // ASSO: fan lanes when focused so stacked chords stay separable / clickable
    const laneCount = d._focusLaneCount || 0;
    const lane = d._focusLane ?? 0;
    if (laneCount > 1) {
      const t = lane / (laneCount - 1); // 0…1
      const side = lane % 2 === 0 ? -1 : 1;
      const rank = Math.floor(lane / 2);
      const bulge = side * (55 + rank * 38);
      // Stagger the apex along the chord so long parallel arcs don't overlap
      const along = 0.22 + t * 0.56;
      const cx = sx + (tx - sx) * along;
      const cy = sy + (ty - sy) * along + bulge;
      return `M${sx},${sy}Q${cx},${cy} ${tx},${ty}`;
    }
    const midY = (sy + ty) / 2;
    const bow = Math.max(40, Math.min(90, Math.abs(ty - sy) * 0.28));
    const bend = (sx + tx) / 2 - Math.sign(tx - sx || 1) * bow;
    return `M${sx},${sy}C${sx},${midY} ${bend},${midY} ${tx},${ty}`;
  };

  // Paint order: links (back) → circles → labels (front).
  // Names stay readable over red/grey curves on desktop and mobile.
  const linksLayer = container.append("g").attr("class", "links");
  const nodesLayer = container.append("g").attr("class", "nodes");
  const labelsLayer = container.append("g").attr("class", "node-labels");

  // Wide invisible hit targets (esp. for thin dashed association lines / fat fingers)
  const coarseHits = isCoarsePointer();
  const linkHit = linksLayer
    .selectAll("path.link-hit")
    .data(drawableLinks)
    .enter()
    .append("path")
    .attr("class", (d) => `link-hit link-hit-${d.type || "association"}`)
    .attr("fill", "none")
    .attr("stroke", "transparent")
    .attr("stroke-width", (d) => {
      if (d.type === "family") return coarseHits ? 22 : 14;
      return coarseHits ? 28 : 18;
    })
    .attr("stroke-linecap", "round")
    .classed("is-depth-hidden", (d) => !isLinkInDepth(d))
    .style("cursor", "pointer")
    .style("pointer-events", (d) => (isLinkInDepth(d) ? "stroke" : "none"));

  const link = linksLayer
    .selectAll("path.link")
    .data(drawableLinks)
    .enter()
    .append("path")
    .attr("class", (d) => `link link-${d.type || "association"}`)
    .attr("fill", "none")
    .attr("stroke", (d) => (d.type === "family" ? "#b4534a" : "#8a96a3"))
    .attr("stroke-width", (d) =>
      d.type === "family" ? (d.relation === "Spouse" ? 2.15 : 1.55) : 1.25
    )
    .attr("stroke-opacity", (d) => (d.type === "family" ? 0.82 : 0.45))
    .attr("stroke-dasharray", (d) => (d.type === "family" ? null : "4 5"))
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round")
    .style("pointer-events", "none")
    .style("opacity", (d) => (isLinkInDepth(d) ? 1 : 0));

  const node = nodesLayer
    .selectAll("g")
    .data(data.nodes)
    .enter()
    .append("g")
    .attr("class", "node")
    .call(drag(simulation));

  const labelRoot = labelsLayer
    .selectAll("g.node-label-root")
    .data(data.nodes)
    .enter()
    .append("g")
    .attr("class", "node-label-root");

  const labelGroup = labelRoot.append("g").attr("class", "node-label-group");
  const labelBelow = isLayeredLayout(layoutMode);

  labelGroup
    .append("rect")
    .attr("class", "node-label-bg")
    .attr("rx", labelBelow ? 6 : 5)
    .attr("ry", labelBelow ? 6 : 5);

  labelGroup
    .append("text")
    .attr("class", "node-label")
    .attr("text-anchor", labelBelow ? "middle" : "start")
    .attr("x", labelBelow ? 0 : 14)
    .attr("y", labelBelow ? 26 : 4)
    .text((d) => d.name);

  labelGroup
    .append("text")
    .attr("class", "node-year")
    .attr("text-anchor", labelBelow ? "middle" : "start")
    .attr("x", labelBelow ? 0 : 14)
    .attr("y", labelBelow ? 40 : 18)
    .text((d) => nodeSecondaryLabel(d));

  resizeNodeLabelBackground(labelGroup);

  // Invisible fat hit target under the visible circle (≈44px on phone)
  node
    .append("circle")
    .attr("class", "node-hit")
    .attr("r", coarseHits ? 22 : 16);

  node
    .append("circle")
    .attr("r", isLayeredLayout(layoutMode) ? 11 : 9)
    .attr("fill", (d) => (d.sex === "M" ? "#2563eb" : "#db2777"))
    .attr("stroke", "#fff")
    .attr("stroke-width", isLayeredLayout(layoutMode) ? 2.4 : 2);

  node
    .append("text")
    .attr("x", -6)
    .attr("y", 4)
    .attr("class", "cross")
    .text((d) => (d.death && d.death.status ? "✝" : ""));

  if (currentNarrativeTime) {
    const markDead = (d) => {
      const info = ageAtNarrative(d, currentNarrativeTime);
      return info?.kind === "dead";
    };
    node.classed("is-dead-at-time", markDead);
    labelRoot.classed("is-dead-at-time", markDead);
  }

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
    .on("mouseenter.hover", (event, d) => {
      applyNodeHoverPreview(d, tooltip, event);
    })
    .on("mousemove.hover", (event, d) => {
      if (
        !isPinnedNode(d.id) &&
        !(lastFocusedNode && d.id !== lastFocusedNode.id)
      ) {
        return;
      }
      placeTooltipAtPointer(tooltip, event);
    })
    .on("mouseleave.hover", () => {
      endFocusedPairHover(tooltip);
    });

  // Pointer left the neighbor onto link-hit / backdrop / chrome — mouseleave on
  // the node alone is unreliable because fat link-hits sit under the cursor path.
  svg.on("mousemove.pairGuard", (event) => {
    guardFocusedPairHover(tooltip, event);
  });
  svg.on("mouseleave.hoverClear", () => {
    endFocusedPairHover(tooltip);
  });
  // Backdrop is under nodes/links; moving onto empty graph must clear the flyout
  d3.select(zoomRoot.node())
    .select(".graph-backdrop")
    .on("mousemove.pairGuard", (event) => {
      guardFocusedPairHover(tooltip, event);
    })
    .on("mouseenter.pairGuard", (event) => {
      guardFocusedPairHover(tooltip, event);
    });

  // Touch: short tap = focus; one-finger hold = mouse hover preview; move = pan/zoom
  const LONG_PRESS_MS = 420;
  const TOUCH_MOVE_PX = 14;
  let touchTimer = null;
  let touchStart = null;
  let touchLongPressed = false;
  let touchMoved = false;
  let touchSuppressClick = false;

  const clearTouchTimer = () => {
    if (touchTimer) clearTimeout(touchTimer);
    touchTimer = null;
  };

  node
    .on("touchstart.interact", (event, d) => {
      if (event.touches && event.touches.length > 1) {
        if (touchLongPressed) clearHoverPreview(tooltip);
        clearTouchTimer();
        touchStart = null;
        touchLongPressed = false;
        touchMoved = false;
        return;
      }
      const t = event.touches[0];
      touchStart = { x: t.clientX, y: t.clientY, id: d.id, pageX: t.pageX, pageY: t.pageY };
      touchLongPressed = false;
      touchMoved = false;
      touchSuppressClick = false;
      clearTouchTimer();
      touchTimer = setTimeout(() => {
        if (!touchStart || touchStart.id !== d.id) return;
        touchLongPressed = true;
        touchSuppressClick = true;
        applyNodeHoverPreview(d, tooltip, {
          pageX: touchStart.pageX,
          pageY: touchStart.pageY,
          clientX: touchStart.x,
          clientY: touchStart.y,
          touches: event.touches,
          type: "touchstart",
        });
      }, LONG_PRESS_MS);
    })
    .on("touchmove.interact", (event) => {
      if (!touchStart) return;
      if (event.touches && event.touches.length > 1) {
        if (touchLongPressed) clearHoverPreview(tooltip);
        clearTouchTimer();
        touchStart = null;
        touchLongPressed = false;
        touchMoved = true;
        return;
      }
      const t = event.touches[0];
      if (
        Math.hypot(t.clientX - touchStart.x, t.clientY - touchStart.y) >
        TOUCH_MOVE_PX
      ) {
        touchMoved = true;
        clearTouchTimer();
        if (touchLongPressed) {
          clearHoverPreview(tooltip);
          touchLongPressed = false;
        }
        touchStart = null;
      }
    })
    .on("touchend.interact", (event, d) => {
      clearTouchTimer();
      const wasLong = touchLongPressed;
      const wasTap = Boolean(touchStart) && !touchMoved && !wasLong;
      touchStart = null;
      touchLongPressed = false;
      touchMoved = false;

      if (wasLong) {
        // Hold = hover while pressed; release clears like mouseleave
        event.preventDefault();
        clearHoverPreview(tooltip);
        touchSuppressClick = true;
        setTimeout(() => {
          touchSuppressClick = false;
        }, 400);
        return;
      }

      if (wasTap && !nodeDragMoved) {
        if (isSelectionPinned() && !isPinnedNode(d.id)) {
          event.preventDefault();
          return;
        }
        // Prevent iOS ghost click; handle tap directly
        event.preventDefault();
        event.stopPropagation();
        touchSuppressClick = true;
        setTimeout(() => {
          touchSuppressClick = false;
        }, 400);
        cancelHoverRestore();
        focusNode(d);
      }
    })
    .on("touchcancel.interact", () => {
      clearTouchTimer();
      if (touchLongPressed) clearHoverPreview(tooltip);
      touchStart = null;
      touchLongPressed = false;
      touchMoved = false;
    });

  node.on("click", (event, d) => {
    if (touchSuppressClick) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    // d3-drag marks defaultPrevented when a real drag happened
    if (event.defaultPrevented || nodeDragMoved) return;
    // Second click of a double-click — let dblclick.nucleus handle it
    if (event.detail > 1) {
      event.stopPropagation();
      return;
    }
    event.stopPropagation();

    const runFocus = () => {
      nodeClickTimer = null;
      cancelHoverRestore();
      focusNode(d);
    };

    // Already on this node: defer so a quick second click can become nucleus
    // without focusNode() resetting focusScope to "depth" first.
    if (lastFocusedNode?.id === d.id) {
      clearTimeout(nodeClickTimer);
      nodeClickTimer = setTimeout(runFocus, NODE_CLICK_DELAY_MS);
      return;
    }

    clearTimeout(nodeClickTimer);
    nodeClickTimer = null;
    runFocus();
  });

  // Double-click → family nucleus (parents / children / siblings) on the graph
  node.on("dblclick.nucleus", (event, d) => {
    event.preventDefault();
    event.stopPropagation();
    clearTimeout(nodeClickTimer);
    nodeClickTimer = null;
    if (nodeDragMoved) return;
    cancelHoverRestore();
    activeHover = null;
    d3.selectAll("body > .tooltip, .tooltip").style("display", "none");
    // Same toggle as the sheet button: 2nd double-click returns to neighborhood
    if (focusScope === "nucleus" && lastFocusedNode?.id === d.id) {
      focusScope = "depth";
      nucleusKind = "all";
      lastFocusedNode =
        allNodes.find((n) => n.id === d.id) ||
        (window.allNodes || []).find((n) => n.id === d.id) ||
        d;
      hideCharacterSheet({ refit: false });
      emphasizeFocusedNode(d.id, {
        raiseId: d.id,
        duration: 200,
        raise: true,
      });
      applyFocusNeighborSpread(d.id, { animate: false });
      syncFocusChip();
      return;
    }
    activateFamilyNucleus(d.id, "all");
  });

  redrawGraphGeometry = () => {
    link.attr("d", linkPath);
    linkHit.attr("d", linkPath);
    node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    labelRoot.attr("transform", (d) => `translate(${d.x},${d.y})`);
  };

  simulation.on("tick", () => {
    if (focusFanActive) {
      // Fan layout owns positions; don't fight the tween / freeze
      redrawGraphGeometry();
      return;
    }
    if (isLayeredLayout(layoutMode)) {
      data.nodes.forEach((d) => {
        const targetY = layeredY(d) + (d.focusYOffset || 0);
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

    redrawGraphGeometry();
  });

  // No auto-zoom — user pans / pinches / uses +/- controls. Snapshot homes only.
  let didSnapshotHomes = false;
  simulation.on("end", () => {
    try {
      data.nodes.forEach((n) => {
        if (n.homeX == null || !didSnapshotHomes) {
          n.homeX = n.x;
          n.homeY = n.y;
          n.homeTargetX = n.targetX != null ? n.targetX : n.x;
        }
        n.focusYOffset = 0;
      });
      didSnapshotHomes = true;
      focusFanActive = false;
      clearFocusLinkLanes();
      if (lastFocusedNode?.id) {
        applyFocusNeighborSpread(lastFocusedNode.id, { animate: false });
        emphasizeFocusedNode(lastFocusedNode.id, {
          raiseId: lastFocusedNode.id,
          duration: 0,
          raise: true,
        });
      }
    } catch (_) {
      /* ignore */
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

function emphasizeNodePair(aId, bId, { duration = 80, raise = false } = {}) {
  const keep = linkKeepBetween(aId, bId);
  emphasizeGraph({
    nodeIds: new Set([aId, bId]),
    linkKeep: keep,
    raiseId: bId,
    duration,
    raise,
    // Pair hover should show the connecting edge even if depth-filtered
    revealKeptLinks: true,
    pairHighlight: true,
  });
}

/** Coarse pointer (phones) — larger hit targets, touch-first gestures. */
function isCoarsePointer() {
  try {
    return (
      (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ||
      (window.matchMedia && window.matchMedia("(hover: none)").matches) ||
      ("ontouchstart" in window && window.innerWidth <= 900)
    );
  } catch (_) {
    return false;
  }
}

function pointerPageXY(event) {
  const src = event?.sourceEvent || event;
  const touch = src?.touches?.[0] || src?.changedTouches?.[0];
  if (touch) {
    return { pageX: touch.pageX, pageY: touch.pageY, clientX: touch.clientX, clientY: touch.clientY };
  }
  return {
    pageX: src?.pageX ?? 0,
    pageY: src?.pageY ?? 0,
    clientX: src?.clientX ?? 0,
    clientY: src?.clientY ?? 0,
  };
}

/** Place tooltip near pointer; on touch, prefer above the finger. */
function placeTooltipAtPointer(tooltip, event, { above = false } = {}) {
  if (!tooltip || !event) return;
  const p = pointerPageXY(event);
  const el = typeof tooltip.node === "function" ? tooltip.node() : null;
  const tipW = el?.offsetWidth || 280;
  const tipH = el?.offsetHeight || 80;
  let left = p.pageX + 10;
  let top = p.pageY + 10;
  if (above) {
    left = Math.max(8, Math.min(window.innerWidth - tipW - 8, p.pageX - tipW / 2));
    top = Math.max(8, p.pageY - tipH - 18);
  } else {
    left = Math.max(8, Math.min(window.innerWidth - tipW - 8, left));
    top = Math.max(8, Math.min(window.innerHeight - tipH - 8, top));
  }
  tooltip.style("top", `${top}px`).style("left", `${left}px`);
}

/**
 * Free hover: only the edges that touch this node (star), not the whole depth ball.
 * Avoids lighting up “other people’s” family links among relatives.
 */
function makeHoverStarLinkKeep(nodeId) {
  return (link) => {
    const { sourceId, targetId } = linkEnds(link);
    return sourceId === nodeId || targetId === nodeId;
  };
}

function hoverStarNodeIds(nodeId) {
  const ids = new Set([nodeId]);
  (allLinks || []).forEach((link) => {
    const { sourceId, targetId } = linkEnds(link);
    if (sourceId !== nodeId && targetId !== nodeId) return;
    // Respect kind filter for family vs ASSO; ASSO of ego always allowed on hover
    if (link.type === "family") {
      if (graphFilters.linkKind === "other") return;
    } else if (
      graphFilters.linkKind !== "all" &&
      graphFilters.linkKind !== "other"
    ) {
      // blood default: still show ego ASSO on hover preview
    }
    ids.add(sourceId === nodeId ? targetId : sourceId);
  });
  return ids;
}

function emphasizeHoverStar(
  nodeId,
  { raiseId = null, duration = 80, raise = false } = {}
) {
  const keep = makeHoverStarLinkKeep(nodeId);
  emphasizeGraph({
    nodeIds: hoverStarNodeIds(nodeId),
    linkKeep: keep,
    raiseId,
    duration,
    raise,
    revealKeptLinks: true,
    snapLinks: true,
  });
}

/**
 * Same visual as mouseenter on a node (neighborhood / pair + tooltip).
 * Used by desktop hover and one-finger long-press on touch.
 */
function applyNodeHoverPreview(d, tooltip, event) {
  if (!d) return false;
  cancelHoverRestore();
  // Focused character: hovering anyone shows the relation (direct or kinship path)
  if (lastFocusedNode && d.id !== lastFocusedNode.id && !lastFocusedLink) {
    applyPinnedNodePairHover(lastFocusedNode.id, d, tooltip, event);
    return true;
  }
  pairHoverNeighborId = null;
  if (!isPinnedNode(d.id)) return false;
  activeHover = { kind: "node", id: d.id };
  showPersonHoverTooltip(d, tooltip, event);
  if (!isSelectionPinned()) {
    // Star of this node only — not the full kinship ball
    emphasizeHoverStar(d.id, {
      raiseId: null,
      duration: 80,
      raise: false,
    });
  } else if (lastFocusedNode && d.id === lastFocusedNode.id) {
    // Hovering ego itself: keep focus neighborhood, just show its card
    restorePersistentEmphasis();
  }
  return true;
}

function applyLinkHoverPreview(d, tooltip, event) {
  if (!d || !isPinnedLink(d)) return false;
  // Fat link-hit strokes sit around nodes. While a character is focused,
  // relation flyouts come from hovering other nodes only — otherwise leaving
  // a neighbor immediately re-enters a link-hit and the flyout sticks.
  if (lastFocusedNode && !lastFocusedLink) return false;
  cancelHoverRestore();
  const { sourceId, targetId } = linkEnds(d);
  const source = allNodes.find((n) => n.id === sourceId);
  const target = allNodes.find((n) => n.id === targetId);
  if (!source || !target) return false;
  activeHover = { kind: "link", key: `${sourceId}→${targetId}` };
  showLinkHoverTooltip(d, tooltip, event);
  emphasizeNodePair(sourceId, targetId, { duration: 100, raise: false });
  return true;
}

function clearHoverPreview(tooltip) {
  if (
    activeHover?.kind === "node" ||
    activeHover?.kind === "pair" ||
    activeHover?.kind === "link"
  ) {
    activeHover = null;
  }
  if (tooltip) tooltip.style("display", "none");
  scheduleHoverRestore();
}

/** Leave a hovered neighbor while focused → hide flyout + restore ego view. */
function endFocusedPairHover(tooltip) {
  const hadPair = Boolean(pairHoverNeighborId);
  pairHoverNeighborId = null;
  clearHoverPreview(tooltip);
  if (!lastFocusedNode || lastFocusedLink) return;
  cancelHoverRestore();
  activeHover = null;
  if (hadPair || lastFocusedNode) restorePersistentEmphasis();
}

/**
 * Reliable clear: mouseleave on nodes is often stolen by fat link-hits.
 * While a pair flyout is open, any pointer position not over that neighbor
 * (and not over another node that will replace the hover) closes it.
 */
function guardFocusedPairHover(tooltip, event) {
  if (!pairHoverNeighborId || !lastFocusedNode || lastFocusedLink) return;
  const src = event?.sourceEvent || event;
  const x = src?.clientX;
  const y = src?.clientY;
  if (x == null || y == null) return;
  const el = document.elementFromPoint(x, y);
  const nodeEl = el?.closest?.("g.node");
  if (nodeEl) {
    const id = d3.select(nodeEl).datum()?.id;
    if (id === pairHoverNeighborId) return;
    // Different node (including ego): mouseenter handler switches the preview
    return;
  }
  endFocusedPairHover(tooltip);
}

function personNicknamesList(person) {
  const raw = [];
  if (Array.isArray(person?.nicknames) && person.nicknames.length) {
    raw.push(...person.nicknames);
  } else if (person?.nickname) {
    raw.push(
      ...String(person.nickname)
        .split(/\s*·\s*/)
        .filter(Boolean)
    );
  }
  const seen = new Set();
  const out = [];
  for (const n of raw) {
    const label = String(n || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

function showPersonHoverTooltip(person, tooltip, event) {
  if (!person || !tooltip) return;
  const t = window.t || ((k) => k);
  const yearLabel =
    person.birthYear != null
      ? `${person.birthYearInferred ? "~" : ""}${Math.round(person.birthYear)}`
      : "?";
  const nicks = personNicknamesList(person);
  const nickHtml = nicks.length
    ? `<div class="tooltip-aka"><span class="tooltip-aka-label">${escapeHtmlGlobal(
        nicks.length === 1 ? t("nickname") : t("nicknames")
      )}</span> ${escapeHtmlGlobal(nicks.join(" · "))}</div>`
    : "";
  const occ = person.occupation
    ? `<div class="tooltip-occ">${escapeHtmlGlobal(person.occupation)}</div>`
    : "";
  tooltip.style("display", "block");
  tooltip.html(
    `<strong>${escapeHtmlGlobal(person.name || "")}</strong>${nickHtml}${occ}<div>${escapeHtmlGlobal(
      t("birth")
    )}: ${escapeHtmlGlobal(yearLabel)}</div>`
  );
  if (event) placeTooltipAtPointer(tooltip, event, { above: isTouchLikeEvent(event) });
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
  if (event) placeTooltipAtPointer(tooltip, event, { above: isTouchLikeEvent(event) });
}

function isTouchLikeEvent(event) {
  const src = event?.sourceEvent || event;
  return Boolean(
    src?.touches?.length ||
      src?.changedTouches?.length ||
      src?.pointerType === "touch" ||
      src?.type?.startsWith?.("touch")
  );
}

/** Emphasize nodes + edges along a kinship path (inclusive). */
function emphasizeNodePath(pathIds, { raiseId = null, duration = 80, raise = true } = {}) {
  const path = pathIds || [];
  const nodeIds = new Set(path);
  const edgeKeys = new Set();
  for (let i = 0; i < path.length - 1; i++) {
    edgeKeys.add([path[i], path[i + 1]].sort().join("|"));
  }
  const keep = (l) => {
    const { sourceId, targetId } = linkEnds(l);
    return edgeKeys.has([sourceId, targetId].sort().join("|"));
  };
  emphasizeGraph({
    nodeIds,
    linkKeep: keep,
    raiseId: raiseId || path[path.length - 1],
    duration,
    raise,
    revealKeptLinks: true,
    pairHighlight: true,
  });
}

/**
 * While a character is focused, hovering another node highlights the pair
 * (direct edge, or multi-hop blood path) and shows the relation tooltip.
 */
function applyPinnedNodePairHover(focusedId, hoveredNode, tooltip, event) {
  const hoveredId = hoveredNode.id;
  pairHoverNeighborId = hoveredId;
  const t = window.t || ((k) => k);
  const link = findAnyLinkBetween(focusedId, hoveredId);
  if (link) {
    const { sourceId, targetId } = linkEnds(link);
    activeHover = {
      kind: "pair",
      ids: [focusedId, hoveredId],
      key: `${sourceId}→${targetId}`,
    };
    emphasizeNodePair(focusedId, hoveredId, { duration: 100, raise: true });
    showLinkHoverTooltip(link, tooltip, event);
    return;
  }

  const blood = describeBloodRelation(
    focusedId,
    hoveredId,
    t,
    familyAdj,
    allLinks
  );
  if (blood?.path?.length >= 2) {
    activeHover = {
      kind: "pair",
      ids: [focusedId, hoveredId],
      path: blood.path,
    };
    emphasizeNodePath(blood.path, {
      raiseId: hoveredId,
      duration: 100,
      raise: true,
    });
    const phrases = [blood.forwardPhraseHtml, blood.reversePhraseHtml].filter(
      Boolean
    );
    let html = renderRelationPhraseListHtml(phrases);
    if (blood.forwardDetailHtml) {
      html += `<div class="evidence-block"><div class="evidence-label">${escapeHtml(
        t("kinPathShowDetail")
      )}</div><p class="muted" style="margin:4px 0 0;font-style:normal">${
        blood.forwardDetailHtml
      }</p></div>`;
    }
    tooltip.style("display", "block").html(html);
    if (event) {
      placeTooltipAtPointer(tooltip, event, { above: isTouchLikeEvent(event) });
    }
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
  const focused =
    allNodes.find((n) => n.id === focusedId) ||
    (window.allNodes || []).find((n) => n.id === focusedId);
  tooltip.style("display", "block").html(
    `<strong>${escapeHtml(focused?.name || "")}</strong> · <strong>${escapeHtml(
      hoveredNode.name || ""
    )}</strong><br><span class="muted">${escapeHtml(t("pairNoRelation"))}</span>`
  );
  if (event) {
    placeTooltipAtPointer(tooltip, event, { above: isTouchLikeEvent(event) });
  }
}

function syncHitPointerEvents(keepLink, locked, revealKeptLinks = false) {
  // Match emphasizeGraph: when a selection/hover set is active, only kept links
  const linkVisible = (l) => {
    if (revealKeptLinks || locked) return keepLink(l);
    return isLinkInDepth(l);
  };
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
  pairHighlight = false,
  snapLinks = false,
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
  // When isolating a hover/focus set, do NOT fall back to global isLinkInDepth
  // (that would keep every blood edge lit in "upto" with no ego / mode all).
  const linkVisible = (l) => {
    if (revealKeptLinks || locked) return keepLink(l);
    return isLinkInDepth(l);
  };
  const linkHot = (l) => keepLink(l) && linkVisible(l);
  const instantLinks = pairHighlight || snapLinks || locked;

  d3.selectAll(".node, .node-label-root")
    .classed("is-emphasized", (d) => keepNode(d.id))
    .classed("is-dimmed", (d) => locked && !keepNode(d.id))
    .classed("is-locked-out", (d) => isSelectionPinned() && !keepNode(d.id))
    .interrupt()
    .transition()
    .duration(duration)
    .style("opacity", (d) => (keepNode(d.id) ? 1 : 0.12));

  const linkSel = d3
    .selectAll(".link")
    .classed("is-emphasized", (l) => linkHot(l))
    .classed("is-pair-highlight", (l) => pairHighlight && linkHot(l))
    .classed("is-dimmed", (l) => locked && !keepLink(l))
    .classed("is-depth-hidden", (l) => !linkVisible(l))
    .interrupt();

  const applyLinkOpacity = (sel) =>
    sel
      .style("opacity", (l) => (linkHot(l) ? 1 : 0))
      .attr("opacity", (l) => (linkHot(l) ? 1 : 0))
      .attr("stroke-opacity", (l) => (linkHot(l) ? 1 : 0));

  if (instantLinks) {
    applyLinkOpacity(linkSel);
    if (!pairHighlight) {
      linkSel.classed("is-pair-highlight", false);
    }
  } else {
    linkSel.classed("is-pair-highlight", false);
    applyLinkOpacity(
      linkSel.transition().duration(duration)
    );
  }

  d3.selectAll(".link-hit")
    .classed("is-pair-highlight", (l) => pairHighlight && linkHot(l))
    .classed("is-depth-hidden", (l) => !linkVisible(l))
    .attr("opacity", (l) => (linkVisible(l) ? 1 : 0));

  // dimmed hits must not capture hover/click while a selection is active
  syncHitPointerEvents(
    keepLink,
    locked || isSelectionPinned(),
    revealKeptLinks
  );

  if (!raise) return;

  // Preserve paint order: links → circles → labels (names always on top)
  d3.select("g.links").raise();
  d3.selectAll(".link")
    .filter((l) => linkHot(l))
    .raise();
  d3.select("g.nodes").raise();

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

  d3.select("g.node-labels").raise();
  if (nodeIds) {
    d3.selectAll(".node-label-root")
      .filter((d) => keepNode(d.id) && d.id !== raiseId)
      .raise();
    if (raiseId) {
      d3.selectAll(".node-label-root")
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
    // Show ego's ASSO/family edges even when the global blood filter hides them
    revealKeptLinks: true,
    snapLinks: true,
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
    // Nucleus edges must show even if the depth filter would hide them
    revealKeptLinks: true,
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
  d3.selectAll(".node, .node-label-root")
    .classed("is-dimmed", false)
    .classed("is-emphasized", false)
    .classed("is-locked-out", false)
    .classed("is-event-cast", false)
    .interrupt()
    .transition()
    .duration(duration)
    .style("opacity", 1);
  d3.selectAll(".link, .link-hit")
    .classed("is-dimmed", false)
    .classed("is-emphasized", false)
    .classed("is-pair-highlight", false)
    .classed("is-locked-out", false)
    .classed("is-depth-hidden", (l) => !isLinkInDepth(l))
    .interrupt()
    .style("opacity", (l) => (isLinkInDepth(l) ? 1 : 0))
    .attr("opacity", (l) => (isLinkInDepth(l) ? 1 : 0))
    .attr("stroke-opacity", null);
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
  if (activeHover?.kind === "link" && activeHover.key) {
    const [sourceId, targetId] = activeHover.key.split("→");
    emphasizeNodePair(sourceId, targetId, { duration: 80, raise: false });
    return;
  }
  if (activeHover?.kind === "pair" && activeHover.path?.length >= 2) {
    emphasizeNodePath(activeHover.path, {
      raiseId: activeHover.ids?.[1],
      duration: 80,
      raise: false,
    });
    return;
  }
  if (activeHover?.kind === "pair" && activeHover.ids?.length === 2) {
    const [aId, bId] = activeHover.ids;
    if (activeHover.key || findAnyLinkBetween(aId, bId)) {
      emphasizeNodePair(aId, bId, { duration: 80, raise: false });
      return;
    }
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
    d3.selectAll(".node, .node-label-root").classed("is-event-cast", false);
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
    d3.selectAll(".node, .node-label-root").classed("is-event-cast", false);
    emphasizeNodePair(sourceId, targetId, { duration: 120, raise: true });
    return;
  }
  if (activeNarrativeCast?.size && isNarrativeFriseOpen()) {
    emphasizeNarrativeCast(activeNarrativeCast, { duration: 120 });
    return;
  }
  d3.selectAll(".node, .node-label-root").classed("is-event-cast", false);
  clearGraphEmphasis();
}

function enrichLinkTooltips() {
  const tooltip = d3.select(".tooltip");
  const LONG_PRESS_MS = 420;
  const TOUCH_MOVE_PX = 14;
  let touchTimer = null;
  let touchStart = null;
  let touchLongPressed = false;
  let touchMoved = false;
  let touchSuppressClick = false;

  const clearTouchTimer = () => {
    if (touchTimer) clearTimeout(touchTimer);
    touchTimer = null;
  };

  const openLinkFocus = (event, d) => {
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
            (e.sourceId === ends.sourceId && e.targetId === ends.targetId) ||
            (e.sourceId === ends.targetId && e.targetId === ends.sourceId)
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
    const evidenceHtml = formatRelationEvidenceHtml(lastFocusedLink, reverseLink);
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
  };

  d3.selectAll(".link-hit")
    .on("mouseenter.hover", function (event, d) {
      applyLinkHoverPreview(d, tooltip, event);
    })
    .on("mousemove.hover", function (event, d) {
      if (lastFocusedNode && !lastFocusedLink) return;
      if (!isPinnedLink(d)) return;
      placeTooltipAtPointer(tooltip, event);
    })
    .on("mouseleave.hover", function (event, d) {
      // Character focus: link flyouts are disabled (see applyLinkHoverPreview)
      if (lastFocusedNode && !lastFocusedLink) return;
      if (!isPinnedLink(d) && isSelectionPinned()) return;
      clearHoverPreview(tooltip);
    })
    .on("touchstart.interact", function (event, d) {
      if (event.touches && event.touches.length > 1) {
        if (touchLongPressed) clearHoverPreview(tooltip);
        clearTouchTimer();
        touchStart = null;
        touchLongPressed = false;
        touchMoved = false;
        return;
      }
      if (!isPinnedLink(d)) return;
      const t = event.touches[0];
      touchStart = {
        x: t.clientX,
        y: t.clientY,
        pageX: t.pageX,
        pageY: t.pageY,
        key: `${linkEnds(d).sourceId}→${linkEnds(d).targetId}`,
      };
      touchLongPressed = false;
      touchMoved = false;
      touchSuppressClick = false;
      clearTouchTimer();
      touchTimer = setTimeout(() => {
        if (!touchStart) return;
        touchLongPressed = true;
        touchSuppressClick = true;
        applyLinkHoverPreview(d, tooltip, {
          pageX: touchStart.pageX,
          pageY: touchStart.pageY,
          clientX: touchStart.x,
          clientY: touchStart.y,
          touches: event.touches,
          type: "touchstart",
        });
      }, LONG_PRESS_MS);
    })
    .on("touchmove.interact", function (event) {
      if (!touchStart) return;
      if (event.touches && event.touches.length > 1) {
        if (touchLongPressed) clearHoverPreview(tooltip);
        clearTouchTimer();
        touchStart = null;
        touchLongPressed = false;
        touchMoved = true;
        return;
      }
      const t = event.touches[0];
      if (
        Math.hypot(t.clientX - touchStart.x, t.clientY - touchStart.y) >
        TOUCH_MOVE_PX
      ) {
        touchMoved = true;
        clearTouchTimer();
        if (touchLongPressed) {
          clearHoverPreview(tooltip);
          touchLongPressed = false;
        }
        touchStart = null;
      }
    })
    .on("touchend.interact", function (event, d) {
      clearTouchTimer();
      const wasLong = touchLongPressed;
      const wasTap = Boolean(touchStart) && !touchMoved && !wasLong;
      touchStart = null;
      touchLongPressed = false;
      touchMoved = false;

      if (wasLong) {
        event.preventDefault();
        clearHoverPreview(tooltip);
        touchSuppressClick = true;
        setTimeout(() => {
          touchSuppressClick = false;
        }, 400);
        return;
      }

      if (wasTap) {
        event.preventDefault();
        touchSuppressClick = true;
        setTimeout(() => {
          touchSuppressClick = false;
        }, 400);
        openLinkFocus(event, d);
      }
    })
    .on("touchcancel.interact", function () {
      clearTouchTimer();
      if (touchLongPressed) clearHoverPreview(tooltip);
      touchStart = null;
      touchLongPressed = false;
      touchMoved = false;
    })
    .on("click", function (event, d) {
      if (touchSuppressClick) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      openLinkFocus(event, d);
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
  // FAM QUOT/NOTE are copied onto every edge of that family — show each
  // evidence string once on the sheet instead of under every relative.
  const seenNotes = new Set();
  const seenCitations = new Set();
  const takeFresh = (values, seen) =>
    (values || []).filter((v) => {
      const key = String(v || "")
        .trim()
        .replace(/^["«»']+|["«»']+$/g, "")
        .trim()
        .toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return `<ul class="sheet-rel-list" data-rel-list="blood">${rows
    .map((row) => {
      const otherName = nodeNameById(row.otherId);
      const evidence = formatRelationEvidenceLists(
        takeFresh(row.notes, seenNotes),
        takeFresh(row.citations, seenCitations),
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
    .clickDistance(8)
    .filter((event) => {
      // Touch: pan/pinch + tap/long-press own the gesture (do not steal for node drag)
      if (
        event.type?.startsWith?.("touch") ||
        event.pointerType === "touch" ||
        (event.touches && event.touches.length)
      ) {
        return false;
      }
      return !event.button;
    })
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
        if (isLayeredLayout()) d.targetX = d.x;
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
  pairHoverNeighborId = null;
  focusScope = "depth";
  nucleusKind = "all";
  const id = clickedNode?.id;
  const master =
    (window.allNodes || []).find((n) => n.id === id) || clickedNode;

  lastFocusedNode = master;
  lastFocusedLink = null;

  const rebuilt = prioritizeClickOverFilters();
  if (rebuilt) {
    rebuildCurrentGraph();
  }

  lastFocusedNode = allNodes.find((n) => n.id === id) || master;
  if (!lastFocusedNode) return;

  // Keep any open sheet closed — click explores the graph neighborhood only
  hideCharacterSheet({ refit: false });

  emphasizeFocusedNode(lastFocusedNode.id, {
    raiseId: lastFocusedNode.id,
    duration: 220,
    raise: true,
  });
  // Layered: lanes only; force: optional ring. Never auto-zoom.
  if (!rebuilt) {
    applyFocusNeighborSpread(lastFocusedNode.id, { animate: true });
  }
  syncFocusChip();
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
  // Show nucleus on the graph (chip), not behind an open sheet
  hideCharacterSheet({ refit: false });
  syncFocusChip();
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
  syncSheetNucleusButtons(content);
  syncFocusChip();
}

/** Hide the character sheet without clearing graph focus / nucleus. */
function hideCharacterSheet({ refit = false } = {}) {
  const modal = document.getElementById("modalContainer");
  if (!modal || modal.classList.contains("hidden")) {
    syncFocusChip();
    return;
  }
  modal.classList.add("hidden");
  modal.classList.remove("is-dual");
  document.body.style.overflow = "";
  syncFocusChip();

  // Never rebuild / auto-zoom on close — keep the user's pan/zoom
  if (lastFocusedNode || lastFocusedLink) {
    restorePersistentEmphasis();
  }
}

function clearGraphSelection() {
  cancelHoverRestore();
  clearTimeout(nodeClickTimer);
  nodeClickTimer = null;
  activeHover = null;
  pairHoverNeighborId = null;
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

  syncFocusChip();

  if (modalOpen || hadFocus) {
    restoreFocusNeighborSpread({ animate: true });
    d3.selectAll(".node circle")
      .transition()
      .duration(220)
      .attr("fill", (d) => (d.sex === "M" ? "#2563eb" : "#db2777"));
    if (activeNarrativeCast?.size && isNarrativeFriseOpen()) {
      emphasizeNarrativeCast(activeNarrativeCast, { duration: 220 });
    } else {
      clearGraphEmphasis(220);
    }
  } else if (activeNarrativeCast?.size && isNarrativeFriseOpen()) {
    restoreFocusNeighborSpread({ animate: false });
    emphasizeNarrativeCast(activeNarrativeCast, { duration: 120 });
  } else {
    restoreFocusNeighborSpread({ animate: false });
    clearGraphEmphasis(120);
  }
}

/** Close sheet only — keep focus / nucleus on the graph. */
function closeModal() {
  hideCharacterSheet({ refit: false });
}

function syncFocusChip() {
  const chip = document.getElementById("focusChip");
  const label = document.getElementById("focusChipLabel");
  const meta = document.getElementById("focusChipMeta");
  if (!chip) return;

  const modal = document.getElementById("modalContainer");
  const sheetOpen = modal && !modal.classList.contains("hidden");
  const person = lastFocusedNode;
  // Always show when a person is focused and the sheet is closed (desktop + mobile)
  const show = Boolean(person) && !sheetOpen && !lastFocusedLink;

  chip.classList.toggle("is-hidden", !show);
  if (!show || !person) return;

  const t = window.t || ((k) => k);
  if (label) label.textContent = person.name || "";
  if (meta) {
    meta.textContent =
      focusScope === "nucleus"
        ? t(
            nucleusKind === "parents"
              ? "sheetNucleusParents"
              : nucleusKind === "children"
                ? "sheetNucleusChildren"
                : nucleusKind === "siblings"
                  ? "sheetNucleusSiblings"
                  : "sheetFamilyNucleus"
          )
        : t("focusChipNeighborhood");
  }
}

function bindFocusChip() {
  const chip = document.getElementById("focusChip");
  if (!chip || chip.dataset.bound) return;
  chip.dataset.bound = "1";
  chip.querySelector("[data-focus-reopen]")?.addEventListener("click", () => {
    if (!lastFocusedNode) return;
    showModalContent(lastFocusedNode);
    syncFocusChip();
  });
  chip.querySelector("[data-focus-clear]")?.addEventListener("click", () => {
    clearGraphSelection();
  });
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

  /**
   * Turn a site-root path (`/ged/...`) into a URL relative to this page.
   * Needed on GitHub Pages where the app lives under
   * `/gedcom_character_map_graphs/public/` — a leading `/` would hit the
   * domain root and 404.
   */
  function resolveAppUrl(pathFromSiteRoot) {
    const rel = String(pathFromSiteRoot || "").replace(/^\/+/, "");
    return new URL(rel, document.baseURI).href;
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
      const response = await fetch(resolveAppUrl(file));
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
      // Free the graph after picking a chapter (desktop + mobile)
      setLibraryCollapsed(true);
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
      const listRes = await fetch(resolveAppUrl("/ged"));
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

  function syncLibraryScrim(open) {
    const scrim = document.getElementById("libraryScrim");
    if (!scrim) return;
    const show = Boolean(open) && window.innerWidth <= 900;
    scrim.hidden = !show;
    document.body.classList.toggle("library-drawer-open", show);
  }

  function setLibraryCollapsed(collapsed) {
    const shell = document.getElementById("appShell");
    const library = document.getElementById("library");
    if (!shell) return;
    shell.classList.toggle("library-collapsed", collapsed);
    const mobileOpen = !collapsed && window.innerWidth <= 900;
    library?.classList.toggle("is-mobile-open", mobileOpen);
    syncLibraryScrim(mobileOpen);
    localStorage.setItem("cm_library_collapsed", collapsed ? "1" : "0");
    // Recenter graph after layout change (desktop column change; skip on mobile drawer)
    if (window.innerWidth > 900) {
      requestAnimationFrame(() => {
        if (window.allNodes?.length) rebuildCurrentGraph();
      });
    }
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
    syncFocusChip();
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
    setLibraryCollapsed(false);
  });

  document.getElementById("collapseLibrary")?.addEventListener("click", () => {
    setLibraryCollapsed(true);
  });

  document.getElementById("libraryScrim")?.addEventListener("click", () => {
    setLibraryCollapsed(true);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const library = document.getElementById("library");
    if (library?.classList.contains("is-mobile-open")) {
      setLibraryCollapsed(true);
    }
  });

  function setHelpPopoverOpen(open) {
    const pop = document.getElementById("helpPopover");
    const toggle = document.getElementById("helpToggle");
    if (!pop || !toggle) return;
    pop.classList.toggle("is-hidden", !open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      setFiltersPopoverOpen(false);
      setSettingsPopoverOpen(false);
    }
  }

  function setSettingsPopoverOpen(open) {
    const pop = document.getElementById("settingsPopover");
    const toggle = document.getElementById("settingsToggle");
    if (!pop || !toggle) return;
    pop.classList.toggle("is-hidden", !open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      setFiltersPopoverOpen(false);
      setHelpPopoverOpen(false);
    }
  }

  document.getElementById("helpToggle")?.addEventListener("click", (event) => {
    event.stopPropagation();
    const pop = document.getElementById("helpPopover");
    const open = pop?.classList.contains("is-hidden");
    setHelpPopoverOpen(Boolean(open));
  });
  document.getElementById("helpClose")?.addEventListener("click", () => {
    setHelpPopoverOpen(false);
  });

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
    if (open) {
      setSettingsPopoverOpen(false);
      setHelpPopoverOpen(false);
    }
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
    const helpAnchor = document.querySelector(".help-anchor");
    const helpPop = document.getElementById("helpPopover");
    if (
      helpAnchor &&
      helpPop &&
      !helpPop.classList.contains("is-hidden") &&
      !helpAnchor.contains(event.target)
    ) {
      setHelpPopoverOpen(false);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    setFiltersPopoverOpen(false);
    setSettingsPopoverOpen(false);
    setHelpPopoverOpen(false);
    const narrativePanel = document.getElementById("narrativePanel");
    if (
      narrativePanel &&
      !narrativePanel.classList.contains("is-hidden") &&
      !narrativePanel.classList.contains("is-collapsed")
    ) {
      setNarrativeCollapsed(true);
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

  const narrowViewport = () =>
    window.matchMedia("(max-width: 900px)").matches;

  const legendStored = localStorage.getItem("cm_legend_collapsed");
  setLegendCollapsed(
    legendStored === "1" || (legendStored == null && narrowViewport())
  );
  document.getElementById("legendToggle")?.addEventListener("click", () => {
    const legend = document.getElementById("graphLegend");
    setLegendCollapsed(!legend?.classList.contains("is-collapsed"));
  });

  document.getElementById("zoomInBtn")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    zoomGraphBy(1.35);
  });
  document.getElementById("zoomOutBtn")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    zoomGraphBy(1 / 1.35);
  });

  function setNarrativeCollapsed(collapsed) {
    const panel = document.getElementById("narrativePanel");
    const toggle = document.getElementById("narrativeToggle");
    if (!panel || !toggle) return;
    panel.classList.toggle("is-collapsed", collapsed);
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    localStorage.setItem("cm_narrative_collapsed", collapsed ? "1" : "0");
    if (collapsed) {
      releaseNarrativeFriseHighlight();
    } else {
      syncNarrativeCastFromTime({
        force: !(lastFocusedNode || lastFocusedLink),
      });
    }
  }

  const narrativeStored = localStorage.getItem("cm_narrative_collapsed");
  setNarrativeCollapsed(
    narrativeStored === "1" ||
      (narrativeStored == null && narrowViewport())
  );
  document.getElementById("narrativeToggle")?.addEventListener("click", () => {
    const panel = document.getElementById("narrativePanel");
    setNarrativeCollapsed(!panel?.classList.contains("is-collapsed"));
  });
  document.getElementById("narrativeClose")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setNarrativeCollapsed(true);
  });

  let resizeTimer = null;
  let wasMobileLibrary = window.innerWidth <= 900;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const isMobile = window.innerWidth <= 900;
      if (isMobile !== wasMobileLibrary) {
        wasMobileLibrary = isMobile;
        // Crossing breakpoint: keep drawer closed on phone, restore desktop column logic
        if (isMobile) setLibraryCollapsed(true);
        else {
          const stored = localStorage.getItem("cm_library_collapsed") === "1";
          setLibraryCollapsed(stored);
        }
      } else {
        syncLibraryScrim(
          !document.getElementById("appShell")?.classList.contains(
            "library-collapsed"
          ) && isMobile
        );
      }
      rebuildCurrentGraph();
    }, 180);
  });

  window.setLang(window.getLang());
  window.applyStaticI18n();
  setLayoutMode(getLayoutMode());
  setHorizontalSpread(getHorizontalSpread());
  // Phone: drawer starts closed (toggle opens it). Desktop: respect stored collapse.
  if (window.innerWidth <= 900 || localStorage.getItem("cm_library_collapsed") === "1") {
    setLibraryCollapsed(true);
  } else {
    syncLibraryScrim(false);
  }
  bindFocusChip();
  initLibrary();

  window.loadFile = loadFile;
  window.closeModal = closeModal;
});

// Add these lines at the end of graph.js
window.parseGedcom = parseGedcom;
window.createGraph = createGraph;
window.formatName = formatName;
window.clearGraphSelection = clearGraphSelection;
