#!/usr/bin/env node
// Decides whether a validated PR may be merged into main.
//
// Split out of .github/workflows/pr-guard.yml so the rule set is unit-testable
// (tests/pr-merge-decision.test.mjs) instead of living as untested shell inside
// a workflow that only ever runs on a schedule -- a place where a logic bug
// would sit unnoticed until it merged something it should not have.
//
// `main` on this repo has NO branch protection (verified: the protection API
// returns 404). GitHub's native auto-merge is therefore unavailable, and there
// is no server-side gate to catch a bad merge. The opt-in label below is the
// only thing standing between a green PR and main, so it is required, never
// inferred, and the decision is fail-closed: anything unrecognised holds.
//
//   echo "$PAYLOAD" | node scripts/pr-merge-decision.mjs
//   node scripts/pr-merge-decision.mjs --payload payload.json
//
// Payload shape:
//   { pr: { number, isDraft, baseRefName, mergeable, mergeStateStatus,
//           labels: [{name}], reviewDecision },
//     gates: [{ gate, status }],
//     optInLabel: "auto-merge" }

export const DEFAULT_OPT_IN_LABEL = "auto-merge";

// mergeStateStatus values that mean "GitHub cannot cleanly merge this right
// now". BEHIND is deliberately NOT fatal: it only means the base moved on, and
// validation already ran against the merge result, so a merge commit resolves
// it. DIRTY (conflicts) and BLOCKED (failing required checks) are fatal.
const FATAL_MERGE_STATES = new Set(["DIRTY", "BLOCKED", "DRAFT", "UNKNOWN"]);

export function decideMerge(payload) {
  const reasons = [];
  const pr = payload?.pr ?? {};
  const gates = Array.isArray(payload?.gates) ? payload.gates : [];
  const optInLabel = payload?.optInLabel ?? DEFAULT_OPT_IN_LABEL;

  if (typeof pr.number !== "number") {
    return { apply: false, reasons: ["payload carries no PR number"], pr: null };
  }

  if (pr.baseRefName !== "main") {
    reasons.push(`base is ${pr.baseRefName ?? "unknown"}, not main`);
  }
  if (pr.isDraft) {
    reasons.push("PR is a draft");
  }

  const labels = (pr.labels ?? []).map((l) => (typeof l === "string" ? l : l?.name)).filter(Boolean);
  if (!labels.includes(optInLabel)) {
    reasons.push(`missing opt-in label "${optInLabel}"`);
  }

  if (pr.reviewDecision === "CHANGES_REQUESTED") {
    reasons.push("a reviewer requested changes");
  }

  // `mergeable` is GitHub's tri-state: MERGEABLE / CONFLICTING / UNKNOWN.
  // UNKNOWN means the mergeability probe has not finished; treat it as a hold
  // so a race never merges an unverified state.
  if (pr.mergeable !== "MERGEABLE") {
    reasons.push(`mergeable=${pr.mergeable ?? "UNKNOWN"}`);
  }
  if (pr.mergeStateStatus && FATAL_MERGE_STATES.has(pr.mergeStateStatus)) {
    reasons.push(`mergeStateStatus=${pr.mergeStateStatus}`);
  }

  if (gates.length === 0) {
    reasons.push("no validation gates reported");
  }
  const failed = gates.filter((g) => g?.status !== "passed").map((g) => g?.gate ?? "unnamed");
  if (failed.length > 0) {
    reasons.push(`failed gates: ${failed.join(", ")}`);
  }

  return {
    apply: reasons.length === 0,
    reasons,
    pr: pr.number,
    gates: gates.map((g) => ({ gate: g?.gate, status: g?.status })),
  };
}

export function renderComment(decision, { sha, runUrl } = {}) {
  const lines = ["<!-- pr-guard -->", "### PR guard"];
  lines.push("");
  lines.push(decision.apply
    ? "**Verdict: ready to apply** — every gate passed and the opt-in label is present."
    : "**Verdict: holding** — see the blockers below.");
  lines.push("");
  if (decision.gates?.length) {
    lines.push("| gate | status |");
    lines.push("| --- | --- |");
    for (const g of decision.gates) {
      lines.push(`| ${g.gate} | ${g.status === "passed" ? "passed" : `**${g.status ?? "missing"}**`} |`);
    }
    lines.push("");
  }
  if (!decision.apply) {
    lines.push("Blockers:");
    for (const r of decision.reasons) lines.push(`- ${r}`);
    lines.push("");
  }
  if (sha) lines.push(`Validated merge result: \`${sha}\``);
  if (runUrl) lines.push(`[Run log](${runUrl})`);
  return lines.join("\n");
}

async function readPayload(argv) {
  const flagIndex = argv.indexOf("--payload");
  if (flagIndex !== -1) {
    const { readFile } = await import("node:fs/promises");
    return JSON.parse(await readFile(argv[flagIndex + 1], "utf8"));
  }
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const argv = process.argv.slice(2);
  const payload = await readPayload(argv);
  const decision = decideMerge(payload);
  if (argv.includes("--comment")) {
    process.stdout.write(renderComment(decision, {
      sha: payload.sha,
      runUrl: payload.runUrl,
    }) + "\n");
  } else {
    process.stdout.write(JSON.stringify(decision, null, 2) + "\n");
  }
  // Exit 0 either way: "holding" is a normal outcome, not a workflow failure.
  // The workflow reads `apply` from the JSON rather than the exit code.
}
