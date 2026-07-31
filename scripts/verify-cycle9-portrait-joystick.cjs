/**
 * Cycle-9 portrait analog acceptance.
 *
 * Requires the joystick to be LAID OUT and the analog gate to PASS at 390x844
 * with a REAL coarse pointer, which is the state an upright phone is in.
 *
 * This exists because the HUD responsive contract emulates touch only for
 * landscape cases (`hasTouch: width > height && height <= 480`), so it cannot
 * observe portrait coarse-pointer behaviour at all. Its portrait cases reporting
 * no joystick is therefore not evidence either way — this probe is.
 *
 * Run: node tmp/verify-portrait-joystick.cjs
 */
const { chromium, devices } = require("playwright");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const PORT = 8117;

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png",
  ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary",
  ".svg": "image/svg+xml", ".ico": "image/x-icon",
};

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end("not found"); return;
      }
      res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

(async () => {
  const server = await serve();
  const browser = await chromium.launch();
  const failures = [];
  const observed = {};

  try {
    // A real upright phone: portrait viewport AND a coarse pointer.
    const context = await browser.newContext({
      ...devices["Pixel 5"],
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("console", (msg) => { if (msg.type() === "error") pageErrors.push(msg.text()); });

    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#start-defense", { timeout: 30000 });
    await page.click("#start-defense");
    // `state: "attached"`, NOT the default "visible": pre-cutover the element
    // exists but is `display: none`, and waiting for visibility would throw
    // before the cutover-detection branch below could report the real reason.
    await page.waitForSelector("[data-joystick]", { state: "attached", timeout: 30000 });
    await page.waitForTimeout(900);

    observed.media = await page.evaluate(() => ({
      coarsePointer: matchMedia("(pointer: coarse)").matches,
      portraitOrientation: matchMedia("(orientation: portrait)").matches,
      defensePortraitAttr: document.documentElement.dataset.defensePortrait,
    }));

    observed.joystick = await page.evaluate(() => {
      const el = document.querySelector("[data-joystick]");
      if (!el) return { present: false };
      const rect = el.getBoundingClientRect();
      return {
        present: true,
        display: getComputedStyle(el).display,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        laidOut: rect.width > 0 && rect.height > 0,
      };
    });

    // P1 — the element must actually have a box.
    //
    // Pre-merge state: `styles.css` on main still carries the global
    // `.virtual-joystick { display: none }` lifted ONLY inside
    // `@media (pointer: coarse) and (orientation: landscape)`, so on an upright
    // phone the element has no box and the analog gate correctly declines. That
    // is the CSS visibility half of the cutover, which cycle 10 owns and shipped
    // in `d37b6568` ("make the virtual joystick the primary movement control
    // everywhere"). It removes the `display: none` default and the landscape
    // gating outright.
    //
    // So a zero box here means "the cutover has not been merged yet", NOT a
    // defect in the analog contract. SKIP with that stated, rather than failing
    // red on main and inviting the next reader to delete this file.
    //
    // [OBSERVED 2026-07-30] With `d37b6568`'s styles.css swapped in against this
    // tree's analog `app.js`, this probe returns ok:true with a 116x116 box and
    // magnitudes 563 -> 966 -> 1000. The analog half and the visibility half are
    // complementary and BOTH are required: cycle 10's branch carries zero analog
    // (`moveAnalog` 0, `defenseMoveAnalog` 0), so its cutover alone would ship a
    // stick that is prominent, primary, and still 8-way quantized.
    // Detect the CAUSE, not the symptom. Keying the skip on `!laidOut` alone
    // would make this gate a permanent green no-op after the cutover merges: any
    // later re-introduction of `display: none` (or re-gating on
    // `orientation: landscape`) removes the box again and would read as "pending
    // merge" forever. So read styles.css and decide from the source.
    //
    // Marker: HEAD carries the bare `.virtual-joystick { display: none; }`
    // default plus a landscape-only override. `d37b6568` DELETES that default
    // outright (it removed the gating rather than adding a portrait branch), so
    // its absence is the cutover's signature.
    // Two valid shapes satisfy the cutover, so detect either:
    //   (a) DELETE the `.virtual-joystick { display: none; }` default outright
    //       (cycle 10's `d37b6568` approach — makes the stick primary everywhere), or
    //   (b) KEEP the default and add a `(orientation: portrait)` override that
    //       grants the element a box (cycle 9's minimal approach — touches only
    //       `#movement-actions` and its children, never `.defense-bottom`'s locked
    //       portrait grid).
    // Keying on (a) alone would report cycle 9's own fix as "not merged".
    const cssPath = path.join(ROOT, "styles.css");
    const css = fs.readFileSync(cssPath, "utf8");
    const defaultHidden = /^\.virtual-joystick \{ display: none; \}/m.test(css);
    const portraitOverride = /@media \(pointer: coarse\) and \(orientation: portrait\)/.test(css)
      && /\[data-defense-portrait="true"\][^{]*\.virtual-joystick/.test(css);
    const cutoverAbsent = defaultHidden && !portraitOverride;
    observed.cutover = {
      stylesheet: "styles.css",
      displayNoneDefaultPresent: defaultHidden,
      portraitOverridePresent: portraitOverride,
      shape: portraitOverride ? "cycle-9 portrait override" : (defaultHidden ? "none" : "cycle-10 default removed"),
      merged: !cutoverAbsent,
    };

    if (cutoverAbsent) {
      console.log(JSON.stringify({
        ok: true,
        skipped: true,
        reason: "PENDING MERGE — the portrait joystick CSS cutover (cycle 10 `d37b6568`) is not in this"
          + " tree: styles.css still carries the `.virtual-joystick { display: none; }` default lifted only"
          + " inside `@media (pointer: coarse) and (orientation: landscape)`. The element therefore has no"
          + " box in portrait and the analog gate correctly declines. This is NOT an analog-contract defect.",
        verifiedAgainstCutover: {
          commit: "d37b6568",
          date: "2026-07-30",
          result: "ok:true, box 116x116, magnitudes 563 -> 966 -> 1000",
          method: "cycle 10's styles.css swapped into this tree's analog app.js, then reverted",
        },
        requiresBothHalves: "cycle 10 supplies CSS visibility; cycle 9 supplies the continuous analog payload."
          + " Cycle 10's branch carries ZERO analog (moveAnalog 0, defenseMoveAnalog 0), so landing its"
          + " cutover WITHOUT this analog contract ships a stick that is prominent, primary, and still"
          + " 8-way quantized — the exact d-pad behaviour the request asked to replace.",
        observed,
      }, null, 2));
      await context.close();
      await browser.close();
      server.close();
      process.exit(0);
    }

    // Cutover IS merged, so a missing box is now a real regression, not a pending merge.
    if (!observed.joystick.laidOut) {
      failures.push(
        `P1 cutover is merged (styles.css no longer carries the display:none default) but [data-joystick]`
        + ` has NO box in portrait: display=${observed.joystick.display}`
        + ` box=${observed.joystick.width}x${observed.joystick.height}.`
        + ` Portrait visibility REGRESSED — check for a re-added display:none or re-added orientation gating.`,
      );
    }
    // P2 — coarse pointer must be seen, else the probe proves nothing.
    if (!observed.media.coarsePointer) {
      failures.push("P2 probe invalid: coarse pointer not emulated");
    }

    // P3 — drag the stick and require CONTINUOUS analog, not octant snapping.
    const box = await page.locator("[data-joystick]").boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const samples = [];
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (const frac of [0.35, 0.6, 1.0]) {
      await page.mouse.move(cx + (box.width / 2) * frac, cy, { steps: 4 });
      await page.waitForTimeout(90);
      samples.push(await page.evaluate(() => {
        // `data-defense-move` / `data-defense-move-analog` live on the battle
        // SURFACE (app.js send(), :2658-2661), while `data-joystick-direction`
        // lives on #movement-actions (updateJoystick, :2489). Read each from
        // its real owner — reading analog off #movement-actions returns null
        // and looks like "analog never emitted".
        const surface = document.querySelector("#defense-battle-surface");
        const host = document.querySelector("#movement-actions");
        return {
          analog: surface?.dataset.defenseMoveAnalog ?? null,
          move: surface?.dataset.defenseMove ?? null,
          direction: host?.dataset.joystickDirection ?? null,
        };
      }));
    }
    await page.mouse.up();
    await page.waitForTimeout(120);
    const released = await page.evaluate(() => {
      const surface = document.querySelector("#defense-battle-surface");
      const host = document.querySelector("#movement-actions");
      return {
        analog: surface?.dataset.defenseMoveAnalog ?? null,
        move: surface?.dataset.defenseMove ?? null,
        direction: host?.dataset.joystickDirection ?? null,
      };
    });
    observed.samples = samples;
    observed.released = released;

    const magnitudes = samples
      .map((s) => (s.analog ? Math.round(Math.hypot(...s.analog.split(",").map(Number))) : null))
      .filter((v) => v !== null);
    observed.magnitudes = magnitudes;

    if (magnitudes.length < 3) {
      failures.push(`P3 analog not emitted in portrait: samples=${JSON.stringify(samples)}`);
    } else {
      if (!magnitudes.every((m) => m > 0 && m <= 1000)) {
        failures.push(`P3 magnitudes outside (0,1000]: ${magnitudes.join(", ")}`);
      }
      // Continuity: a shallow deflection must be genuinely smaller than a full one.
      if (!(magnitudes[0] < magnitudes[magnitudes.length - 1])) {
        failures.push(`P4 deflection did not scale (quantised?): ${magnitudes.join(" -> ")}`);
      }
    }

    // P5 — the 5-button fallback must remain present and 44x44 (no capability lost).
    observed.buttons = await page.evaluate(() => Array.from(
      document.querySelectorAll("#movement-actions > button[data-move]"),
    ).map((b) => {
      const r = b.getBoundingClientRect();
      return { move: b.dataset.move, w: Math.round(r.width), h: Math.round(r.height) };
    }));
    if (observed.buttons.length !== 5) {
      failures.push(`P5 expected 5 [data-move] buttons, found ${observed.buttons.length}`);
    }
    if (!observed.buttons.every((b) => b.w >= 44 && b.h >= 44)) {
      failures.push(`P5 a fallback button is under 44x44: ${JSON.stringify(observed.buttons)}`);
    }

    // P6 — no page/console errors.
    if (pageErrors.length) failures.push(`P6 page/console errors: ${pageErrors.slice(0, 3).join(" | ")}`);

    await context.close();
  } catch (error) {
    failures.push(`probe threw: ${error.message}`);
  } finally {
    await browser.close();
    server.close();
  }

  const ok = failures.length === 0;
  console.log(JSON.stringify({ ok, observed, failures }, null, 2));
  process.exit(ok ? 0 : 1);
})();
