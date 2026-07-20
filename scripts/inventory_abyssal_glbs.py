#!/usr/bin/env python3
"""Inventory mesh objects, materials, textures, and UV layers in all abyssal-command GLBs.

Run from the repository root with Blender (headless):
  /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/inventory_abyssal_glbs.py
"""

from __future__ import annotations

import json
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[1]
MODELS_DIR = ROOT / "assets" / "models" / "abyssal-command"

# Collect all GLBs in order (15 total: 5 units, 3 bosses, 4 props, 3 terrain)
GLBS = sorted(MODELS_DIR.rglob("*.glb"))

INVENTORY = []

def clear_scene():
    """Remove all objects and collections from the scene."""
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        bpy.data.collections.remove(collection)

def inventory_glb(glb_path: Path) -> dict:
    """Load a GLB and inventory its meshes, materials, images, and UV layers."""
    clear_scene()
    
    # Import the GLB
    bpy.ops.import_scene.gltf(filepath=str(glb_path))
    
    asset_name = glb_path.stem
    category = glb_path.parent.name  # units, bosses, props, terrain
    
    record = {
        "asset": asset_name,
        "category": category,
        "path": str(glb_path.relative_to(ROOT)),
        "meshes": [],
        "material_slots_total": 0,
        "materials_unique": 0,
        "images_embedded": 0,
        "images_external": 0,
        "uv_layers_total": 0,
        "meshes_without_images": [],
        "materials_without_images": [],
    }
    
    # Walk all objects in the scene
    material_names_seen = set()
    image_names_seen = set()
    
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        
        mesh = obj.data
        mesh_record = {
            "name": obj.name,
            "vertices": len(mesh.vertices),
            "triangles": len(mesh.polygons),
            "material_slots": len(obj.material_slots),
            "uv_layers": [],
            "images": [],
        }
        
        # Count UV layers
        for uv_layer in mesh.uv_layers:
            mesh_record["uv_layers"].append({
                "name": uv_layer.name,
                "active": uv_layer.active,
            })
        record["uv_layers_total"] += len(mesh.uv_layers)
        
        # Scan materials for image nodes
        has_image = False
        for slot in obj.material_slots:
            if slot.material is None:
                continue
            
            material_names_seen.add(slot.material.name)
            
            # If using nodes, walk the shader tree for image textures
            if slot.material.use_nodes:
                for node in slot.material.node_tree.nodes:
                    if node.type == "TEX_IMAGE" and node.image:
                        image = node.image
                        image_names_seen.add(image.name)
                        
                        # Detect if embedded or external
                        is_embedded = image.packed_file is not None
                        
                        mesh_record["images"].append({
                            "name": image.name,
                            "embedded": is_embedded,
                            "width": image.size[0],
                            "height": image.size[1],
                        })
                        
                        if is_embedded:
                            record["images_embedded"] += 1
                        else:
                            record["images_external"] += 1
                        
                        has_image = True
        
        record["material_slots_total"] += len(obj.material_slots)
        record["meshes"].append(mesh_record)
        
        if not has_image and len(obj.material_slots) > 0:
            record["meshes_without_images"].append(obj.name)
    
    # Count unique materials
    record["materials_unique"] = len(material_names_seen)
    
    # Identify materials with no images
    for material_name in material_names_seen:
        material = bpy.data.materials.get(material_name)
        if material and material.use_nodes:
            has_image_node = False
            for node in material.node_tree.nodes:
                if node.type == "TEX_IMAGE" and node.image:
                    has_image_node = True
                    break
            if not has_image_node:
                record["materials_without_images"].append(material_name)
    
    return record

# Process all GLBs
for glb in GLBS:
    print(f"Processing {glb.name}...", flush=True)
    try:
        inventory = inventory_glb(glb)
        INVENTORY.append(inventory)
        print(f"  ✓ {glb.name}: {len(inventory['meshes'])} meshes, "
              f"{inventory['images_embedded']} embedded images, "
              f"{inventory['images_external']} external images", flush=True)
    except Exception as e:
        print(f"  ✗ {glb.name}: {e}", flush=True)
        INVENTORY.append({
            "asset": glb.stem,
            "category": glb.parent.name,
            "path": str(glb.relative_to(ROOT)),
            "error": str(e),
        })

# Write summary report
output_file = ROOT / "assets" / "models" / "abyssal-command" / "inventory-report.json"
output_file.write_text(json.dumps(INVENTORY, indent=2) + "\n", encoding="utf-8")

print(f"\nINVENTORY_COMPLETE count={len(INVENTORY)} output={output_file}", flush=True)

# Print concise summary per asset
print("\n" + "="*80)
print("SUMMARY BY ASSET")
print("="*80)
for record in sorted(INVENTORY, key=lambda r: (r.get("category", "zzz"), r.get("asset", "zzz"))):
    if "error" in record:
        print(f"{record['asset']:30} ERROR: {record['error']}")
        continue
    
    meshes = len(record["meshes"])
    materials = record["materials_unique"]
    embedded = record["images_embedded"]
    external = record["images_external"]
    no_img = len(record["meshes_without_images"])
    mat_no_img = len(record["materials_without_images"])
    
    status = "✓" if no_img == 0 and mat_no_img == 0 else "⚠"
    print(f"{status} {record['asset']:30} | meshes={meshes:2} mats={materials:2} "
          f"img={embedded:2} emb | {external:1} ext | no-img: {no_img} meshes, {mat_no_img} mats")

print("="*80)
