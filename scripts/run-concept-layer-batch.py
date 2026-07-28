#!/usr/bin/env python3
"""Drive separate-concept-layers.py across the whole concept lane.

Classification is by concept id, not by guesswork:

  terrain-*                 -> terrain / background-terrain / terrain-feature / background-object
  known prop/equipment ids  -> prop            (pedestal-excluded standalone plate)
  everything else           -> character / weapon / accessory

The character plate of a keyable concept costs nothing (deterministic key), so
the key pass runs first and completes for every asset before a single model call
is made. That way a failure in the expensive pass never leaves the cheap pass
half-done.

State lives in `<out-dir>/batch-state.json` and is consulted on every run, so an
interrupted batch resumes instead of re-billing finished layers.

  # classify + count, write nothing
  python3 scripts/run-concept-layer-batch.py --out-dir <lane> --plan

  # free deterministic pass only
  python3 scripts/run-concept-layer-batch.py --out-dir <lane> --key-pass

  # expensive pass, resumable
  python3 scripts/run-concept-layer-batch.py --out-dir <lane> --gen-pass
"""
import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SEPARATOR = REPO / "scripts/separate-concept-layers.py"
CONCEPT_ROOT = REPO / "assets/images/battle/pilot"

PROP_IDS = {
    "concept-abyssal-banner", "concept-anchor-shard", "concept-bulwark-brand",
    "concept-choir-ward-crystal", "concept-dawnless-crown", "concept-equipment-tier-gems",
    "concept-rift-lens", "concept-stillwater-hourglass", "concept-warden-lantern",
}
# Superseded concept iterations: keeping them would multiply the batch by ~3x for
# characters that already have a chosen final plate.
SUPERSEDED_SUFFIXES = ("-v01", "-v02", "-v03")
# Derived sheets that live in the concept dir but are not concepts: an albedo
# texture sheet and gti refstyle renders. Separating them would produce layers
# of a texture, which is meaningless.
NON_CONCEPT_IDS = {
    "dusk-warden-cartoon-albedo", "dusk-warden-idle-gti", "dusk-warden-idle-gti-refstyle",
}

LAYERS = {
    "terrain": ["terrain", "background-terrain", "terrain-feature", "background-object"],
    "prop": ["prop"],
    "character": ["full-plate", "character", "weapon", "accessory"],
}
# Landscape sources get landscape output; portrait character plates stay portrait.
SIZE = {"terrain": "1536x1024", "prop": "1536x1024", "character": "1024x1536"}


def classify(concept_id):
    if concept_id.startswith("concept-terrain-"):
        return "terrain"
    if concept_id in PROP_IDS:
        return "prop"
    return "character"


def is_superseded(concept_id, all_ids):
    """Drop -v01..-v03 when a -v04 (or bare id) sibling exists."""
    for suffix in SUPERSEDED_SUFFIXES:
        if concept_id.endswith(suffix):
            stem = concept_id[: -len(suffix)]
            if f"{stem}-v04" in all_ids or stem in all_ids:
                return True
    return False


def inventory():
    ids = sorted(p.stem for p in CONCEPT_ROOT.glob("*.png"))
    idset = set(ids)
    out = []
    for cid in ids:
        if cid in NON_CONCEPT_IDS or is_superseded(cid, idset):
            continue
        kind = classify(cid)
        asset_id = cid[len("concept-"):] if cid.startswith("concept-") else cid
        out.append({
            "conceptId": cid,
            "assetId": asset_id,
            "kind": kind,
            "concept": str(CONCEPT_ROOT / f"{cid}.png"),
            "layers": LAYERS[kind],
            "size": SIZE[kind],
        })
    return out


def load_state(path):
    if path.exists():
        return json.loads(path.read_text())
    return {"schemaVersion": 1, "done": {}, "failed": {}}


def save_state(path, state):
    state["updatedAt"] = datetime.now(timezone.utc).isoformat()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2))


def run_asset(item, out_dir, layers, allow_generate):
    cmd = [sys.executable, str(SEPARATOR),
           "--concept", item["concept"],
           "--asset-id", item["assetId"],
           "--out-dir", str(out_dir),
           "--layers", ",".join(layers),
           "--size", item["size"]]
    if allow_generate:
        cmd.append("--allow-generate")
    proc = subprocess.run(cmd, capture_output=True, text=True)
    statuses = {}
    for line in proc.stdout.splitlines():
        line = line.strip()
        if line.startswith("{"):
            try:
                statuses = json.loads(line).get("layers", {})
            except json.JSONDecodeError:
                pass
    return proc.returncode, statuses, proc.stderr[-800:]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--out-dir", required=True)
    p.add_argument("--plan", action="store_true")
    p.add_argument("--key-pass", action="store_true")
    p.add_argument("--gen-pass", action="store_true")
    p.add_argument("--only-kind", choices=("terrain", "prop", "character"))
    p.add_argument("--limit", type=int, default=0)
    args = p.parse_args()

    out_dir = Path(args.out_dir)
    if not out_dir.is_absolute():
        out_dir = REPO / out_dir
    state_path = out_dir / "batch-state.json"

    items = inventory()
    if args.only_kind:
        items = [i for i in items if i["kind"] == args.only_kind]

    if args.plan:
        from collections import Counter
        kinds = Counter(i["kind"] for i in items)
        gen_calls = sum(len([l for l in i["layers"] if not (i["kind"] == "character" and l == "character")])
                        for i in items)
        print(json.dumps({
            "concepts": len(items),
            "byKind": dict(kinds),
            "freeKeyPlates": sum(1 for i in items if i["kind"] == "character"),
            "generatedLayers": gen_calls,
            "estimatedMinutes": round(gen_calls * 75 / 60),
        }, indent=2))
        for i in items:
            print(f"  {i['assetId']:34} {i['kind']:10} {','.join(i['layers'])}")
        return 0

    state = load_state(state_path)
    if args.limit:
        items = items[: args.limit]

    for n, item in enumerate(items, 1):
        aid = item["assetId"]
        done = set(state["done"].get(aid, []))
        if args.key_pass:
            layers = ["full-plate"] if item["kind"] == "character" else []
            allow = False
        else:
            # Every layer the key pass could not produce falls through to here,
            # including the character plate of a concept that was drawn on a
            # full-bleed background and therefore has nothing to key against.
            layers = list(item["layers"])
            allow = True
        layers = [l for l in layers if l not in done]
        if not layers:
            print(f"[{n}/{len(items)}] {aid:34} skip (done)")
            continue

        rc, statuses, err = run_asset(item, out_dir, layers, allow)
        ok = [l for l, s in statuses.items() if s in ("keyed", "generated+keyed")]
        # "needs-generate" is the key pass correctly declining an unkeyable
        # concept, not a failure -- the gen pass owns those layers.
        deferred = [l for l, s in statuses.items()
                    if s in ("skipped:needs-generate", "skipped:not-applicable")]
        bad = [l for l, s in statuses.items() if l not in ok and l not in deferred]
        state["done"][aid] = sorted(done | set(ok))
        if bad or rc != 0:
            state["failed"][aid] = {"layers": bad, "rc": rc, "stderr": err}
        elif aid in state["failed"]:
            del state["failed"][aid]
        save_state(state_path, state)
        tail = f" deferred={deferred}" if deferred else ""
        print(f"[{n}/{len(items)}] {aid:34} ok={ok} bad={bad}{tail}", flush=True)

    print(json.dumps({
        "assetsDone": len(state["done"]),
        "assetsFailed": len(state["failed"]),
        "state": str(state_path),
    }))
    return 0


if __name__ == "__main__":
    sys.exit(main())
