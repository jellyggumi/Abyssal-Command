# Workspace Normalization — `_workspace/` 루트 날짜 폴더 위반 기록

```yaml
run_id: 20260728-onslaught-action-pivot
status: "기록 문서 — 위반 사실은 [OBSERVED], 부모 세션 정리 결과는 항목별로 표기"
owner_skill: agent-workflow
authority: CLAUDE.md#1
role: recorder — 이 문서를 쓴 레인은 파일시스템/Git 변경을 수행하지 않았다
scope: 루트 날짜 폴더 위반 목록, 중복 수량 분석, 부모 세션 정리 조치, 타 세션 작업 보존, 재발 방지 규칙
```

측정 기준 시각: 2026-07-28. 이 문서의 모든 수량은 파일시스템을 직접 열거(`os.walk`)나
`find`로 세어 얻은 실수치다. Git은 한 번도 호출하지 않았다 — 추적 여부는 `.gitignore`
패턴을 읽어(`pathspec` gitwildmatch) 판정했다.

---

## 1. Violation inventory — 위반 목록

| # | 위반 사실 [OBSERVED] | 깨진 CLAUDE.md 조항 (원문 인용) |
|---|---|---|
| V1 | `_workspace/20260725-wellmade-verification/` 가 `_workspace/` 루트에 날짜 폴더로 존재한다. 파일 1개. | §1: "**`_workspace/current/` is the only folder any session writes to.** There are no dated run folders." |
| V2 | `_workspace/20260726-stage1b-cinder-pressure-agency/` 가 `_workspace/` 루트에 날짜 폴더로 존재한다. 파일 434개. | §1: "There are no dated run folders. A new production cycle does not create a sibling directory — it updates `current/` in place" |
| V3 | V2와 같은 run-id 의 정식 아카이브 `_workspace/archive/20260726-stage1b-cinder-pressure-agency/`(245개)가 이미 존재한다. 즉 V2는 아카이브된 사이클의 루트 측 잔존물이다. | §1: "Archiving is the only way material leaves `current/`." — 아카이브가 끝난 run-id 가 루트에 다시 나타나면 아카이브가 최종 상태가 아니게 된다 |
| V4 | 루트 날짜 폴더 434개 중 420개가 `.gitignore` 선언에 걸리는 생성물/후보 레인/`__pycache__` 다. | §1: "Generated/local material (`_workspace/**/pipeline/`, `**/models-out/`, candidate lanes, `__pycache__`) is not shared source of truth. Do not promote it without an explicit provenance/rights/runtime receipt." |
| V5 | 아카이브 하위 `qa/browser-runtime-1440x900/` 의 파일 36개가 이번 세션 중 삭제된 상태였다. | §1: "Treat `_workspace/archive/**` as immutable history: read it for evidence, never edit or delete it." / "Never delete a `_workspace/` artifact to make a gate or a summary look cleaner." |
| V6 | 루트 날짜 경로가 코드에 하드코딩되어 있어, 테스트·스크립트 실행이 폴더를 **재생성**한다. 상세는 §5. | §1: "There are no dated run folders." — 규약을 코드가 자동으로 깨뜨리는 상태 |

V6이 이 목록의 핵심이다. V1–V3을 손으로 지워도 V6이 남아 있으면 다음 실행에서 되돌아온다.

---

## 2. Overlap analysis — 중복 수량 분석

### 2.1 파일 수 [OBSERVED]

| 트리 | 파일 수 |
|---|---|
| `_workspace/20260725-wellmade-verification/` | **1** |
| `_workspace/20260726-stage1b-cinder-pressure-agency/` (루트) | **434** |
| `_workspace/archive/20260726-stage1b-cinder-pressure-agency/` (아카이브) | **245** |

루트 434개와 아카이브 245개를 상대경로로 교집합·차집합한 결과:

| 관계 | 파일 수 |
|---|---|
| 양쪽에 같은 상대경로로 존재 | **11** |
| 루트에만 존재 (아카이브에 없음) | **423** |
| 아카이브에만 존재 (루트에 없음) | **234** |

**루트 폴더는 아카이브의 부분 중복이 아니다.** 경로 겹침은 434개 중 11개(2.5%)뿐이고,
나머지 423개는 아카이브에 아예 없다. "부분 중복"이라는 서술은 이 수치로 반증된다 —
두 트리는 대체로 서로소이며, 루트 쪽은 아카이브된 레인의 사본이 아니라 **아카이브 이후
재생성된 산출물 + 무시 대상 후보 레인**이다.

### 2.2 겹치는 11개는 내용이 다르다 [OBSERVED]

겹치는 11개 전부 `qa/stage-runtime-proof/` 하위다. SHA-256 비교 결과 **11/11 이 불일치**
(byte-identical 0개):

| 파일 | 루트 크기·mtime | 아카이브 크기·mtime |
|---|---|---|
| `01-cinder-span.png` | 1,248,258 B / 07-28 23:30 | 1,299,430 B / 07-28 22:45 |
| `10-gate-zenith.png` | 1,343,126 B / 07-28 23:31 | 1,368,089 B / 07-28 22:45 |
| `stage-runtime-summary.json` | 52,943 B / 07-28 23:31 | 47,086 B / 07-28 22:45 |

(나머지 8개 PNG도 같은 양상 — 루트가 더 최신, 크기 상이.)

요약 JSON 내부 `generatedAt` 이 결정적이다:

- 루트: `"generatedAt": "2026-07-28T14:30:40.212Z"`
- 아카이브: `"generatedAt": "2026-07-27T20:37:19.464Z"`

**루트 쪽이 더 새롭다.** 즉 아카이브가 낡은 사본이고 루트가 잔존물인 것이 아니라,
아카이브 후 오늘 다시 실행된 증거 생성이 루트 경로에 떨어졌다. 두 요약 파일 모두 내부
`summaryArtifactPath` 에 `_workspace/20260726-stage1b-cinder-pressure-agency/...` 를 기록하고
있어, 생성물 자체가 위반 경로를 자기 기술에 박아 두고 있다.

### 2.3 루트 전용 423개 분류와 §1 판정 [OBSERVED]

`.gitignore` 는 `_workspace/**/...` 글롭으로 선언되어 루트/아카이브 위치와 무관하게 적용된다.
따라서 추적 여부는 Git 없이 판정 가능하다.

| 종류 | 개수 | `.gitignore` 무시 | 비무시 | §1 판정 |
|---|---|---|---|---|
| `engineering/asset-pipeline/**` 후보 레인 | 386 | 386 | 0 | **local-only scratch** — §1이 "candidate lanes"를 명시적으로 열거 |
| Blender `.blend1` 에디터 백업 | 17 | 17 | 0 | **local-only scratch** — `.gitignore` `*.blend1` |
| Blender `.blend` 저작 씬 | 10 | 10 | 0 | **local-only scratch** — 전량 superseded gallery/후보 레인 소속 |
| `blender/` 저작 스크립트 (`.py`) | 3 | 3 | 0 | **local-only scratch** — `.gitignore` 가 superseded 로 명시 |
| `__pycache__` 바이트코드 | 2 | 2 | 0 | **local-only scratch** — §1이 `__pycache__` 를 명시적으로 열거 |
| QA 증거 (`qa/*.md`, `*.json`, 대조표 PNG) | 4 | 2 | **2** | **archivable** — 비무시 2건은 소유 레인으로 이동 대상 |
| 텍스처 (`blender/textures/*.png`) | 1 | 0 | **1** | **archivable** — 판정 유보, 승격은 §1의 provenance/rights/runtime receipt 없이는 불가 |
| **합계** | **423** | **420** | **3** | |

세부 확인: `engineering/asset-pipeline/` 하위 실측 394개 중 386개가 후보 레인으로 분류되고,
나머지 8개는 더 앞선 규칙이 가져갔다(`.blend` 4, `.blend1` 2, `.pyc` 2). 트리 접두사별
실측은 `engineering/` 395, `blender/` 24, `qa/` 15 = 434.

루트 434개 전체로 보면 **무시 420 / 비무시 14**. 비무시 14개의 정체:

- `qa/stage-runtime-proof/` 11개 — §2.2에서 확인한 재생성 산출물 (더 최신)
- `qa/stage-playtime-doctrine-verification.md`, `qa/stage-playtime-doctrine.json` — QA 증거
- `blender/textures/a9d039b5d1cd4e67b7c5fe169cad3025_shaded.png` — 텍스처

**승격(promotable) 판정을 받은 종류는 하나도 없다.** §1은 승격에 "explicit
provenance/rights/runtime receipt"를 요구하고, 이 문서를 쓰는 시점에 그 영수증은 어느
종류에도 첨부되어 있지 않다. 따라서 최대 등급은 *archivable* 이며, 420개는 *local-only
scratch* 로 남는다.

### 2.4 `20260725-wellmade-verification` [OBSERVED]

파일 1개: `_workspace/20260725-wellmade-verification/qa/evidence/data/motion.json`
(111,212 B, `.gitignore` 비무시). 폴더 전체가 이 한 파일이며, §5에서 보듯 그 한 파일은
스크립트가 자동 생성한 것이다.

---

## 3. Resolution applied by parent — 부모 세션이 적용하는 조치

이 레인은 기록자다. 아래 (a)–(c)는 부모 세션이 수행하며, 각 항목은 파일시스템을 읽어
종료 상태를 확인할 수 있을 때만 `[OBSERVED]` 로 표기했다.

### (a) 아카이브 삭제 36개 복원 — §1 불변성 회복 → [OBSERVED]

`_workspace/archive/20260726-stage1b-cinder-pressure-agency/qa/browser-runtime-1440x900/`
의 삭제된 파일 36개가 복원되었다. 파일시스템 재확인 결과:

| 검사 | 결과 |
|---|---|
| 파일 수 | **36** (`find ... -type f \| wc -l` = 36) |
| 0바이트 스텁 | **0** |
| 총 용량 | **19,999,292 B** (최소 668 B, 최대 1,365,777 B) |
| PNG 매직바이트 `\x89PNG\r\n\x1a\n` 검증 | 33/33 유효, 불량 0 |
| JSON 파싱 | 3/3 파싱 성공, 불량 0 |

내용이 살아 있는 실제 복원이며 빈 껍데기가 아니다. V5는 해소되었다.

#### 복원 시각 확인 — 삭제·복원이 실제로 일어났다는 양성 증거 [OBSERVED]

`WorkspacePathMigration` 레인이 이 36개의 mtime 이상을 제보했고, 직접 재확인한 결과가
오히려 (a)의 확증이 되었다.

| 대상 | mtime | ctime |
|---|---|---|
| 복원된 36개 | **2026-07-29 00:58:44** (distinct 값 1개) | **2026-07-29 00:58:44** (distinct 값 1개) |
| 같은 아카이브 트리의 나머지 209개 | 2026-07-28 22:45 (distinct 값 1개) | — |

두 가지가 결론을 고정한다:

1. 36개 전부 **ctime == mtime == 동일한 1초**다. 보존된 원본이 아니라 일괄 복사로 새로 만들어진
   inode 라는 뜻이다.
2. 같은 트리의 나머지 209개는 전부 22:45(최초 아카이브 생성 시각)이다. 36개가 애초에 삭제되지
   않았다면 이들도 22:45 를 유지했을 것이다.

따라서 00:58:44 이라는 서명은 **삭제 후 복원이 실제로 발생하고 완료되었다는 양성 증거**이며,
아카이브에 대한 새로운 침해가 아니다. 이 레인의 기록 파일 2건은 01:11:22 / 01:11:57 에
기록되어 00:58:44 보다 약 13분 늦고, 제보 레인의 이동 구간(01:17:29)보다도 이르다 — 즉 이
쓰기는 (a)를 수행한 부모 세션의 복원이다.

**단서 하나는 정직하게 남긴다**: 복원된 36개의 mtime 은 더 이상 트리의 나머지(22:45)와
일치하지 않는다. 내용은 무손실이지만(위 표) mtime 은 이 36개에 대해 신뢰할 수 있는 출처
신호가 아니게 되었다. 이후 이 파일들을 증거로 인용할 때는 타임스탬프가 아니라 내용 해시를
근거로 삼아야 한다.

### (b) 루트 날짜 폴더의 추적 대상 → 소유 레인 통합 → [OBSERVED] (완료 확인)

**최초 기록 시점(01:11)에는 미완성이었다** — 당시 세 트리가 모두 존속했다(루트 wellmade 1개,
루트 stage1b 434개, 아카이브 stage1b 245개). 그 시점의 판정은 [INFERENCE]였다.

이후 `WorkspacePathMigration` 레인이 이동을 수행했고, 재확인 결과 **(b)는 완료됐다.**
비무시 14개 전부가 소유 레인으로 이동한 것을 경로로 확인했다:

| 이동 대상 | 도착 경로 [OBSERVED] |
|---|---|
| `qa/stage-runtime-proof/` 11개 (PNG 10 + 요약 1) | `_workspace/current/qa/stage-runtime-proof/` (11개) |
| `qa/stage-playtime-doctrine.json`, `...-verification.md` | `_workspace/current/qa/` |
| `blender/textures/a9d039b5...._shaded.png` | `_workspace/current/engineering/blender/textures/` |
| wellmade `qa/evidence/data/motion.json` | `_workspace/current/qa/evidence/data/` |

트리 종료 상태:

| 트리 | 기록 시점 | 현재 [OBSERVED] |
|---|---|---|
| `_workspace/20260725-wellmade-verification/` | 1개 | **소멸(ABSENT)** — V1 해소 |
| `_workspace/20260726-stage1b-cinder-pressure-agency/` | 434개 | **1개** — 잔존물은 `engineering/blender/abyssal-surge-stage-gallery-v01.blend1`, §2.3에서 local-only scratch 로 분류한 무시 대상 |
| `_workspace/archive/20260726-stage1b-cinder-pressure-agency/` | 245개 | **245개 (불변)** |

#### 내가 표시한 위험은 실제로 회피됐다 [OBSERVED]

최초 기록에서 "`qa/stage-runtime-proof/` 11개는 단순 이동으로 끝나지 않는다 — 루트 쪽이 더
최신이므로 아카이브 사본을 덮어쓰면 §1 불변성을 다시 깨뜨린다"고 표시했다. 검증 결과 그
덮어쓰기는 일어나지 않았다:

| 사본 | `generatedAt` | 크기 |
|---|---|---|
| `archive/.../qa/stage-runtime-proof/stage-runtime-summary.json` | `2026-07-27T20:37:19.464Z` (원본 유지) | 47,086 B |
| `current/qa/stage-runtime-proof/stage-runtime-summary.json` | `2026-07-28T14:30:40.212Z` (최신) | 52,943 B |

아카이브 사본은 원래 타임스탬프를 그대로 유지하고, 최신 증거는 `current/` 소유 레인에 놓였다.
아카이브 트리 총계도 245개로 변동 없다. **최신 증거 보존과 아카이브 불변성이 동시에 충족된
유일한 처리가 실제로 적용됐다.**

### (c) 생성물·후보 레인·`__pycache__` 는 로컬 유지, 미승격 → [OBSERVED] (선언 기준)

420개가 `.gitignore` 선언에 걸린다는 사실은 관측됐다(§2.3). §1의 "Generated/local material
... is not shared source of truth. Do not promote it without an explicit
provenance/rights/runtime receipt" 에 따라 이 420개는 승격되지 않고 로컬에 남는다.
승격 영수증이 첨부된 항목은 0건이다. 무시 선언과 실제 인덱스 상태의 일치 여부는 Git 없이
확인할 수 없으므로 그 부분은 [INFERENCE].

---

## 4. Prior-session material left untouched — 타 세션 작업 보존

[INFERENCE] — 이 레인은 Git을 호출할 수 없어 인덱스를 직접 확인하지 못했다. 아래는 배치
컨텍스트에서 주어진 전제다.

선행 세션이 Git 인덱스에 슬라이스 2 전투 작업을 스테이지된 상태로 남겼다. 대상:
`app.js`, `defense-catalog.js`, `defense-run-simulation.js`, `battle-realtime-three.js`,
`stage-world-catalog.js`, 그리고 테스트 4개.

CLAUDE.md §5는 이 작업의 흡수·폐기를 금지한다:

> "Stage with explicit pathspecs only. Never `git add -A`, `git add .`, broad wildcard
> staging, or a cleanup/reset that absorbs unrelated work."

> "Never restore, discard, or force-overwrite another session's changes. On collision:
> stop, document, resolve explicitly."

따라서 부모 세션은 **명시적 pathspec 만으로 커밋한다.** 정규화 작업이 위 6+4개 경로를
스테이징 범위에 끌어들이지 않으며, 선행 세션의 스테이지된 변경은 손대지 않은 채 남는다.
§5는 커밋 직전 `git status --short` 재확인도 요구한다("Run `git status --short` before edits
and again immediately before committing").

---

## 5. 재발 메커니즘 — 코드가 위반을 자동 생성한다 [OBSERVED]

V6의 근거. 최초 제보는 `Stage1Audit` 레인이며, 아래는 직접 파일을 읽어 재확인한 결과다.

날짜 루트 경로를 문자열로 참조하는 파일 **35개** (`tests/`, `scripts/` 실측). 그중 같은
파일 안에 디렉터리/파일 생성 호출(`mkdirSync`/`mkdir(`/`writeFile`/`makedirs`/`mkdir -p`)이
있는 것이 **22개**, 참조만 하는 것이 **13개**(9개는 `scripts/__pycache__/*.pyc`).

날짜 루트에 **직접 생성**하는 것이 확인된 6개:

| 파일:행 | 동작 |
|---|---|
| `tests/stage-runtime-proof-browser.test.mjs:26` | `OUTPUT_DIR = ROOT + "_workspace/20260726-stage1b-cinder-pressure-agency/qa/stage-runtime-proof"`, `:350` `await mkdir(OUTPUT_DIR, { recursive: true })`, `:159` PNG 기록, `:373` 요약 기록 |
| `scripts/qa-motion-probe.mjs:19-21` | `DATA = .../20260725-wellmade-verification/qa/evidence/data`, `:21` `mkdirSync(DATA, {recursive:true})`, `:179` `motion.json` 기록 |
| `scripts/qa-actor-readability-probe.mjs:26,29-30` | `OUT = .../20260725-wellmade-verification/qa/evidence`, `mkdirSync` 2회 |
| `scripts/qa-visual-verification.mjs:26,29-30` | 동일 경로, `mkdirSync` 2회 |
| `scripts/qa-clip-track-census.mjs:19` | 같은 `data/` 에 `clip-track-census.json` 기록 |
| `scripts/qa-idle-track-probe.mjs:12` | 같은 `data/` 에 `idle-tracks.json` 기록 |
| `scripts/audit-stage-scenes.mjs:8` | `OUTPUT_PATH` 가 날짜 루트, `:500` `writeFileSync`. 단 `:10` 은 `_workspace/archive/...` 를 올바로 읽는다 — **한 파일이 읽기는 아카이브, 쓰기는 위반 경로** |

인과가 수량으로 닫힌다:

- **wellmade 폴더**: 폴더 내용이 정확히 `qa/evidence/data/motion.json` 1개이고,
  `qa-motion-probe.mjs:19` 가 그 디렉터리를, `:179` 가 그 파일명을 만든다. 1:1 일치 —
  폴더 전체가 스크립트 재생성물이다.
- **stage1b 루트의 비무시 14개 중 11개**: `qa/stage-runtime-proof/NN-<stageId>.png` 10개 +
  `stage-runtime-summary.json` 1개. 테스트 `:159` 가 `${NN}-${stage.id}.png` 를, `:27`/`:373`
  이 요약을 같은 디렉터리에 쓴다. 11:11 일치. §2.2의 `generatedAt` 2026-07-28T14:30Z
  (아카이브 07-27T20:37Z 보다 최신)가 오늘 실행 사실과 정합한다.

**따라서 루트 날짜 폴더는 잃어버린 작업이 아니라 재생성 출력이다.** 그리고 이 상수들을
고치지 않으면 정규화는 다음 브라우저 테스트 실행에서 즉시 회귀한다. 부모 세션이 고쳐야 할
결함으로 기록한다 — 이 레인은 소스를 수정하지 않았다.

---

## 6. Standing rule — 재발 방지 규칙

> **`_workspace/` 직하위에 허용되는 항목은 `current/` 와 `archive/<run-id>/` 뿐이다.
> 산출물 경로를 새로 쓰거나 고칠 때는 `_workspace/current/<lane>/` 로 향하게 하고, 날짜
> run-id 를 코드·테스트·스크립트 상수에 박지 마라 — 날짜 폴더는 손으로 만드는 것이 아니라
> 하드코딩된 출력 경로가 자동으로 만들며(`tests/stage-runtime-proof-browser.test.mjs:26`,
> `scripts/qa-*.mjs`), 지우기만 하면 다음 실행에서 되돌아온다. 루트에 날짜 폴더가 보이면
> 지우기 전에 먼저 그것을 만든 상수를 찾아라.**

---

## 7. 이 레인이 하지 않은 일

- Git 명령 0회. `add`/`commit`/`push`/`mv`/`restore`/`stash`/`status` 모두 미실행.
- 파일시스템 변경은 이 문서와 `production/task-manifest.md` 추가 1건뿐. 이동·삭제·복원 0건.
- `_workspace/archive/**` 는 읽기만 했다. 소스 파일 수정 0건.
- 포매터·린터·테스트 스위트 미실행.
