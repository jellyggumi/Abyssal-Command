# Blender resource-pack verification

## Verdict

**PASS for offline Blender readability/import; NOT VERIFIED for browser runtime loading.** Blender 5.1.2 opened the `.blend` and imported the `.glb` non-destructively in background mode. Both operations returned `FINISHED` with 101 objects, 42 actions, and one scene. No file was saved during verification.

## Artifacts

| artifact | exact path | bytes | SHA-256 |
|---|---|---:|---|
| Blender source | `/Users/jangyoung/orca/Abyssal-Surge/assets/models/abyssal-command/abyssal-command-resource-pack.blend` | 197,491 | `5ea58be5dcfee1e2c89fc41102f53f5fad61d1da4a58ad28dbb6b2690ab091c4` |
| Binary glTF export | `/Users/jangyoung/orca/Abyssal-Surge/assets/models/abyssal-command/abyssal-command-resource-pack.glb` | 351,356 | `513eb59431c1277874343270a1685aedb751d5343c352f165f9fd71649930a61` |

`file` identified the `.blend` as Zstandard-compressed data and the `.glb` as glTF binary version 2 with declared length 351,356 bytes.

## Independent method

Binary/version check:

```text
/Applications/Blender.app/Contents/MacOS/Blender --version
```

Observed: Blender `5.1.2`, Darwin release build, hash `ec6e62d40fa9`.

Non-destructive read/import probe:

```text
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python /tmp/verify_abyssal_resource_pack.py
```

The transient probe performed these operations without saving:

1. `bpy.ops.wm.open_mainfile(filepath=<exact .blend path>)` → `FINISHED`; `len(bpy.data.objects) == 101`; `len(bpy.data.actions) == 42`; one scene.
2. `bpy.ops.wm.read_factory_settings(use_empty=True)` to clear the in-memory source scene.
3. `bpy.ops.import_scene.gltf(filepath=<exact .glb path>)` → `FINISHED`; `len(bpy.data.objects) == 101`; `len(bpy.data.actions) == 42`; one scene.

Blender logged `Read blend` for the source and `glTF import finished in 0.07s` for the export. The process exited `0`.

## Runtime status

The files are valid offline authoring/export artifacts. This verification did not exercise any browser loader, renderer code, service-worker path, deployment path, material fidelity, animation playback, pivots, or texture completeness. They remain **not proven runtime-loaded** and must not be described as browser-shipped 2.5D content until a runtime load/fallback check observes them.
