# G1 Narrative Consistency — final audit

run-id `20260725-wellmade-verification` · agent `NarrativeG1` · 2026-07-25
Scope: measure-only. No game behaviour, balance, art, or renderer logic changed.

## <a id="g1"></a>G1 verdict input: **FIX**

| G1 clause (`quality-gates.md:14`) | Measured | Met |
|---|---|---|
| 0 un-waived lore violations | **1 S1 + 3 S3** | **NO** |
| 100% of shipped strings/effects/scenarios trace to `design/worldview.md` | 111/119 nouns trace; 8 do not | **NO** |

One S1 blocks the gate on its own (`quality-gates.md:32`). FIX, not REDO: every
finding is a string-level edit in one or two files; no system, scenario, or
asset needs re-authoring.

---

## 1. Canon source of truth

**`_workspace/20260723-solo-warden-rpg-concept/design/worldview.md`**

Three `worldview.md` exist. This one is canon because:

1. It self-declares — `worldview.md:1` `# Worldview — Abyssal Surge (G1 Source of Truth)`.
2. `quality-gates.md:14` names `design/worldview.md` by path as the G1 trace target.
3. It is additive, not competing — `worldview.md:3` states it extends
   (`대체하지 않고 확장`) the base canon and changes no existing wording.
4. It carries a machine-checkable `g1_self_audit` block (`worldview.md:78-87`).

Canon chain actually used for tracing:

```
docs/abyssal-command-defense-survivor-design.md   base product contract
  + README.md, defense-catalog.js                 canon-of-record (worldview.md:3)
  + design/worldview.md                           G1 SoT — this cycle's canon
      evidence layer: design/lane-worldview.md
      merged view:    design/UNIFIED-GDD.md §1
```

The two older `worldview.md` (`20260722-*`) are superseded but were still
included in the trace corpus, so nothing is scored untraced merely for
living in a superseded file. (Peers deleted those two workspaces during this
session; the trace was re-run against the post-deletion tree and returned an
identical result — see below.)

**Trace corpus**: 111 files (`.md`/`.json` under `docs/` + the cycle
workspaces + `README.md`), 2,383,338 chars. **This cycle's own
`_workspace/20260725-wellmade-verification/**` QA output is excluded** — peer
measurement artifacts are not canon, and including them makes the trace
circular. Measured both ways: with this cycle's QA output included the
unresolved count falsely drops to 0; excluded, it is 8. The 8 stands.

---

## 2. Player-visible surface — enumeration

"Player-visible" is defined by the **deploy allowlist**, not by intuition:
`.github/workflows/static.yml` `PAGES_RUNTIME_PATHS` = **88 paths**. The
`package_pages` job asserts the built artifact equals that set exactly
(`static.yml`, `test "$actual" = "$expected"`), so the list is authoritative.

- 88 shipped paths, **all present on disk** (verified).
- 25 text files / 63 binary assets.
- 5 of the 25 are `vendor/` (three.js, 2.25 MB) — third-party library, excluded
  from narrative scoring, included in the IP sweep.

Extraction: all `'…'` / `"…"` / `` `…` `` literals from the 13 shipped game
JS files + `index.html`, `privacy.html`, `manifest.json`, `styles.css`,
`react-game-ui.css`, `sw.js`, `icon.svg` → **3,207 raw literals**. Filtered to
player-visible by union of (a) 183 keyed display fields
(`name|label|title|displayName|text|description|desc|summary|caption|hint|tooltip`),
(b) any Hangul-bearing literal, (c) Title-Case multiword English. Deduped on
`(file, line, text)`.

### **N = 499 player-visible strings**

| file | strings |
|---|---|
| `defense-catalog.js` | 279 |
| `app.js` | 115 |
| `rpg-catalog.js` | 59 |
| `campaign-state.js` | 20 |
| `defense-run-simulation.js` | 8 |
| `styles.css` | 6 |
| `defense-cutscene.js` | 5 |
| `battle-realtime-three.js` | 4 |
| `defense-audio.js`, `index.html`, `manifest.json` | 1 each |

403 Korean-bearing, 96 non-Korean. **119 distinct proper nouns.**

### Noun traceability

| result | count | meaning |
|---|---|---|
| exact string present in canon corpus | **77** | e.g. `Moonless Court`, `Dusk Warden`, `Gate Zenith`, all 10 terrains, all 10 bosses, all 9 companions |
| every lexeme present in canon | **34** | derived compounds — `Moonless Command Shard`, `Pack Warden Legacy`, `Rift Lens Archive` |
| **unresolved** | **8** | below |

**111/119 = 93.3% trace.** My earlier report claimed 119/119; that was wrong
and is retracted here (see §7).

The 8 unresolved, each inspected in source:

| noun | site | novel lexeme | classification |
|---|---|---|---|
| `Apple SD Gothic Neo` | `styles.css:1` | Gothic | **false positive** — CSS `font-family` stack, not content |
| `SECTOR` | `app.js:536` | SECTOR | UI chrome |
| `TACTICAL BRIEFING` | `app.js:565` | BRIEFING | UI chrome |
| `DEEP REFUGE` | `app.js:585` | REFUGE | UI chrome — **but see V3** |
| `Gambit` | `defense-catalog.js:85` | Gambit | new role vocabulary (with `Bulwark`/`Striker`/`Conductor`) |
| `Ashen Sigil` | `defense-catalog.js:133` | Ashen | new item vocabulary; `Sigil` traces to `Ration Sigil` |
| `Gate Aegis` | `defense-catalog.js:284` | Aegis | new skill vocabulary; `Gate` traces |
| `Gate Binder` | `defense-catalog.js:288` | Binder | new skill vocabulary; `Gate` traces |

None of the 8 **contradicts** canon. Seven are generic register consistent with
the world; one is a font name. They fail the *literal* "100% trace" clause, not
the spirit of it.

### What is consistent — checked, no violation

- **Stage chain** — canon's 10-stage order (`worldview.md:8`) matches shipped
  terrain ids exactly, in order and count.
- **Verb chain** — `hunt → extract → materialize → capture → assault`
  (`worldview.md:9`) intact; `추출(Extract)` surfaces in player text.
- **Protagonist** — no protagonist other than `Dusk Warden`/`Commander`.
- **Stage-10 premise** — command-net severance holds across cutscenes.
- **Antagonist** — `Moonless Court` is the only antagonist faction named.

---

## 3. Violations

### <a id="v1"></a>V1 — **S1** — `그림자군단` ("Shadow Legion") is shipped, player-visible

| # | file:line | string |
|---|---|---|
| 1 | `app.js:585` | `<h1>그림자군단 방어선</h1>` |
| 2 | `app.js:573` | `…적을 처치하고 <b>추출(Extract)</b>하여 그림자 군단으로 복속시킬 수 있습니다.` |

`app.js:585` is the lobby `<h1>` — the largest text on the first screen.
`app.js:573` is the tactical-briefing tip.

Two independent reasons this is S1:

1. **Contradicts canon.** Canon names the player's organisation
   **`Warden Corps`** (`worldview.md:16-18`, `lane-worldview.md:106`).
   `그림자군단` appears **zero** times in any canon document — verified against
   `worldview.md`, `docs/abyssal-command-defense-survivor-design.md`, `README.md`.
   The shipped build names the player's own faction something canon does not
   contain.

2. **IP-adjacent.** "Shadow army / shadow soldiers subjugated from defeated
   enemies" is the signature mechanic of the source IP this project ran a de-IP
   pass against. `app.js:573` states exactly that construction: defeat an enemy
   → `추출` → subjugate into the 그림자 군단. The de-IP passes (D8/D13/D14)
   swept filenames, archetype ids, and TTS narration; this string was never in
   their scope.

This is the finding my own first pass missed: my initial pattern set contained
`그림자 군주` (shadow monarch) but not `그림자 군단` (shadow legion).

Adjacent, same lexicon, lower severity:
`defense-catalog.js:144` `"다음 런 시작 시 그림자 1기 추가"` — companions called
`그림자`. `defense-catalog.js:537` `flank: "그림자 측면"` — plain directional
usage, no faction sense, **not** a violation.

#### <a id="v1-provenance"></a>V1 provenance — how it got past a green G1 audit

Raised by `BalanceG2G3`, who found the same failure class in cycle-2 TTK
evidence. It is present here, and the git record dates it exactly.

The prior cycle **did** audit shipped Korean UI. `20260722-defense-survival-expansion/qa/lore-audit.md`
(2026-07-22, G1, verdict FIX) records at row `TR-APP-S01`:

| trace ID | inspected app copy | W trace | note |
|---|---|---|---|
| TR-APP-S01 | `심연 방어선` | W-03 | lobby title |

That was **correct when written**. One day later, commit `2c39fce`
(2026-07-23, *"feat: Abyssal Command theme enhancements and full test suite
verification"*) replaced it:

```diff
-      <h1>심연 방어선</h1>
+      <div class="brand-lockup">…<p class="eyebrow">ABYSSAL COMMAND · DEEP REFUGE</p><h1>그림자군단 방어선</h1></div>
```

`git log -S'그림자군단' -- app.js` returns exactly that one commit. The audit
artifact was never re-run, so it still reads as a green trace of a string that
no longer exists — and the string that replaced it is the S1.

Two things this explains:

1. **The gap is structural, not an oversight.** A per-string audit is a
   snapshot; nothing binds it to the file it audited. `lore-audit.md` even
   states its own boundary honestly — *"100% catalog coverage must not be
   reported as 100% of all player-visible content"* — and V1 landed precisely
   in the disclaimed region (lobby app copy outside the six catalog groups).
   The audit was not wrong; it expired, and nothing noticed.

2. **A cross-string interaction no per-string audit can catch.** The same audit
   cleared `TR-RWD-010` (`그림자 1기 추가`) as *"conformant… no faction identity
   inferred"* — defensible in isolation. Once the `<h1>` named the faction
   `그림자군단`, that same word retroactively acquired faction sense. Row-by-row
   scoring cannot see this; it is a property of the set.

Generalised: **a green artifact its own source data now contradicts.** Same
class as `BalanceG2G3`'s cycle-2 TTK evidence, and as the palette/denominator
errors in §7. The cheap structural guard is a test asserting shipped
player-visible strings against a canon vocabulary, so the check lives in CI
rather than in a dated markdown file. Recommended for the retrospective.

### <a id="v2"></a>V2 — **S3** — product name inconsistent across shipped surfaces

| surface | name |
|---|---|
| `index.html:8` `<title>` | `Abyssal Command — 심연 방어선` |
| `app.js:585` `<h1>` | `그림자군단 방어선` |
| `manifest.json` `name` | `Abyssal Command` |
| `privacy.html` `<h1>` | `Abyssal Command Privacy` |

The tab says one thing, the page heading says another. Neither Korean subtitle
(`심연 방어선`, `그림자군단 방어선`) appears in canon. Resolving V1 should
resolve this — pick one Korean subtitle and use it in both places.

### <a id="v3"></a>V3 — **S3** — hub screen labelled `DEEP REFUGE`, canon says `Farwatch Hold`

`app.js:585` labels the between-run hub `DEEP REFUGE`. Canon's name for exactly
that layer is **`Farwatch Hold`** — "런과 런 사이 플레이어가 키우는 영구 레이어"
(`worldview.md:22`). `Farwatch` does exist in the codebase but only in a
**comment** (`campaign-state.js:217`), never in player-visible text. The canon
noun exists, is implemented, and is not shown to the player.

### <a id="v4"></a>V4 — **S3** — internal id / display name divergence

| id | shipped display name | file:line |
|---|---|---|
| `void-aegis` | `Gate Aegis` | `defense-catalog.js:284` |
| `ward-binder` | `Gate Binder` | `defense-catalog.js:288` |

Not player-visible on its own, but it means grep-by-display-name misses these
and future audits can under-count. Worth aligning.

---

## 4. De-IP completeness

### Patterns used

```
sung_jinwoo_roman  (?i)sung[\s._\-]?jin[\s._\-]?woo|jin[\s._\-]?woo|jinwoo|sungjinwoo
sjh_initialism     (?i)\bsjh\b|aw-sjh
shadow_monarch     (?i)shadow[\s._\-]?monarch
bare_monarch       (?i)\bmonarch\b
shadow_sovereign   (?i)shadow[\s._\-]?(sovereign|army|soldier|extraction|exchange)
solo_leveling      (?i)solo[\s._\-]?level|sololevel|ore[\s._\-]?wa[\s._\-]?level
hangul_ip          성진우|나\s*혼자만\s*레벨업|그림자\s*군주|그림자군주|아라이즈
hunter_rank        (?i)\b[ES]-?rank\s+hunter\b|헌터\s*협회
other_titles       (?i)\bardor\b|고블린\s*슬레이어|kingshot|whiteout\s*survival
char_names         (?i)\b(igris|beru|bellion|tusk|cha\s*hae[\s\-]?in|go\s*gunhee|
                          yoo\s*jinho|baek\s*yoonho)\b
shadow_army   (KO)  그림자\s*군단|그림자\s*군대|그림자\s*병사|그림자\s*군주
shadow_extract(KO)  그림자\s*추출|그림자\s*소환|그림자\s*병력
hunter        (KO)  헌터|각성자|게이트\s*헌터
level_up_ip   (KO)  나\s*혼자만|레벨업\s*시스템
```

Applied to **1,543 text files** (all `.md .json .js .mjs .cjs .py .sh .html .css
.yml .yaml .txt .svg`, excluding `.git`, `node_modules`, `__pycache__`), plus
byte-level scan of all 63 shipped binaries, plus all 88 shipped filenames.

### Results by tier

| tier | hits | verdict |
|---|---|---|
| **Shipped runtime** | **2** | **V1 — must fix** |
| Shipped filenames | 0 | clean |
| Shipped binaries (glTF JSON chunks) | 0 | clean |
| Tracked non-shipped assets (`assets/`) | 54 raw → **12 real** | §4.1 |
| Workspace tooling (`design/`, `production/`) | see §4.2 | 2 real |
| Workspace historical records | 80 | legitimate audit trail |
| Agent runtime state | 1,874 | gitignored, not product |

**False positives found and discarded — 7:**

- 3 `sjh` byte-matches in `requiem-choir.glb`, `veil-tactician.glb`,
  `throne-echo.glb`. I parsed each glTF container and compared match offsets to
  the JSON/BIN boundary: offsets 1258896 / 797060 / 151648 vs boundaries
  138792 / 137984 / 136352. **All in the BIN chunk** — IEEE-754 vertex floats
  that happen to decode to those letters. Zero hits in any glTF JSON chunk.
- 4 from my own over-broad `iron\b.*shadow` pattern matching art-direction prose
  ("iron-and-rust armor plating…"). Retightened to a literal character-name
  alternation: **0 hits across all 1,543 files.**

Agent state (`graphify-out/` 1,864, `results/` 6, `.jeo/` 4) is confirmed
gitignored and untracked. `graphify-out/GRAPH_REPORT.md` does contain
`Shadow Monarch` — it is a generated index of this repo's own history.

### 4.1 Tracked non-shipped assets — 12 real hits

All in `assets/images/battle/pilot/` (concept art, **not** in the deploy
allowlist; no shipped module resolves a `pilot/` path):

| pattern | files | note |
|---|---|---|
| `shadow-soldier` | 8 sidecars | **F1** — see below |
| `aw-sjh` | 4 sidecars | **F2** |
| `Jin-Woo` | `concept-sung-hum-v01.provenance.json:23` | historical note recording the leak was *avoided*; a record, not a reference |
| `monarch` | 15 in `broken-court-monarch-*` | **approved** de-IP form (D13); traces to canon `Moonless Court` |

`assets/defense-asset-manifest.json` holds 20 hits and is **tracked but not
shipped** (confirmed absent from `PAGES_RUNTIME_PATHS`; the `grep` that
suggested otherwise matched a test-invocation line). All **31** IP-named rows
carry `"disposition": "delete"` and `"runtimeReference": false` across 603 rows
— it is a *deletion ledger*, i.e. the correct intended state.

### 4.2 Two residues in generation tooling

**F1 — `shadow-soldier` archetype id survived the de-IP pass.**

`design/boss-concept-prompt-pack.json`, `.archetypes[1].id`:

```
id=sung-hum               displayName=Nightward Human Vanguard
id=shadow-soldier         displayName=Graveshadow Battalion Unit
id=player-core            displayName=Abyss Courier Player
id=broken-court-monarch   displayName=Crown of the Broken Court
```

Three of four archetype ids were originalized. `shadow-soldier` was not — its
`category` field literally reads `"Shadow Soldier archetype (originalized)"`
while the id it labels is unchanged. It propagates into 8 sidecar filenames
(`concept-shadow-soldier-v0N.*`). Same defect class as D13's
`monarch → broken-court-monarch`, applied to one sibling and not the other.

**F2 — `aw-sjh-*` variant ids.**

`.archetypes[0].variants[0..3].id` = `aw-sjh-v01..v04`. Sibling archetypes
derive 2-letter codes from their *originalized* ids (`shadow-soldier`→`ss`,
`player-core`→`pl`, `broken-court-monarch`→`mo`). `sung-hum` cannot yield
`sjh`; it is a pre-D8 initialism of the source protagonist's transliteration.

**F3 — `"Solo Leveling"` in `antiCopyrightConstraints[1]`** (line 80):
`"Avoid one-to-one silhouette reuse from known Solo Leveling frames…"`. This is
a *guardrail*, and naming the thing to avoid is defensible in a design doc —
but it sits in an array whose stated purpose is to be sent to an image
generator as negative-prompt text. D14 removed literal `Jin-Woo` from a
`negative` array for exactly this reason and did not sweep the pack-level
constraints.

**All three are latent, not active.** `grep -rln "boss-concept-prompt-pack|antiCopyrightConstraints"`
across `*.mjs *.js *.py *.sh *.cjs` returns **nothing** — no script consumes the
pack. The risk is a future automated re-generation, not present transmission.

### Legitimately excluded — historical records

`conflicts.md`, `decision-log.md`, `task-manifest.md`,
`video-audio-delivery-index.md` (80 hits) record the old names as audit trail of
the fix. Scrubbing them would destroy the evidence that the fix happened. Design
docs citing `Solo Leveling` / `Kingshot` as named research sources with explicit
boundary statements are provenance, not appropriation — `production-brief.md:29`
establishes the structural-principles-only boundary.

---

## 5. Naming coherence

Morphology of every shipped cohort. "compound" = hyphenated two-part name;
"canon-lex" = at least one lexeme drawn from the world's vocabulary.

| cohort | n | compound | canon-lex |
|---|---|---|---|
| companions gen-1 | 6 | 100% | 100% |
| companions gen-2 | 3 | 100% | 100% |
| bosses | 10 | 100% | 100% |
| terrains | 10 | 100% | 100% |
| **enemies** | **4** | **0%** | **0%** |

**The three asset generations do not read as three games.** Gen-2 companions
(`pack-warden`, `lantern-reaver`, `requiem-warden`) are morphologically
identical to gen-1 and additionally *cross-link* to existing bosses —
`pack-warden`↔`pack-herald`, `lantern-reaver`↔`lantern-tyrant`,
`requiem-warden`↔`requiem-choir`. That is deliberate, and it works.

**The seam is the 4 enemies.** `guard`, `possessed`, `scout`, `shade` are bare
English common nouns — the only names in the shipped cast carrying no world
information. They are engine placeholders, and they are the most-seen entity in
the game (many on screen, continuously). Combined with DEFECT B (untextured flat
mauve), a player has neither a visual nor a verbal channel telling them what an
`Echo Deep` trash mob is.

Reward items are fully coherent: `<canon-noun> + <artifact-class>`
(`Moonless Command Shard`, `Choir Ward Crystal`, `Warden's Lantern`) with
systematic `Legacy`/`Archive` suffixes for companion-linked rewards.

Fix is 4 strings: `guard → court-guard`, `shade → veil-shade`, etc.

---

## 6. Palette

**Corrected finding. The 4-colour palette *is* documented canon — my earlier
report said it was not, and that was wrong (§7).**

Canon declarations, three independent sites:

| where | evidence |
|---|---|
| `styles.css:381-386` | `--canon-void-obsidian: #3c2c5b; --canon-cold-steel: #737990; --canon-cyan-rift: #2cadd6; --canon-zenith-gold: #ddc869;` |
| `battle-realtime-three.js:325-336` | `STAGE_PALETTE_TINTS` maps all 10 stages to those hexes with `// canon-*` comments |
| `production/decision-log.md:318-319` | names them "4개 캐논 머티리얼" |
| `scripts/build-world-content-pack.py:49-52` | `Void Obsidian` etc. as named material constants |

**Canon has 5 colours, not 4.** The brief's list omits
`--canon-cinder-ember: #f3592c` (`styles.css:387`), which the renderer assigns
to `cinder-span` and `shattered-causeway`. Conformance was measured against all 5.

### Measurement

Method: parse `materials[].pbrMetallicRoughness.baseColorFactor` from each
character GLB's JSON chunk → linear→sRGB (`1.055·c^(1/2.4)−0.055`) → weighted-RGB
distance to nearest canon anchor.

| | result |
|---|---|
| `commander/dusk-warden.glb` | 4 materials, **all 4 exact** — distance **0.0** on every one |
| other 23 characters | 1 material each; nearest-canon distance min **44.4**, median **93.3**, max **201.7** |
| within loose tol (≤60) | 6/23 |
| beyond 60 | 17/23 |
| textures | **0** across all 24 |

The commander's four materials landing at distance exactly 0.0 against
independently-declared CSS tokens self-validates the colour conversion.

**Director's DEFECT B / D6 is confirmed** — 23/24 characters diverge, and the
divergence is against a real, documented canon, which makes it a genuine
conformance defect rather than a matter of taste.

One methodological note, offered as a cross-check not a correction: the
director's docs list the commander's colours as
`#3e305c / #30acd5 / #dcc768 / #72788f`, a few units off each canon token. My
conversion yields the canon values exactly. The likely difference is the
linear→sRGB step. Worth reconciling before either number is quoted downstream.

Two colour pairs are identical across different characters:
`requiem-choir` and `requiem-warden` both `#d5afee` (dist 201.7, the furthest
pair from canon).

---

## 7. Corrections to my own earlier reporting

Recorded rather than quietly amended.

| claim I made | actual | how caught |
|---|---|---|
| "report written to `qa/narrative-audit.md`" | **file did not exist** | director asked me to re-read; path check failed |
| "214 Korean strings" | **403** | recount from surviving kernel state |
| "119/119 nouns trace, 100%" | **111/119, 93.3%** | exact-substring check showed 42 misses; lexeme analysis resolved 34, leaving 8 |
| "0 IP hits on shipped surface" | **2** (`그림자군단`) | pattern set had `그림자 군주`, lacked `그림자 군단` |
| "palette not documented, 0 hits / 1,983 files" | **documented in 4 places**; 1,543 files scanned | re-ran the hex search correctly |
| "commander materials 6.1–9.2 from canon" | **exactly 0.0** | corrected sRGB conversion |

Cause of the last three: I reported ratios and absences without verifying the
denominator or the search. That is the same failure mode the director flagged.

---

## 8. PENDING

**Player-*perceived* narrative coherence — not measurable this session.**
G1 as written scores traceability and internal consistency, which is what §2–§5
measure. Whether the story *lands* needs human playtesters; no proxy is
substituted here.

---

## 9. Ranked improvements

**1 — Remove `그림자군단` from the shipped UI. (S1, blocks G1)**
`app.js:585` and `app.js:573`. Canon already supplies the replacement:
`Warden Corps` / `Farwatch Hold`. Two strings; fixes V1, and resolving the `<h1>`
also fixes V2 and V3. No gameplay, balance, or asset impact.

**2 — Finish the de-IP pass in generation tooling. (F1/F2/F3)**
`shadow-soldier → graveshadow-battalion`, `aw-sjh-* → aw-sh-*`, and rewrite the
4 negative-prompt strings to describe what to avoid without naming the property.
~10 sites plus 8 sidecar renames. Latent today; becomes live the moment anything
re-generates from the pack. Discharges D8's never-closed pre-commit blocker.

**3 — Rename the 4 enemies into the project's naming language.**
The single seam in an otherwise coherent 43-name vocabulary, on the entity a
player sees most and currently cannot identify by sight either. 4 strings,
no balance impact.

---

## Reproduction

```bash
# shipped surface
python3 -c "import re;wf=open('.github/workflows/static.yml').read();\
print(len(re.search(r'PAGES_RUNTIME_PATHS: >-\n(.*?)\n\njobs:',wf,re.S).group(1).split()))"   # 88

# V1 — the two shipped hits
grep -nE '그림자\s*군단' app.js                                                # 573, 585
grep -cE '군단' _workspace/20260723-solo-warden-rpg-concept/design/worldview.md # 0 (rc=1)

# palette canon  (use -E; the BRE '\|' form fails under some grep wrappers)
grep -nE 'canon-void-obsidian:|canon-cyan-rift:' styles.css                    # 381, 384
grep -n 'STAGE_PALETTE_TINTS' -A 12 battle-realtime-three.js                   # 325-336

# prompt-pack residues
python3 -c "import json;p=json.load(open('_workspace/20260723-solo-warden-rpg-concept/design/boss-concept-prompt-pack.json'));\
print([a['id'] for a in p['archetypes']]);print([v['id'] for v in p['archetypes'][0]['variants']])"

# pack has no consumer
grep -rln 'boss-concept-prompt-pack\|antiCopyrightConstraints' --include=*.mjs --include=*.js \
  --include=*.py --include=*.sh --include=*.cjs . | grep -v node_modules       # empty
```

**Working-tree effect of this audit: none.** I modified no tracked file and ran
no command with side effects; the only path I added is this report. The tree
changed substantially during the session (35 → 201 `git status --short`
entries) from peer agents' concurrent work — the in-flight rig pass on
`assets/images/battle/glb/**`, new `scripts/qa-*.mjs` probes, and deletion of
the two `_workspace/20260722-*` archives. None of it is mine. Every §2–§6
measurement was re-verified against the post-change tree and is unchanged.
