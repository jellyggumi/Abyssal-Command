# GitHub Pages rollback runbook

**Audience:** release operator with repository Actions/Pages access.  
**Mode:** rollback response for a static, offline-first PWA.  
**Current candidate reference:** `dd49f9e13f081bf4390e1c47f836eda24b751fae` (`defense-survivor-v1`).

## Release shape

- Provider: GitHub Pages through `.github/workflows/static.yml`.
- Artifact: allowlisted static files archived from one full Git commit plus generated `version.json`.
- Promotion model: rebuild the allowlisted artifact from the selected revision; there is no mutable server or database promotion.
- Rollout strategy: direct replacement after engine, release-closure, browser, package, artifact-smoke, deploy, and deployed-smoke jobs pass.
- Rollback strategy: manually dispatch the same workflow with a known-good ancestor commit as `rollback_revision`.
- State caveat: rollback does not erase or downgrade browser-local campaign/telemetry data. Save-schema compatibility must be verified separately.

## Tested versus not tested

### Tested on 2026-07-22

| check | result | evidence |
|---|---|---|
| workflow/release closure shape | PASS | `node --test tests/release-closure.test.mjs`: 2 tests, 0 failures |
| rules version reader | PASS | `node scripts/read-defense-rules-version.mjs` returned `defense-survivor-v1` |
| current reference is a valid ancestor of current HEAD | PASS | `git merge-base --is-ancestor dd49f9e13f081bf4390e1c47f836eda24b751fae HEAD` exited 0 |
| workflow revision guard | PASS | static contract: workflow rejects non-lowercase/non-40-character revisions and revisions not ancestral to `origin/main` |
| deployed version contract | PASS | static contract: deployed smoke requires `version.json.candidate_sha` and `rules_version` to match the selected revision |

These checks prove the procedure is wired and syntactically guarded. They do **not** prove that a rollback deployment has occurred.

### Not tested / release-blocking

| check | status | reason |
|---|---|---|
| actual `workflow_dispatch` rollback | BLOCKED | deployment is prohibited during active implementation lanes |
| production URL recovery | BLOCKED | no rollback run or post-rollback release receipt collected |
| controlled-client cache recovery | BLOCKED | `sw.js` currently uses fixed cache name `abyssal-command-defense-survivor-v2`; old clients can retain newer cache-first modules after an old revision is redeployed |
| local save downgrade compatibility | BLOCKED | no old-candidate/new-save import session has been recorded |
| 30-minute post-recovery soak | BLOCKED | no 1,800,000 ms artifact exists |

## Stop conditions

Do not dispatch or continue a rollback if any of these is true:

- the target is not a full lowercase 40-character SHA;
- the target is not an ancestor of `origin/main`;
- the target lacks a previously accepted release receipt or its known-good evidence cannot be recovered;
- the target cannot read the current browser-local campaign schema;
- its exact Pages allowlist/module closure is incomplete;
- its service-worker cache namespace is not unique to its candidate SHA;
- any workflow gate, deployed `version.json`, browser smoke, or controlled-client cache check fails.

A failed deploy job is not recovery. Keep the incident open and preserve the run URL/artifacts.

## Executable recovery procedure

### 1. Select and validate the known-good revision

```sh
export GOOD_SHA='<full lowercase 40-character known-good SHA>'
export PAGE_URL='https://<owner>.github.io/<repository>/'
test "$(printf '%s' "$GOOD_SHA" | wc -c | tr -d ' ')" = 40
git fetch origin main
git rev-parse --verify "${GOOD_SHA}^{commit}"
test "$(git rev-parse --verify "${GOOD_SHA}^{commit}")" = "$GOOD_SHA"
git merge-base --is-ancestor "$GOOD_SHA" origin/main
```

Before changing production, preserve the currently exposed identity:

```sh
mkdir -p results
curl -fsS -H 'Cache-Control: no-cache' \
  "${PAGE_URL%/}/version.json?pre_rollback=$(date +%s)" \
  | tee "results/pre-rollback-version-$(date -u +%Y%m%dT%H%M%SZ).json"
```

### 2. Dispatch the guarded rollback build

```sh
gh workflow run static.yml --ref main -f rollback_revision="$GOOD_SHA"
sleep 5
export RUN_ID="$(gh run list --workflow static.yml --event workflow_dispatch --branch main --limit 1 --json databaseId --jq '.[0].databaseId')"
test -n "$RUN_ID"
gh run watch "$RUN_ID" --exit-status
```

The workflow itself checks out `GOOD_SHA`, verifies exact identity and ancestry, rebuilds from that revision, runs all release gates, deploys, runs deployed smoke, and refuses the final receipt unless every upstream result is `success`.

### 3. Download and validate the recovery receipt

```sh
rm -rf "results/rollback-${RUN_ID}"
mkdir -p "results/rollback-${RUN_ID}"
gh run download "$RUN_ID" --name release-receipt-results --dir "results/rollback-${RUN_ID}"
jq -e --arg sha "$GOOD_SHA" \
  '.sha == $sha and .all_gate_pass == true and (.page_url | length > 0)' \
  "results/rollback-${RUN_ID}/release_receipt.json"
```

Use the receipt URL rather than an assumed Pages hostname:

```sh
export RECOVERED_URL="$(jq -r '.page_url' "results/rollback-${RUN_ID}/release_receipt.json")"
curl -fsS -H 'Cache-Control: no-cache' \
  "${RECOVERED_URL%/}/version.json?post_rollback=$(date +%s)" \
  | tee "results/rollback-${RUN_ID}/post-rollback-version.json"
jq -e --arg sha "$GOOD_SHA" --arg rules 'defense-survivor-v1' \
  '.candidate_sha == $sha and .rules_version == $rules' \
  "results/rollback-${RUN_ID}/post-rollback-version.json"
node tests/deployed-defense-smoke.cjs \
  --url "$RECOVERED_URL" \
  --sha "$GOOD_SHA" \
  --rules-version defense-survivor-v1 \
  | tee "results/rollback-${RUN_ID}/operator-deployed-smoke.json"
```

### 4. Verify an already-controlled PWA client

This is mandatory after SHA-derived service-worker versioning is implemented. Use a browser profile that loaded the failed candidate before rollback, reload twice, and verify all three identities agree:

1. network-fetched `version.json.candidate_sha` is `GOOD_SHA`;
2. the active service-worker cache is `abyssal-command-defense-survivor-<GOOD_SHA>`;
3. the UI can start a run, admit movement, select growth, and return to the lobby without page/console errors.

Until that profile-based check passes, clean-browser smoke is insufficient and rollback is **not verified**.

### 5. Preserve evidence and close containment

Keep the GitHub run URL, `release_receipt.json`, pre/post `version.json`, operator deployed-smoke output, controlled-client browser capture, and save-schema compatibility receipt together. Then run the 30-minute command in `engineering/perf-budget.md`. Recovery can be called complete only after these artifacts pass; broader G1–G8 release readiness is evaluated separately.

## Required service-worker versioning before release

Current fixed `CACHE_NAME = "abyssal-command-defense-survivor-v2"` is a rollback defect. The release artifact must instead satisfy this exact contract:

- package time stamps the full `candidate_sha` into the artifact’s service worker;
- cache name is `abyssal-command-defense-survivor-<full candidate SHA>`;
- `version.json.candidate_sha`, the cache-name suffix, checked-out revision, and release receipt SHA are identical;
- activation deletes only stale caches with prefix `abyssal-command-defense-survivor-`, never unrelated origin caches;
- `version.json` remains network-only/no-store;
- deployed smoke covers both a clean context and an upgrade context already controlled by the immediately preceding service worker.

Because `.github/workflows/static.yml` currently archives `sw.js` without candidate stamping and `sw.js` uses the fixed `v2` name, this contract is **FIX**, not PASS. A manual user instruction to clear site data is not an acceptable public rollback mechanism.

## What rollback does not undo

Rollback does not reverse browser-local campaign records, telemetry exports, downloaded files, user-recorded gameplay video, or generated-media provenance. There are no server accounts, commerce, remote telemetry, or network data migrations in scope. If a candidate wrote a save shape that the known-good revision cannot parse safely, stop and ship a forward-compatible recovery revision instead of rolling back blindly.
