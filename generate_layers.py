import json
import subprocess
import time
import sys
import threading
from datetime import datetime, timezone
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

REPO = Path(__file__).resolve().parent
OUT_DIR = REPO / "_workspace/current/engineering/asset-pipeline/concept-layers"
state_path = OUT_DIR / "batch-state.json"

assets_to_process = [
    "ui-currency-bound-fragment",
    "ui-currency-echo-core",
    "ui-lobby-command-plate",
    "ui-nav-companions",
    "ui-nav-growth",
    "ui-nav-inventory",
    "ui-nav-sortie",
    "ui-nav-stronghold",
    "ui-seal-atlas-plate",
    "ui-stat-commander",
    "ui-stat-echo-xp",
    "ui-stat-gate-integrity"
]

# Load state
if state_path.exists():
    state = json.loads(state_path.read_text())
else:
    state = {"schemaVersion": 1, "done": {}, "failed": {}}

state_lock = threading.Lock()

def process_asset(asset_id, max_retries=3, delay=60):
    concept_path = REPO / f"assets/images/battle/pilot/concept-{asset_id}.png"
    cmd = [
        sys.executable,
        str(REPO / "scripts/separate-concept-layers.py"),
        "--concept", str(concept_path),
        "--asset-id", asset_id,
        "--out-dir", str(OUT_DIR),
        "--layers", "character,weapon,accessory",
        "--size", "1024x1536",
        "--allow-generate"
    ]
    
    for attempt in range(1, max_retries + 1):
        print(f"[{asset_id}] Attempt {attempt}/{max_retries} starting...", flush=True)
        proc = subprocess.run(cmd, capture_output=True, text=True)
        
        layers_json_path = OUT_DIR / asset_id / f"{asset_id}.layers.json"
        
        # Check success of the attempt
        attempt_ok = False
        statuses = {}
        err_msg = ""
        
        if proc.returncode == 0 and layers_json_path.exists():
            try:
                report = json.loads(layers_json_path.read_text())
                statuses = {lyr["layer"]: lyr["status"] for lyr in report.get("layers", [])}
                
                failed_layers = []
                for lyr, status in statuses.items():
                    if lyr in ("character", "weapon", "accessory"):
                        if status not in ("generated+keyed", "skipped:not-applicable"):
                            failed_layers.append(lyr)
                            
                if not failed_layers:
                    attempt_ok = True
                else:
                    err_msg = f"Failed layers: {failed_layers}"
            except Exception as e:
                err_msg = f"Failed to parse report: {e}"
        else:
            err_msg = f"Exit code {proc.returncode}. Stderr: {proc.stderr[-300:].strip()}"
            
        if attempt_ok:
            try:
                report = json.loads(layers_json_path.read_text())
                statuses = {lyr["layer"]: lyr["status"] for lyr in report.get("layers", [])}
            except:
                pass
            
            with state_lock:
                done = set(state["done"].get(asset_id, []))
                ok_layers = [l for l, s in statuses.items() if s in ("keyed", "generated+keyed")]
                state["done"][asset_id] = sorted(done | set(ok_layers))
                if asset_id in state["failed"]:
                    del state["failed"][asset_id]
                state["updatedAt"] = datetime.now(timezone.utc).isoformat()
                state_path.write_text(json.dumps(state, indent=2))
                
            print(f"[{asset_id}] Succeeded on attempt {attempt}.", flush=True)
            return True, statuses
        else:
            print(f"[{asset_id}] Attempt {attempt} failed: {err_msg}", flush=True)
            if attempt < max_retries:
                print(f"[{asset_id}] Waiting {delay} seconds...", flush=True)
                time.sleep(delay)
                
    with state_lock:
        state["failed"][asset_id] = {
            "layers": ["character", "weapon", "accessory"],
            "rc": proc.returncode,
            "stderr": proc.stderr[-800:]
        }
        state["updatedAt"] = datetime.now(timezone.utc).isoformat()
        state_path.write_text(json.dumps(state, indent=2))
        
    return False, {}

def main():
    print(f"Starting batch of {len(assets_to_process)} assets with 3 workers...", flush=True)
    results = {}
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {executor.submit(process_asset, aid): aid for aid in assets_to_process}
        for fut in as_completed(futures):
            aid = futures[fut]
            try:
                success, statuses = fut.result()
                results[aid] = (success, statuses)
                print(f"Finished {aid}: Success={success}", flush=True)
            except Exception as e:
                results[aid] = (False, {})
                print(f"Exception while processing {aid}: {e}", flush=True)

    print("All tasks finished.", flush=True)
    print(json.dumps({aid: results[aid][0] for aid in results}, indent=2), flush=True)

if __name__ == "__main__":
    main()
