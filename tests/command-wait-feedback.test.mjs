import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { translate, translations } from "../i18n.js";

function appFunction(source, name, nextName) {
  const definition = source.match(
    new RegExp(`(?:async\\s+)?function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}(?=\\s*(?:async\\s+)?function ${nextName}\\()`),
  );
  assert.ok(definition, `app runtime must expose ${name}`);
  return definition[0];
}

async function loadTranslateRejectionReason() {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const definition = appFunction(source, "translateRejectionReason", "showTacticalFeedback");
  const context = vm.createContext({
    currentLang: () => "ko",
    translate,
  });
  vm.runInContext(`${definition}\nglobalThis.translateRejectionReason = translateRejectionReason;`, context, {
    filename: "app.js",
  });
  return (msg, lang) => context.translateRejectionReason(msg, lang);
}

const RAW_QUEUE_WAIT_CODES = ["cooldown", "acknowledging", "boss-not-exposed", "waiting-renderer", "timeout-fallback"];

test("translateRejectionReason resolves every queue-wait reason code to human copy in ko and en", async () => {
  const translateRejectionReason = await loadTranslateRejectionReason();

  for (const lang of ["ko", "en"]) {
    for (const code of RAW_QUEUE_WAIT_CODES) {
      const resolved = translateRejectionReason(code, lang);
      assert.notEqual(resolved, code, `${lang}/${code} must not leak the raw token`);
      assert.ok(resolved.length > code.length, `${lang}/${code} must resolve to real copy, got: ${resolved}`);
    }
  }
});

test("waiting-renderer and timeout-fallback share the same renderer-wait copy", async () => {
  const translateRejectionReason = await loadTranslateRejectionReason();
  assert.equal(translateRejectionReason("waiting-renderer", "ko"), translateRejectionReason("timeout-fallback", "ko"));
  assert.equal(translateRejectionReason("waiting-renderer", "en"), translateRejectionReason("timeout-fallback", "en"));
});

test("i18n.js carries the four tactical.rejection queue-wait keys for both locales (read-only reference)", () => {
  const keys = [
    "tactical.rejection.cooldown",
    "tactical.rejection.acknowledging",
    "tactical.rejection.bossNotExposed",
    "tactical.rejection.waitingRenderer",
  ];
  for (const lang of ["ko", "en"]) {
    for (const key of keys) {
      const value = translations[lang]?.[key];
      assert.ok(typeof value === "string" && value.length > 0, `${lang}/${key} must exist in i18n.js`);
    }
  }
});

test("app.js source contract: translateRejectionReason branches on all five queue-wait codes", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const body = appFunction(source, "translateRejectionReason", "showTacticalFeedback");

  assert.match(body, /msg === "cooldown"/);
  assert.match(body, /msg === "acknowledging"/);
  assert.match(body, /msg === "boss-not-exposed"/);
  assert.match(body, /msg === "waiting-renderer" \|\| msg === "timeout-fallback"/);
});

test("app.js source contract: drainCommandQueue fires a one-shot boss-not-exposed toast on reason transition", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const body = appFunction(source, "drainCommandQueue", "scheduleQueueCheck");

  assert.match(body, /check\.reason === "boss-not-exposed" && previousReason !== "boss-not-exposed"/);
  assert.match(body, /showTacticalFeedback\(translate\("tactical\.rejection\.bossNotExposed"\)/);
});
