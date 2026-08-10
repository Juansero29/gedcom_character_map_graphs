/**
 * Measure under-node label pill overlaps for genealogy + chrono layouts.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const OUT = path.resolve("tmp-graph-analysis");
fs.mkdirSync(OUT, { recursive: true });
const url = process.env.GRAPH_URL || "http://localhost:3000/";

async function load(page, layout) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate((mode) => {
    localStorage.setItem("cm_layout", mode);
    localStorage.setItem("cm_library_collapsed", "1");
    localStorage.setItem("cm_narrative_collapsed", "1");
    localStorage.setItem("cm_h_spread", "2");
  }, layout);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof window.loadFile === "function");
  await page.evaluate(() =>
    window.loadFile("/ged/les-rois-maudits/le-roi-de-fer/up-to-chapter-2.ged", {
      bookTitle: "Le Roi de fer",
      chapterLabel: "Chapitre 2",
      chapterTitle: "Les prisonniers du Temple",
    })
  );
  await page.waitForSelector("#graphContainer svg .node", { timeout: 20000 });
  await page.waitForTimeout(3800);
}

async function measureOverlaps(page) {
  return page.evaluate(() => {
    const labels = [
      ...document.querySelectorAll("#graphContainer svg .node-label-bg"),
    ];
    const boxes = labels.map((el) => {
      const r = el.getBoundingClientRect();
      const name =
        el.parentElement?.querySelector(".node-label")?.textContent || "";
      return {
        name,
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      };
    });
    const overlaps = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const xOverlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const yOverlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (xOverlap > 1 && yOverlap > 1) {
          overlaps.push({
            a: a.name,
            b: b.name,
            xOverlap: Math.round(xOverlap),
            yOverlap: Math.round(yOverlap),
          });
        }
      }
    }
    const xs = boxes.map((b) => b.left);
    const rs = boxes.map((b) => b.right);
    return {
      labelCount: boxes.length,
      overlapCount: overlaps.length,
      overlaps: overlaps.slice(0, 20),
      spanPx:
        boxes.length > 0
          ? Math.round(Math.max(...rs) - Math.min(...xs))
          : 0,
    };
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const report = {};
  for (const layout of ["genealogy", "chrono"]) {
    await load(page, layout);
    report[layout] = await measureOverlaps(page);
    await page.screenshot({
      path: path.join(OUT, `labels-${layout}.png`),
      fullPage: false,
    });
  }
  fs.writeFileSync(
    path.join(OUT, "label-overlaps.json"),
    JSON.stringify(report, null, 2)
  );
  console.log(JSON.stringify(report, null, 2));
  const fail =
    report.genealogy.overlapCount > 0 || report.chrono.overlapCount > 0;
  if (fail) {
    console.error("FAIL: label pills still overlap");
    process.exitCode = 1;
  } else {
    console.log("PASS: no label pill overlaps");
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
