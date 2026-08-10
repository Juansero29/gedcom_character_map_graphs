import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const OUT = path.resolve("tmp-graph-analysis");
fs.mkdirSync(OUT, { recursive: true });

const url = process.env.GRAPH_URL || "http://localhost:3000/";

async function loadChapter(page, layout) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate((mode) => {
    localStorage.setItem("cm_layout", mode);
    localStorage.setItem("cm_library_collapsed", "0");
    localStorage.setItem("cm_h_spread", "2");
    localStorage.setItem("cm_narrative_collapsed", "1");
    localStorage.removeItem("cm_graph_filters");
    localStorage.removeItem("cm_link_depth");
    localStorage.removeItem("cm_link_depth_mode");
  }, layout);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof window.loadFile === "function", null, {
    timeout: 15000,
  });
  await page.evaluate(() =>
    window.loadFile("/ged/les-rois-maudits/le-roi-de-fer/up-to-chapter-1.ged", {
      bookTitle: "Le Roi de fer",
      chapterLabel: "Prologue & chapitre 1",
      chapterTitle: "La reine sans amour",
    })
  );
  await page.waitForSelector("#graphContainer svg .node", { timeout: 20000 });
  await page.waitForTimeout(3200);
}

async function pageMetrics(page) {
  return page.evaluate(() => {
    const nodes = [];
    document.querySelectorAll("#graphContainer svg g.node").forEach((g, i) => {
      const t = g.getAttribute("transform") || "";
      const m = /translate\(([-0-9.]+),\s*([-0-9.]+)\)/.exec(t);
      const label =
        document.querySelectorAll("#graphContainer svg .node-label")[i]
          ?.textContent || "";
      if (m) nodes.push({ x: +m[1], y: +m[2], label, id: g.__data__?.id });
    });

    function segsFromPath(d) {
      const nums = [...String(d).matchAll(/(-?\d*\.?\d+(?:e[-+]?\d+)?)/gi)].map(
        Number
      );
      const segs = [];
      for (let i = 0; i + 3 < nums.length; i += 2) {
        const seg = {
          x1: nums[i],
          y1: nums[i + 1],
          x2: nums[i + 2],
          y2: nums[i + 3],
        };
        if (Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1) > 1) segs.push(seg);
      }
      return segs;
    }
    function intersects(p1, p2, q1, q2) {
      const cross = (a, b, c) =>
        (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      const d1 = cross(p1, p2, q1);
      const d2 = cross(p1, p2, q2);
      const d3 = cross(q1, q2, p1);
      const d4 = cross(q1, q2, p2);
      return (
        ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
      );
    }

    const famPaths = [];
    let visibleFamily = 0;
    let visibleAssoc = 0;
    let hiddenAssoc = 0;
    document.querySelectorAll("#graphContainer svg path.link").forEach((p) => {
      const cls = p.getAttribute("class") || "";
      const op = parseFloat(p.style.opacity || p.getAttribute("opacity") || "1");
      const visible = op > 0.05 && !cls.includes("is-depth-hidden");
      if (cls.includes("family")) {
        if (visible) {
          visibleFamily += 1;
          famPaths.push(p.getAttribute("d") || "");
        }
      } else if (cls.includes("association")) {
        if (visible) visibleAssoc += 1;
        else hiddenAssoc += 1;
      }
    });

    const allSegs = famPaths.flatMap(segsFromPath);
    let crossings = 0;
    for (let i = 0; i < allSegs.length; i++) {
      for (let j = i + 1; j < allSegs.length; j++) {
        const a = allSegs[i];
        const b = allSegs[j];
        const share =
          Math.hypot(a.x1 - b.x1, a.y1 - b.y1) < 0.5 ||
          Math.hypot(a.x1 - b.x2, a.y1 - b.y2) < 0.5 ||
          Math.hypot(a.x2 - b.x1, a.y2 - b.y1) < 0.5 ||
          Math.hypot(a.x2 - b.x2, a.y2 - b.y2) < 0.5;
        if (share) continue;
        if (
          intersects(
            { x: a.x1, y: a.y1 },
            { x: a.x2, y: a.y2 },
            { x: b.x1, y: b.y1 },
            { x: b.x2, y: b.y2 }
          )
        )
          crossings += 1;
      }
    }

    let minDist = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dist = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
        if (dist < minDist) minDist = dist;
      }
    }

    const xs = nodes.map((n) => n.x);
    const linkKind =
      document.querySelector('input[name="filterLinkKind"]:checked')?.value ||
      null;

    return {
      nodeCount: nodes.length,
      visibleFamily,
      visibleAssoc,
      hiddenAssoc,
      familyEdgeCrossings: crossings,
      minNodeDist: minDist === Infinity ? null : +minDist.toFixed(1),
      xSpan: xs.length ? +(Math.max(...xs) - Math.min(...xs)).toFixed(1) : 0,
      filterLinkKind: linkKind,
      sample: nodes.slice(0, 6).map(({ x, y, label }) => ({ x, y, label })),
    };
  });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});

const report = {};

// --- Genealogy baseline ---
await loadChapter(page, "genealogy");
report.genealogy = await pageMetrics(page);
await page.locator("#graphContainer").screenshot({
  path: path.join(OUT, "graph-genealogy.png"),
});

// Click a node that has ASSO (Philippe IV) and check ASSO appear
const focusResult = await page.evaluate(() => {
  const nodes = window.allNodes || [];
  const links = window.allLinks || [];
  const withAsso = nodes.find((n) =>
    links.some((l) => {
      if (l.type === "family") return false;
      const s = typeof l.source === "object" ? l.source.id : l.source;
      const t = typeof l.target === "object" ? l.target.id : l.target;
      return s === n.id || t === n.id;
    })
  );
  if (!withAsso) return { ok: false, reason: "no node with ASSO" };
  const g = [...document.querySelectorAll("#graphContainer svg g.node")].find(
    (el) => el.__data__?.id === withAsso.id
  );
  if (!g) return { ok: false, reason: "node el missing", id: withAsso.id };
  g.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  return { ok: true, id: withAsso.id, name: withAsso.name };
});
await page.waitForTimeout(600);
const afterFocus = await pageMetrics(page);
report.genealogyFocus = { click: focusResult, ...afterFocus };
await page.locator("#graphContainer").screenshot({
  path: path.join(OUT, "graph-genealogy-focus.png"),
});

// --- Chrono ---
await loadChapter(page, "chrono");
report.chrono = await pageMetrics(page);
await page.locator("#graphContainer").screenshot({
  path: path.join(OUT, "graph-chrono.png"),
});
await page.screenshot({
  path: path.join(OUT, "graph-chrono-desktop.png"),
  fullPage: false,
});

// Clear focus path: reload chrono and ensure ASSO hidden by default
report.checks = {
  defaultBloodFilter:
    report.genealogy.filterLinkKind === "blood" &&
    report.chrono.filterLinkKind === "blood",
  assoHiddenByDefault:
    report.genealogy.visibleAssoc === 0 && report.chrono.visibleAssoc === 0,
  assoShownOnFocus: report.genealogyFocus.visibleAssoc > 0,
  familyVisible:
    report.genealogy.visibleFamily > 0 && report.chrono.visibleFamily > 0,
  chronoNoCrossings: report.chrono.familyEdgeCrossings === 0,
  genealogyNoCrossings: report.genealogy.familyEdgeCrossings === 0,
  chronoHasSpacing: report.chrono.xSpan > 1200,
};

fs.writeFileSync(path.join(OUT, "metrics.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log("Wrote screenshots to", OUT);
await browser.close();

const failed = Object.entries(report.checks).filter(([, v]) => !v);
if (failed.length) {
  console.error("FAILED checks:", failed.map(([k]) => k).join(", "));
  process.exit(1);
}
console.log("All checks passed.");
