/**
 * Validate graph touch UX at iPhone 17 Pro Max CSS viewport (440×956, DPR 3).
 * Tap → focus; long-press → hover preview; pinch → scale change.
 */
import { chromium, devices } from "playwright";
import fs from "fs";
import path from "path";

const OUT = path.resolve("tmp-graph-analysis");
fs.mkdirSync(OUT, { recursive: true });

const url = process.env.GRAPH_URL || "http://localhost:3000/";

/** iPhone 17 Pro Max logical size (CSS px). */
const IPHONE_17_PRO_MAX = {
  viewport: { width: 440, height: 956 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    devices["iPhone 15 Pro Max"]?.userAgent ||
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
};

async function loadChapter(page) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    localStorage.setItem("cm_layout", "genealogy");
    localStorage.setItem("cm_library_collapsed", "1");
    localStorage.setItem("cm_h_spread", "2");
    localStorage.setItem("cm_narrative_collapsed", "1");
    localStorage.removeItem("cm_graph_filters");
    localStorage.removeItem("cm_link_depth");
    localStorage.removeItem("cm_link_depth_mode");
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof window.loadFile === "function", null, {
    timeout: 15000,
  });
  await page.evaluate(() =>
    window.loadFile("/ged/les-rois-maudits/le-roi-de-fer/up-to-chapter-2.ged", {
      bookTitle: "Le Roi de fer",
      chapterLabel: "Chapitre 2",
      chapterTitle: "Les prisonniers du Temple",
    })
  );
  await page.waitForSelector("#graphContainer svg .node", { timeout: 20000 });
  await page.waitForTimeout(3500);
}

async function nodeScreenPoint(page, namePart, { mustBeOnScreen = true } = {}) {
  return page.evaluate(
    ({ part, mustBeOnScreen }) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const labels = [
        ...document.querySelectorAll("#graphContainer svg .node-label"),
      ];
      const nodes = [
        ...document.querySelectorAll("#graphContainer svg g.node"),
      ];
      const candidates = [];
      for (let idx = 0; idx < nodes.length; idx++) {
        const label = labels[idx]?.textContent || "";
        if (part && !label.toLowerCase().includes(part.toLowerCase())) continue;
        const hit =
          nodes[idx].querySelector("circle.node-hit") ||
          nodes[idx].querySelector("circle");
        const r = hit.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        const onScreen =
          r.width > 0 &&
          x >= 8 &&
          x <= vw - 8 &&
          y >= 40 &&
          y <= vh - 80;
        candidates.push({
          x,
          y,
          hitR: r.width / 2,
          label,
          onScreen,
        });
      }
      if (mustBeOnScreen) {
        return candidates.find((c) => c.onScreen) || null;
      }
      return candidates[0] || null;
    },
    { part: namePart, mustBeOnScreen }
  );
}

async function anyVisibleNode(page) {
  return nodeScreenPoint(page, "", { mustBeOnScreen: true });
}

async function pinchZoom(page, client, cx, cy, startDist, endDist) {
  // CDP touch points are what Chromium/d3-zoom actually consume for pinch
  const half0 = startDist / 2;
  const half1 = endDist / 2;
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: cx - half0, y: cy },
      { x: cx + half0, y: cy },
    ],
  });
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    const h = half0 + ((half1 - half0) * i) / steps;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: cx - h, y: cy },
        { x: cx + h, y: cy },
      ],
    });
    await page.waitForTimeout(20);
  }
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
}

async function zoomScale(page) {
  return page.evaluate(() => {
    const g = document.querySelector("#graphContainer svg .zoom-root");
    if (!g) return null;
    const consolidated = g.transform?.baseVal?.consolidate();
    if (consolidated?.matrix) return consolidated.matrix.a;
    const t = g.getAttribute("transform") || "";
    const m = /scale\(([-0-9.eE+]+)\)/.exec(t);
    return m ? Number(m[1]) : null;
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(IPHONE_17_PRO_MAX);
  const page = await context.newPage();
  const results = {
    viewport: IPHONE_17_PRO_MAX.viewport,
    deviceScaleFactor: IPHONE_17_PRO_MAX.deviceScaleFactor,
    checks: {},
  };

  try {
    await loadChapter(page);

    const touchAction = await page.evaluate(() =>
      getComputedStyle(document.querySelector("#graphContainer svg")).touchAction
    );
    results.checks.touchActionNone = touchAction === "none";

    const hit = await page.evaluate(() => {
      const hitEl = document.querySelector("#graphContainer svg circle.node-hit");
      if (!hitEl) return null;
      return { r: Number(hitEl.getAttribute("r")), exists: true };
    });
    results.checks.nodeHitRadius = hit;
    results.checks.nodeHitFatEnough = hit && hit.r >= 20;

    // --- Tap focuses node + opens sheet ---
    const molay =
      (await nodeScreenPoint(page, "Molay")) || (await anyVisibleNode(page));
    if (!molay) throw new Error("Could not find a visible node to tap");
    results.molay = molay;

    await page.touchscreen.tap(molay.x, molay.y);
    await page.waitForTimeout(600);

    const afterTap = await page.evaluate(() => {
      const modal = document.getElementById("modalContainer");
      const focused = document.querySelector(".node.is-emphasized");
      const tooltip = document.querySelector(".tooltip");
      return {
        modalOpen: modal && !modal.classList.contains("hidden"),
        hasEmphasized: Boolean(focused),
        tooltipVisible:
          tooltip && getComputedStyle(tooltip).display !== "none",
      };
    });
    results.checks.tapFocus = afterTap;

    // Close sheet if open (keep focus)
    await page.evaluate(() => {
      if (typeof window.closeModal === "function") window.closeModal();
    });
    await page.waitForTimeout(200);

    // Clear selection so long-press hover is unpinned
    await page.evaluate(() => window.clearGraphSelection?.());
    await page.waitForTimeout(400);

    // --- Long-press = hover (tooltip + neighborhood), not sticky focus ---
    const target =
      (await nodeScreenPoint(page, "Philippe")) ||
      (await anyVisibleNode(page));
    if (!target) throw new Error("No on-screen node for long-press");
    results.longPressTarget = target;

    // Long-press via CDP (real touch pipeline), inspect mid-hold
    const client = await context.newCDPSession(page);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: target.x, y: target.y }],
    });
    await page.waitForTimeout(500);
    const midHold = await page.evaluate(() => {
      const tooltip = document.querySelector(".tooltip");
      const tipDisplay = tooltip
        ? getComputedStyle(tooltip).display
        : "missing";
      const emphasized = document.querySelectorAll(
        ".node.is-emphasized"
      ).length;
      const modal = document.getElementById("modalContainer");
      const modalOpen = modal && !modal.classList.contains("hidden");
      return {
        tipDuringHold: tipDisplay !== "none",
        emphasizedDuringHold: emphasized > 0,
        modalOpenDuringHold: modalOpen,
        tipText: tooltip?.textContent?.slice(0, 80) || "",
      };
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await page.waitForTimeout(120);
    const afterHold = await page.evaluate(() => {
      const tooltip = document.querySelector(".tooltip");
      const modal = document.getElementById("modalContainer");
      return {
        tipAfterRelease:
          tooltip && getComputedStyle(tooltip).display !== "none",
        modalOpenAfterRelease:
          modal && !modal.classList.contains("hidden"),
      };
    });
    results.checks.longPressHover = { ...midHold, ...afterHold };
    results.checks.longPressIsHoverNotFocus =
      midHold.tipDuringHold &&
      midHold.emphasizedDuringHold &&
      !midHold.modalOpenDuringHold &&
      !afterHold.modalOpenAfterRelease;

    // --- Pinch zoom changes scale ---
    await page.waitForTimeout(400);
    const before = await zoomScale(page);
    const box = await page.evaluate(() => {
      const r = document.querySelector("#graphContainer").getBoundingClientRect();
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    });
    await pinchZoom(page, client, box.cx, box.cy, 80, 180);
    await page.waitForTimeout(400);
    const afterPinchOut = await zoomScale(page);
    await pinchZoom(page, client, box.cx, box.cy, 180, 70);
    await page.waitForTimeout(400);
    const afterPinchIn = await zoomScale(page);
    results.checks.pinch = {
      before,
      afterPinchOut,
      afterPinchIn,
      zoomedOut: afterPinchOut != null && before != null && afterPinchOut > before * 1.05,
      zoomedIn:
        afterPinchIn != null &&
        afterPinchOut != null &&
        afterPinchIn < afterPinchOut * 0.95,
    };

    await page.screenshot({
      path: path.join(OUT, "iphone-17-pro-max.png"),
      fullPage: false,
    });

    const pass =
      results.checks.touchActionNone &&
      results.checks.nodeHitFatEnough &&
      results.checks.tapFocus?.hasEmphasized &&
      results.checks.longPressIsHoverNotFocus &&
      results.checks.pinch?.zoomedOut &&
      results.checks.pinch?.zoomedIn;

    results.pass = Boolean(pass);
    fs.writeFileSync(
      path.join(OUT, "iphone-touch-results.json"),
      JSON.stringify(results, null, 2)
    );
    console.log(JSON.stringify(results, null, 2));
    if (!pass) {
      console.error("FAIL: one or more iPhone touch checks failed");
      process.exitCode = 1;
    } else {
      console.log("PASS: iPhone 17 Pro Max touch interactions OK");
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
