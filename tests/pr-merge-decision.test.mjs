import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DEFAULT_OPT_IN_LABEL,
  decideMerge,
  renderComment,
} from "../scripts/pr-merge-decision.mjs";

// `main` has NO branch protection on this repo (the protection API 404s), so
// there is no server-side gate behind these rules. A false `apply: true` merges
// unreviewed code straight into main. Every test below exists to make one
// specific way of producing that false positive impossible.

const PR_NUMBER = 4242;

// The single green payload every blocker test starts from: base main, not a
// draft, opted in, cleanly mergeable, one passing gate. Each test flips exactly
// one field via `overrides`, so a failure names the rule that broke.
function payload({ gates, optInLabel, ...pr } = {}) {
  return {
    pr: {
      number: PR_NUMBER,
      baseRefName: "main",
      isDraft: false,
      labels: [{ name: DEFAULT_OPT_IN_LABEL }],
      reviewDecision: "APPROVED",
      mergeable: "MERGEABLE",
      mergeStateStatus: "CLEAN",
      ...pr,
    },
    ...(gates === undefined ? { gates: [{ gate: "validate", status: "passed" }] } : { gates }),
    ...(optInLabel === undefined ? {} : { optInLabel }),
  };
}

// `apply` is the field the workflow branches on and `reasons` is what it shows
// a human. They must never disagree: a verdict that holds while reporting no
// blocker (or applies while reporting one) is incoherent either way round.
function decide(input) {
  const decision = decideMerge(input);
  assert.equal(
    decision.apply,
    decision.reasons.length === 0,
    `apply must be exactly "no reasons", got apply=${decision.apply} reasons=${JSON.stringify(decision.reasons)}`,
  );
  return decision;
}

// Asserts the flip produced a hold, that it produced *only* the intended hold
// (so a rule cannot pass by accidentally tripping a neighbouring one), and that
// the surfaced reason actually identifies the offending field.
function assertSoleBlocker(decision, fragments) {
  assert.equal(decision.apply, false);
  assert.deepEqual(
    decision.reasons.length,
    1,
    `expected exactly one blocker, got ${JSON.stringify(decision.reasons)}`,
  );
  const reason = decision.reasons[0].toLowerCase();
  for (const fragment of fragments) {
    assert.ok(
      reason.includes(fragment.toLowerCase()),
      `blocker ${JSON.stringify(decision.reasons[0])} does not identify ${JSON.stringify(fragment)}`,
    );
  }
}

test("a fully green PR is the only shape that unlocks a merge", () => {
  const decision = decide(payload());

  assert.equal(decision.apply, true);
  assert.deepEqual(decision.reasons, []);
  // The workflow merges whatever `pr` says; it must be the number we were asked
  // about, never a neighbouring PR.
  assert.equal(decision.pr, PR_NUMBER);
});

// One blocker at a time. Each row starts from the green payload above and flips
// a single field; if the corresponding check is deleted from the implementation
// the row's `apply === false` assertion fails.
const BLOCKERS = [
  {
    name: "a PR targeting a branch other than main",
    overrides: { baseRefName: "release/1.0" },
    fragments: ["release/1.0", "main"],
  },
  {
    name: "a draft PR",
    overrides: { isDraft: true },
    fragments: ["draft"],
  },
  {
    name: "a PR that never opted in",
    overrides: { labels: [{ name: "bug" }, { name: "priority" }] },
    fragments: [DEFAULT_OPT_IN_LABEL],
  },
  {
    name: "a PR with no labels at all",
    overrides: { labels: [] },
    fragments: [DEFAULT_OPT_IN_LABEL],
  },
  {
    name: "a PR with the labels field absent entirely",
    overrides: { labels: undefined },
    fragments: [DEFAULT_OPT_IN_LABEL],
  },
  {
    name: "a reviewer requesting changes",
    overrides: { reviewDecision: "CHANGES_REQUESTED" },
    fragments: ["changes"],
  },
  {
    name: "a conflicting merge",
    overrides: { mergeable: "CONFLICTING" },
    fragments: ["mergeable=CONFLICTING"],
  },
  {
    // The mergeability probe has not finished. Merging here would merge a state
    // nobody has verified, so the race must hold rather than optimistically pass.
    name: "an unfinished mergeability probe",
    overrides: { mergeable: "UNKNOWN" },
    fragments: ["mergeable=UNKNOWN"],
  },
  {
    name: "mergeable missing from the payload",
    overrides: { mergeable: undefined },
    fragments: ["mergeable=UNKNOWN"],
  },
  {
    name: "a dirty merge state (conflicts)",
    overrides: { mergeStateStatus: "DIRTY" },
    fragments: ["mergeStateStatus=DIRTY"],
  },
  {
    name: "a blocked merge state (failing required checks)",
    overrides: { mergeStateStatus: "BLOCKED" },
    fragments: ["mergeStateStatus=BLOCKED"],
  },
  {
    // Distinct from `isDraft`: GitHub can report a DRAFT merge state while the
    // draft flag has not propagated, and that must hold on its own.
    name: "a draft merge state even when isDraft is false",
    overrides: { mergeStateStatus: "DRAFT" },
    fragments: ["mergeStateStatus=DRAFT"],
  },
  {
    name: "an unknown merge state",
    overrides: { mergeStateStatus: "UNKNOWN" },
    fragments: ["mergeStateStatus=UNKNOWN"],
  },
  {
    // No gates reported means validation never ran. Silence is not success.
    name: "no validation gates reported",
    overrides: { gates: [] },
    fragments: ["gates"],
  },
  {
    name: "a failing validation gate",
    overrides: { gates: [{ gate: "validate", status: "failed" }] },
    fragments: ["failed gates", "validate"],
  },
  {
    // "not passed" must mean not passed. A gate that was skipped, cancelled or
    // never reported is not a pass, and treating only "failed" as fatal would
    // let a skipped gate through.
    name: "a skipped validation gate",
    overrides: { gates: [{ gate: "browser-smoke", status: "skipped" }] },
    fragments: ["failed gates", "browser-smoke"],
  },
  {
    name: "a gate with no status at all",
    overrides: { gates: [{ gate: "browser-smoke" }] },
    fragments: ["failed gates", "browser-smoke"],
  },
  {
    // One green gate does not vouch for a red sibling.
    name: "one failing gate among passing ones",
    overrides: {
      gates: [
        { gate: "unit", status: "passed" },
        { gate: "browser-smoke", status: "failed" },
        { gate: "lint", status: "passed" },
      ],
    },
    fragments: ["failed gates", "browser-smoke"],
  },
  {
    // A non-array `gates` is an unrecognised shape; it must degrade to "nothing
    // reported" rather than being read as "nothing failed".
    name: "a gates field that is not an array",
    overrides: { gates: "everything passed, honest" },
    fragments: ["gates"],
  },
  {
    name: "a gates field that is absent",
    overrides: { gates: null },
    fragments: ["gates"],
  },
];

for (const { name, overrides, fragments } of BLOCKERS) {
  test(`holds on ${name}`, () => {
    assertSoleBlocker(decide(payload(overrides)), fragments);
  });
}

test("BEHIND is deliberately not a blocker", () => {
  // Validation ran against the merge result, so a stale base is resolved by the
  // merge commit itself. Pinned because "hardening" this into a blocker would
  // silently deadlock every PR on a moving main.
  const decision = decide(payload({ mergeStateStatus: "BEHIND" }));

  assert.equal(decision.apply, true);
  assert.deepEqual(decision.reasons, []);
});

test("only CHANGES_REQUESTED blocks; an unreviewed PR still merges on the label", () => {
  // Deliberate: with no branch protection the opt-in label *is* the human gate.
  // Pinned so the distinction stays a decision rather than an accident.
  for (const reviewDecision of ["APPROVED", "REVIEW_REQUIRED", null, undefined]) {
    const decision = decide(payload({ reviewDecision }));
    assert.equal(decision.apply, true, `reviewDecision=${reviewDecision} should not hold`);
  }

  assert.equal(decide(payload({ reviewDecision: "CHANGES_REQUESTED" })).apply, false);
});

test("the opt-in label is recognised as an object or a bare string", () => {
  // gh's REST and GraphQL shapes differ; both must satisfy the same opt-in.
  assert.equal(decide(payload({ labels: [{ name: DEFAULT_OPT_IN_LABEL }] })).apply, true);
  assert.equal(decide(payload({ labels: [DEFAULT_OPT_IN_LABEL] })).apply, true);
  assert.equal(
    decide(payload({ labels: ["bug", null, { name: DEFAULT_OPT_IN_LABEL }, {}] })).apply,
    true,
  );
});

test("a near-miss label does not unlock the merge", () => {
  for (const labels of [["auto-merge-later"], ["automerge"], ["Auto-Merge"], [{ name: "" }]]) {
    assertSoleBlocker(decide(payload({ labels })), [DEFAULT_OPT_IN_LABEL]);
  }
});

test("a custom optInLabel replaces the default rather than widening it", () => {
  const optInLabel = "ship-it";

  assert.equal(decide(payload({ labels: [{ name: optInLabel }], optInLabel })).apply, true);
  // The critical half: the default must stop working once overridden, or every
  // repo-specific gate would also honour a label its owners never chose.
  assertSoleBlocker(
    decide(payload({ labels: [{ name: DEFAULT_OPT_IN_LABEL }], optInLabel })),
    [optInLabel],
  );
});

test("every simultaneous blocker is reported, not just the first", () => {
  // A human fixing one blocker must not discover the next one only on the next
  // scheduled run.
  const decision = decide(payload({
    baseRefName: "develop",
    isDraft: true,
    labels: [],
    reviewDecision: "CHANGES_REQUESTED",
    mergeable: "CONFLICTING",
    mergeStateStatus: "DIRTY",
    gates: [{ gate: "validate", status: "failed" }],
  }));

  assert.equal(decision.apply, false);
  const reasons = decision.reasons.join("\n").toLowerCase();
  for (const fragment of [
    "develop",
    "draft",
    DEFAULT_OPT_IN_LABEL,
    "changes",
    "mergeable=conflicting",
    "mergestatestatus=dirty",
    "failed gates: validate",
  ]) {
    assert.ok(reasons.includes(fragment), `missing blocker for ${JSON.stringify(fragment)}`);
  }
});

test("malformed payloads fail closed instead of throwing", () => {
  // These arrive from `JSON.parse` of whatever the workflow assembled. A throw
  // is survivable, but a silent `apply: true` is not; assert both.
  const malformed = [
    ["null", null],
    ["undefined", undefined],
    ["an empty object", {}],
    ["a pr-less payload", { gates: [{ gate: "validate", status: "passed" }] }],
    ["a null pr", { pr: null, gates: [{ gate: "validate", status: "passed" }] }],
    ["a numeric-string pr number", payload({ number: String(PR_NUMBER) })],
    ["a missing pr number", payload({ number: undefined })],
    ["an array payload", []],
    ["a string payload", "merge it"],
  ];

  for (const [label, input] of malformed) {
    let decision;
    assert.doesNotThrow(() => { decision = decide(input); }, `${label} threw`);
    assert.equal(decision.apply, false, `${label} unlocked a merge`);
    assert.ok(decision.reasons.length > 0, `${label} held without explaining why`);
  }
});

test("a payload with no PR number identifies no PR to merge", () => {
  // `pr` is what the caller would hand to `gh pr merge`; it must be null, not a
  // stale or coerced value, when the payload never named a PR.
  assert.equal(decide({}).pr, null);
  assert.equal(decide(payload({ number: "12" })).pr, null);
});

test("a bare PR number satisfies nothing on its own", () => {
  const decision = decide({ pr: { number: PR_NUMBER } });

  assert.equal(decision.apply, false);
  assert.equal(decision.pr, PR_NUMBER);
  // base, opt-in label, mergeable, and gates are all unmet.
  assert.ok(decision.reasons.length >= 4, JSON.stringify(decision.reasons));
});

test("renderComment leads with the sticky-comment marker", () => {
  // The workflow finds and updates its own comment by this marker. If it stops
  // leading the body, every run posts a fresh comment instead of editing one.
  for (const decision of [decide(payload()), decide(payload({ isDraft: true }))]) {
    const body = renderComment(decision, { sha: "abc1234", runUrl: "https://example.test/run/1" });
    assert.ok(body.startsWith("<!-- pr-guard -->"), body.slice(0, 80));
    assert.equal(body.split("<!-- pr-guard -->").length - 1, 1, "marker must be unambiguous");
  }
});

test("renderComment states opposite verdicts for opposite decisions", () => {
  const ready = renderComment(decide(payload()));
  const holding = renderComment(decide(payload({ isDraft: true })));

  assert.notEqual(ready, holding);
  assert.match(ready, /ready to apply/i);
  assert.match(holding, /holding/i);
  assert.doesNotMatch(ready, /holding/i);
});

test("renderComment lists every blocker when holding and none when ready", () => {
  const decision = decide(payload({
    baseRefName: "develop",
    labels: [],
    gates: [{ gate: "validate", status: "failed" }],
  }));
  const holding = renderComment(decision);

  for (const reason of decision.reasons) {
    assert.ok(holding.includes(`- ${reason}`), `comment omits blocker ${JSON.stringify(reason)}`);
  }
  assert.doesNotMatch(renderComment(decide(payload())), /Blockers:/);
});

test("renderComment's gate table emphasises the gate that is not passing", () => {
  const body = renderComment(decide(payload({
    gates: [
      { gate: "unit", status: "passed" },
      { gate: "browser-smoke", status: "failed" },
    ],
  })));

  assert.match(body, /\|\s*unit\s*\|\s*passed\s*\|/);
  assert.match(body, /\|\s*browser-smoke\s*\|\s*\*\*failed\*\*\s*\|/);
});

test("renderComment reports the validated sha and run link only when given them", () => {
  const decision = decide(payload());
  const sha = "0f1e2d3c4b5a";
  const runUrl = "https://example.test/run/99";

  const withContext = renderComment(decision, { sha, runUrl });
  assert.ok(withContext.includes(sha), "the validated merge sha must be attributable");
  assert.ok(withContext.includes(runUrl));

  const bare = renderComment(decision);
  assert.doesNotMatch(bare, /Validated merge result/);
  assert.doesNotMatch(bare, /Run log/);
  // Called with no options at all by the CLI path when the payload omits both.
  assert.doesNotThrow(() => renderComment(decision));
});

test("the PR guard runs the Sealbound browser contract once in route order", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/pr-guard.yml", import.meta.url),
    "utf8",
  );
  const browserGate = workflow.match(
    /^      - name: Gate — browser contract\n(?<body>[\s\S]*?)(?=^      - name: Decide$)/m,
  );
  assert.ok(browserGate, "PR guard must define the browser contract gate before Decide");

  const commands = browserGate.groups.body
    .match(/^\s*node tests\/\S+.*$/gm)
    ?.map((command) => command.trim()) ?? [];
  const spriteCommand = "node tests/sprite-2-5d-browser.cjs > results/browser/sprite-2-5d-browser.txt || status=failed";
  const sealboundCommand = "node tests/sealbound-browser.cjs > results/browser/sealbound-browser.txt || status=failed";
  const performanceCommand = "node tests/defense-performance-browser.cjs > results/browser/defense-performance-browser.txt || status=failed";

  assert.deepEqual(
    commands.filter((command) => command.startsWith("node tests/sealbound-browser.cjs")),
    [sealboundCommand],
    "browser gate must run the exact Sealbound command once",
  );
  const sealboundIndex = commands.indexOf(sealboundCommand);
  assert.deepEqual(
    commands.slice(sealboundIndex - 1, sealboundIndex + 2),
    [spriteCommand, sealboundCommand, performanceCommand],
    "Sealbound must run immediately after sprite-2.5D and before defense performance",
  );
  const browserGateLines = browserGate.groups.body.split("\n").map((line) => line.trim());
  const receiptCommand = `printf '{"gate":"browser_contract","status":"%s"}\\n' "$status" > results/browser_contract.json`;
  const receiptIndex = browserGateLines.indexOf(receiptCommand);
  assert.deepEqual(
    browserGateLines.slice(receiptIndex, receiptIndex + 2),
    [receiptCommand, `test "$status" = passed`],
    "browser gate must fail the step immediately after recording a failed aggregate receipt",
  );
});
