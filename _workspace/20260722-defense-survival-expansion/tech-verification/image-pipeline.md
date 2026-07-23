# Dusk Warden image-pipeline verification

## Verdict

**BLOCKED FOR RUNTIME — the required PerfectPixel pilot did not run.** A prior direct GTI generation succeeded and produced a provenance-validated 1536×1024 concept PNG matching the 2.5D Dusk Warden/magenta-matte brief; a later retry failed with HTTP 429 and did not overwrite that asset. Runtime ingestion remains denied because generated-output rights review is pending and PerfectPixel still lacks the required provider adapter and `extractMethod: none`/no-pixel-processing path. Existing battle art remains untouched and the full-state batch was not started.

Evidence: `assets/images/battle/pilot/blocked-verification.json`, `assets/images/battle/pilot/dusk-warden-idle-gti.png`, `assets/images/battle/pilot/dusk-warden-idle-gti.provenance.json`, and this report.

## Frozen pilot request

- Subject/state: Dusk Warden, `idle` only.
- Generator/provider/model: PerfectPixel `ppgen` / `god-tibo-imagen` / `gpt-5.4`.
- Processing contract: `extractMethod: none`; no background removal, frame extraction, palette quantization, or pixel-art conversion.
- Presentation contract: original dark-fantasy 2.5D character art on a perfectly solid `#FF00FF` matte; no magenta, pink, or purple character colors.
- Requested provider output: PNG, 1024×1024.
- Prompt: “Dusk Warden, an original dark-fantasy 2.5D defense RPG guardian in blackened steel and ash-gray layered cloth, moonless silver edge accents, readable three-quarter isometric silhouette, braced idle combat stance, grounded proportions, no text, no logos, no copyrighted character likeness, no magenta pink or purple on the character. Render on a perfectly flat solid #FF00FF magenta matte with no shadows gradients texture glow or spill. Preserve smooth painterly 2.5D art; do not convert to pixel art, do not quantize, and do not remove the matte. One idle state pilot only.”

## Observed execution

At `2026-07-22T08:38:46Z`, the required workflow was invoked with:

```text
/Users/jangyoung/.claude/skills/perfectpixel/bin/ppgen -provider god-tibo-imagen -model gpt-5.4 -key [REDACTED_DUMMY] -desc [FROZEN_PROMPT_ABOVE] -style cartoon -states idle -attempts 1 -out /Users/jangyoung/orca/Abyssal-Surge/assets/images/battle/pilot/dusk-warden-idle -json
```

It exited `1` before creating the output directory or submitting an image request:

```text
ppgen 실패: 지원하지 않는 프로바이더입니다: god-tibo-imagen
```

The installed `ppgen -help` provider list is `gemini|openrouter|fal|byteplus`. Its source registry also lacks `god-tibo-imagen`. A no-cost `gti --dry-run` accepted provider `private-codex`, model `gpt-5.4`, the frozen prompt, and PNG size `1024x1024` for `https://chatgpt.com/backend-api/codex/responses`. That dry-run proved only that the provider request shape could be formed. The successful direct GTI concept generation recorded below is a separate result and is not a PerfectPixel result.

A second hard blocker exists even if provider registration is added: this `ppgen` has no extract-method option. Its current pipeline unconditionally calls background removal for the base and state strip, extracts frames, and calls pixel post-processing. It therefore cannot truthfully produce `extractMethod: none` with no pixel-art conversion.

## Provenance gate

### Required PerfectPixel attempt

| field | observed value |
|---|---|
| provider | `god-tibo-imagen` requested; rejected by PerfectPixel |
| model | `gpt-5.4` requested |
| prompt | frozen verbatim above and in the JSON evidence |
| request/job reference | none — request never submitted |
| output SHA-256 | none — no output exists |
| generated-output license | none — no output exists |
| output dimensions | none — no output exists; 1024×1024 was requested only |
| generator software license | MIT |
| runtime ingestion | denied |

No field is inferred from a nonexistent result. A valid follow-up must first expose a PerfectPixel `god-tibo-imagen` adapter and a true `extractMethod: none` path, then rerun this single-state pilot, capture the provider request/job reference, verify solid-matte and 2.5D visual quality, compute SHA-256, record the output license and decoded dimensions, and only then consider full-state generation.

## Direct GTI concept — successful generation, failed later retry

The prior direct GTI generation succeeded. Its provenance JSON records provider `private-codex`, model `gpt-5.4`, response ID `resp_079851467cc87389016a60822eb3808191a64e916adf194674`, and session ID `4c2263a3-b31e-4362-b94a-1719710bcae3`; the repository provenance validator passed for those identifiers, the file digest, and decoded dimensions. A later `gti --prompt … --output assets/images/battle/pilot/dusk-warden-idle-gti.png --debug` retry exited nonzero after HTTP 429 and did not overwrite the earlier asset.

| field | observed value |
|---|---|
| generator/provider/model | direct `god-tibo-imagen` / `private-codex` / `gpt-5.4` |
| PerfectPixel generated | no |
| successful request reference | `resp_079851467cc87389016a60822eb3808191a64e916adf194674` |
| successful session reference | `4c2263a3-b31e-4362-b94a-1719710bcae3` |
| later retry status | failed; HTTP 429; nonzero exit; earlier PNG preserved |
| output path | `assets/images/battle/pilot/dusk-warden-idle-gti.png` |
| decoded format | PNG, 8-bit RGB, non-interlaced |
| decoded dimensions | 1536×1024 |
| bytes | 1,955,612 |
| SHA-256 | `4973ac1058c81375f477b80232eaa8de304c5236b0c1ebd1002dcc6edb93d291` |
| visual inspection | original dark-fantasy 2.5D full-body Dusk Warden on a uniform magenta matte |
| generated-output license | `pending-runtime-rights-review` |
| runtime ingestion | denied; concept only |

The two command outcomes are not conflated: the provenance-validated concept PNG comes from the successful prior generation, while the later retry is a separate failed request. Runtime remains blocked by pending rights review and the missing PerfectPixel provider/processing path, not by missing GTI request provenance.
