"""Blender headless: render a model as an 8-direction dimetric sprite sheet.

Implements the report's 3D->2D pre-rendered sprite pipeline:
- orthographic camera (no perspective shortening, parallel projection)
- dimetric pitch ~60 deg from vertical (2:1 screen ratio), yaw stepped 45 deg
- camera orbit is centered on the model origin (root lock: the camera rig is
  parented to a pivot at the origin, so animation drift cannot shift the
  visual bounding center)
- outputs 8 frames named dir{0..7}.png; combine into an atlas afterwards:
    ffmpeg -i dir%d.png -filter_complex tile=8x1 atlas.png  (or ImageMagick montage)

Usage:
  Blender --background <file.blend> --python scripts/render-8dir-atlas.py -- \
      --out /abs/dir --size 256
"""

import math
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
out_dir = "/tmp/atlas"
size = 256
for i, arg in enumerate(argv):
    if arg == "--out" and i + 1 < len(argv):
        out_dir = argv[i + 1]
    if arg == "--size" and i + 1 < len(argv):
        size = int(argv[i + 1])

scene = bpy.context.scene

# Pivot at origin; camera parented to it -> orbit = rotate pivot yaw only.
pivot = bpy.data.objects.new("atlas_pivot", None)
bpy.context.collection.objects.link(pivot)

cam_data = bpy.data.cameras.new("atlas_cam")
cam_data.type = "ORTHO"
# Fit ortho scale to scene bounds (simple heuristic: max object dimension * 1.6)
max_dim = 4.0
for obj in bpy.context.collection.objects:
    if obj.type == "MESH":
        max_dim = max(max_dim, max(obj.dimensions))
cam_data.ortho_scale = max_dim * 1.6

cam = bpy.data.objects.new("atlas_cam", cam_data)
bpy.context.collection.objects.link(cam)
cam.parent = pivot

# Dimetric attitude: pitch 60 deg from vertical (30 deg elevation look-down
# yields the 2:1 vertical squash), distance is irrelevant for ortho.
distance = max_dim * 4
pitch = math.radians(60)
cam.location = (0, -distance * math.sin(pitch), distance * math.cos(pitch))
cam.rotation_euler = (pitch, 0, 0)
scene.camera = cam

scene.render.resolution_x = size
scene.render.resolution_y = size
scene.render.film_transparent = True
try:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
except Exception:
    scene.render.engine = "BLENDER_EEVEE"

for direction in range(8):
    pivot.rotation_euler = (0, 0, math.radians(45 * direction))
    scene.render.filepath = f"{out_dir}/dir{direction}.png"
    bpy.ops.render.render(write_still=True)

print(f"ATLAS_RESULT dirs=8 size={size} out={out_dir} ortho_scale={cam_data.ortho_scale:.2f}")
