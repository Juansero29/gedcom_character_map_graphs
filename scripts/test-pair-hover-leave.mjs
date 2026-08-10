import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../tmp-graph-analysis");
mkdirSync(outDir, { recursive: true });

function tipState() {
  const tip = document.querySelector(".tooltip");
  const display = tip ? getComputedStyle(tip).display : "none";
  return {
    tipDisplay: tip?.style.display || display,
    tipVisible: display !== "none" && (tip?.style.display || display) !== "none",
    text: (tip?.innerText || "").split("\n")[0].slice(0, 90),
    empN: document.querySelectorAll(".node.is-emphasized").length,
    emp: [...document.querySelectorAll(".node.is-emphasized")]
      .map((n) => n.__data__?.name)
      .slice(0, 6),
  };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:3000/?t=" + Date.now(), {
  waitUntil: "networkidle",
});
await page.evaluate(() => {
  localStorage.setItem("cm_layout", "genealogy");
  localStorage.setItem("cm_library_collapsed", "1");
  localStorage.setItem("cm_narrative_collapsed", "1");
  localStorage.setItem("cm_lang", "fr");
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForFunction(() => typeof window.loadFile === "function");
await page.evaluate(() =>
  window.loadFile("/ged/les-rois-maudits/le-roi-de-fer/up-to-chapter-2.ged", {
    bookTitle: "Le Roi de fer",
    chapterLabel: "Ch.2",
    chapterTitle: "Les prisonniers du Temple",
  })
);
await page.waitForSelector("#graphContainer svg .node");
await page.waitForTimeout(3500);

// Center zoom on Molay so real mouse coords work too
await page.evaluate(() => {
  const svg = document.querySelector("#graphContainer svg");
  const zoomRoot = svg.querySelector(".zoom-root");
  const nodes = [...document.querySelectorAll("g.node")];
  const ego = nodes.find((g) =>
    (g.__data__?.name || "").includes("Jacques de Molay")
  );
  if (!ego || !zoomRoot) return;
  const t = ego.getAttribute("transform") || "";
  const m = /translate\(([-0-9.]+),\s*([-0-9.]+)\)/.exec(t);
  if (!m) return;
  const x = +m[1];
  const y = +m[2];
  const w = svg.clientWidth || 1440;
  const h = svg.clientHeight || 900;
  const k = 0.55;
  const tx = w / 2 - k * x;
  const ty = h / 2 - k * y;
  zoomRoot.setAttribute("transform", `translate(${tx},${ty}) scale(${k})`);
});
await page.waitForTimeout(200);

const ids = await page.evaluate(() => {
  const nodes = [...document.querySelectorAll("g.node")];
  const ego = nodes.find((g) =>
    (g.__data__?.name || "").includes("Jacques de Molay")
  );
  const other =
    nodes.find((g) => (g.__data__?.name || "").includes("Geoffroy de Charnay")) ||
    nodes.find((g) => (g.__data__?.name || "").includes("Nogaret")) ||
    nodes.find((g) => g !== ego);
  return {
    egoId: ego?.__data__?.id,
    otherId: other?.__data__?.id,
    egoName: ego?.__data__?.name,
    otherName: other?.__data__?.name,
  };
});
console.log("targets", ids);

// Click ego via DOM + real mouse on its screen position
const egoBox = await page.evaluate((id) => {
  const g = [...document.querySelectorAll("g.node")].find(
    (n) => n.__data__?.id === id
  );
  const hit = g.querySelector("circle.node-hit") || g.querySelector("circle");
  const r = hit.getBoundingClientRect();
  g.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
  );
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}, ids.egoId);
await page.mouse.click(egoBox.x, egoBox.y);
await page.waitForTimeout(500);
const afterClick = await page.evaluate(tipState);
console.log("after click", afterClick);
await page.screenshot({ path: join(outDir, "pair-hover-1-focus.png") });

const otherBox = await page.evaluate((id) => {
  const g = [...document.querySelectorAll("g.node")].find(
    (n) => n.__data__?.id === id
  );
  const hit = g.querySelector("circle.node-hit") || g.querySelector("circle");
  const r = hit.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}, ids.otherId);

await page.mouse.move(otherBox.x, otherBox.y);
await page.waitForTimeout(350);
// Also dispatch mouseenter in case hit-testing missed
await page.evaluate((id) => {
  const g = [...document.querySelectorAll("g.node")].find(
    (n) => n.__data__?.id === id
  );
  const r = g.getBoundingClientRect();
  g.dispatchEvent(
    new MouseEvent("mouseenter", {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: r.x + r.width / 2,
      clientY: r.y + r.height / 2,
    })
  );
}, ids.otherId);
await page.waitForTimeout(200);
const onOther = await page.evaluate(tipState);
console.log("on other", onOther);
await page.screenshot({ path: join(outDir, "pair-hover-2-on-neighbor.png") });

if (!onOther.tipVisible && onOther.empN !== 2) {
  console.error("FAIL: pair hover did not open");
  await browser.close();
  process.exit(1);
}

// Leave via real mouse to empty chrome / backdrop points
const leavePoints = [
  [otherBox.x + 45, otherBox.y],
  [otherBox.x - 45, otherBox.y],
  [otherBox.x, otherBox.y + 45],
  [120, 120],
  [40, 400],
];
for (const [x, y] of leavePoints) {
  // re-enter neighbor first
  await page.mouse.move(otherBox.x, otherBox.y);
  await page.waitForTimeout(150);
  await page.evaluate((id) => {
    const g = [...document.querySelectorAll("g.node")].find(
      (n) => n.__data__?.id === id
    );
    const r = g.getBoundingClientRect();
    g.dispatchEvent(
      new MouseEvent("mouseenter", {
        bubbles: true,
        view: window,
        clientX: r.x + r.width / 2,
        clientY: r.y + r.height / 2,
      })
    );
  }, ids.otherId);
  await page.waitForTimeout(150);

  await page.mouse.move(x, y, { steps: 8 });
  await page.waitForTimeout(280);
  // Dispatch mouseleave on neighbor to mimic browser when leave is lost
  await page.evaluate((id) => {
    const g = [...document.querySelectorAll("g.node")].find(
      (n) => n.__data__?.id === id
    );
    g?.dispatchEvent(
      new MouseEvent("mouseleave", { bubbles: true, view: window })
    );
  }, ids.otherId);
  // Fire mousemove on svg at leave point (pairGuard)
  await page.evaluate(({ x, y }) => {
    const svg = document.querySelector("#graphContainer svg");
    svg.dispatchEvent(
      new MouseEvent("mousemove", {
        bubbles: true,
        view: window,
        clientX: x,
        clientY: y,
      })
    );
  }, { x, y });
  await page.waitForTimeout(200);

  const s = await page.evaluate(tipState);
  const under = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.getAttribute?.("class"),
    { x, y }
  );
  console.log(`leave→${Math.round(x)},${Math.round(y)} under=${under}`, s);
  if (s.tipVisible) {
    console.error("FAIL: tooltip still visible");
    await page.screenshot({ path: join(outDir, "pair-hover-FAIL.png") });
    await browser.close();
    process.exit(1);
  }
  // Focus neighborhood should be back (more than the pair)
  if (s.empN <= 2) {
    console.error("FAIL: focus neighborhood not restored, empN=", s.empN);
    await page.screenshot({ path: join(outDir, "pair-hover-FAIL-emp.png") });
    await browser.close();
    process.exit(1);
  }
}

await page.screenshot({ path: join(outDir, "pair-hover-3-after-leave.png") });
console.log("OK: flyout clears + focus restored");
await browser.close();
