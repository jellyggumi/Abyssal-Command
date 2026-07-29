# FBX Parser Defect Report

**Date:** 2026-07-29  
**Tool:** `scripts/extract-fbx-metadata.py`  
**Status:** Non-functional for motion-bench dataset

## Defect

Standalone binary FBX parser (based on struct-level magic header + node tree parsing) returns "Invalid FBX magic header" for all 42/42 Mixamo FBX files, despite:
- Files confirmed to be valid FBX (Blender imports them successfully)
- Binary magic header `Kaydara FBX Binary\x00` present in all files (confirmed by `od -c`)

## Root Cause

**Hypothesis:** The parser may be confused by:
1. FBX version or node structure variants (FBX 7.x differences)
2. Incorrect offset calculation for header end
3. Endianness assumption mismatch
4. Mixamo-specific FBX wrapping (additional pre-header data)

## Verification

```bash
# Confirmed: All 42 files have valid FBX magic
od -c assets/motion/bench/Walking.fbx | head -2
# 0000000   K   a   y   d   a   r   a       F   B   X       B   i   n   a   r   y  \0
```

## Resolution

**Action:** DEPRECATE `scripts/extract-fbx-metadata.py`  
**Alternative:** Use Blender import-based analysis exclusively:
- `scripts/rig-and-animate-asset-blender.py` (headless)
- `scripts/audit-fbx-motion-bench.py` (with `--output json`)
- Manual Blender import + inspection (for one-offs)

## Impact

- Motion bench analysis is **NOT BLOCKED** (Blender import confirmed working)
- Retarget pipeline unaffected (already uses Blender)
- Dry-run inventory in `fbx-audit-report.json` is based on filename classification, not FBX parse

## Future Work

If binary FBX parsing is needed for performance/automation:
1. Use proven library: `pip install pyfbx` (if available) or Autodesk FBX SDK
2. Test against Mixamo FBX 7.4.0+ spec
3. Add pre-flight validation in parser (e.g., `assert file.magic == "Kaydara..."`)
