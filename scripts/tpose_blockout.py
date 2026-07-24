#!/usr/bin/env python3
"""
Parametric T-pose humanoid blockout generator + Rodin bbox-condition submit
helper.

Two uses:
1. As a Rodin "BoundingBox ControlNet" condition mesh submitted alongside a
   character concept image -- biases generation toward a proper bind-ready
   T-pose (arms horizontal, legs shoulder-width, standing straight) instead
   of whatever dynamic pose the concept art shows. This is the intended path
   per the Rodin UI's own "Click T/A pose button for direct T/A pose assets"
   feature.
2. As a standalone proportional reference for the Rigify metarig-fit step in
   scripts/rig-and-animate-asset-blender.py, when no T-pose condition was
   used at generation time and the resulting mesh is in an arbitrary pose.

Run inside Blender (interactive MCP or --background --python).
"""
import bmesh
import bpy


def build_tpose_blockout(name="tpose_blockout", height=1.8):
    """Low-poly humanoid blockout in bind T-pose: arms fully horizontal at
    shoulder height, legs shoulder-width apart, standing straight, 8-head-tall
    proportions (matches Rigify's own default metarig scaling assumption).
    Returns the created mesh object, origin at ground level (world Z=0)."""
    h = height
    bm = bmesh.new()

    def add_box(center, size):
        cx, cy, cz = center
        sx, sy, sz = size
        v = bmesh.ops.create_cube(bm, size=1.0)
        for vert in v["verts"]:
            vert.co.x = vert.co.x * sx + cx
            vert.co.y = vert.co.y * sy + cy
            vert.co.z = vert.co.z * sz + cz

    head_h = h * 0.125
    neck_h = h * 0.03
    torso_h = h * 0.30
    pelvis_h = h * 0.08
    upper_leg_h = h * 0.25
    lower_leg_h = h * 0.22
    foot_h = h * 0.04

    lower_leg_z = lower_leg_h / 2
    upper_leg_z = lower_leg_h + upper_leg_h / 2
    pelvis_z = lower_leg_h + upper_leg_h + pelvis_h / 2
    torso_z = pelvis_z + pelvis_h / 2 + torso_h / 2
    neck_z = torso_z + torso_h / 2 + neck_h / 2
    head_z = neck_z + neck_h / 2 + head_h / 2

    leg_spacing = h * 0.10
    leg_w, leg_d = h * 0.09, h * 0.09
    foot_len = h * 0.15

    for side in (-1, 1):
        sx = side * leg_spacing
        add_box((sx, foot_len * 0.15, foot_h / 2), (leg_w, foot_len, foot_h))
        add_box((sx, 0, lower_leg_z + foot_h), (leg_w * 0.85, leg_d * 0.85, lower_leg_h))
        add_box((sx, 0, upper_leg_z + foot_h), (leg_w, leg_d, upper_leg_h))

    add_box((0, 0, pelvis_z + foot_h), (h * 0.24, h * 0.14, pelvis_h))
    add_box((0, 0, torso_z + foot_h), (h * 0.26, h * 0.15, torso_h))
    add_box((0, 0, neck_z + foot_h), (h * 0.06, h * 0.06, neck_h))
    add_box((0, 0, head_z + foot_h), (h * 0.11, h * 0.12, head_h))

    shoulder_z = torso_z + torso_h * 0.38 + foot_h
    shoulder_x = h * 0.16
    upper_arm_len = h * 0.19
    lower_arm_len = h * 0.17
    hand_len = h * 0.09
    arm_w = h * 0.055

    for side in (-1, 1):
        ua_center_x = side * (shoulder_x + upper_arm_len / 2)
        add_box((ua_center_x, 0, shoulder_z), (upper_arm_len, arm_w, arm_w))
        fa_center_x = side * (shoulder_x + upper_arm_len + lower_arm_len / 2)
        add_box((fa_center_x, 0, shoulder_z), (lower_arm_len, arm_w * 0.85, arm_w * 0.85))
        hand_center_x = side * (shoulder_x + upper_arm_len + lower_arm_len + hand_len / 2)
        add_box((hand_center_x, 0, shoulder_z), (hand_len, arm_w * 0.7, arm_w * 0.5))

    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def submit_with_tpose_condition(concept_png_path, height=1.8, condition_type="bbox"):
    """Build a T-pose blockout, load the concept PNG, and submit a Rodin
    generation task with BOTH: image (style/silhouette source) + bbox
    condition mesh (T-pose bind-pose bias). Mirrors the manual workflow
    exposed by Rodin's own 'BoundingBox ControlNet' + image upload UI.

    Requires: RodinBridge addon registered (bpy.ops.rodin.submit available),
    Safari/Chrome patched per design/previs-rigging-guide.md connectivity
    notes, hyper3d.ai session logged in.
    """
    blockout = build_tpose_blockout(name="tpose_condition_mesh", height=height)

    img = bpy.data.images.load(concept_png_path, check_existing=True)
    prop = bpy.context.scene.rodin_prop
    while len(prop.images) > 0:
        prop.images.remove(0)
    slot = prop.images.add()
    slot.image = img

    prop.condition_type = condition_type  # 'bbox' | 'voxel' | 'pointCloud'
    prop.textTo = "Image"

    bpy.ops.object.select_all(action="DESELECT")
    blockout.select_set(True)
    bpy.context.view_layer.objects.active = blockout

    poll_ok = bpy.ops.rodin.submit.poll()
    if not poll_ok:
        return {"status": "poll_failed", "blockout": blockout.name}

    result = bpy.ops.rodin.submit()
    return {"status": "submitted", "operatorResult": list(result), "blockout": blockout.name}


if __name__ == "__main__":
    # smoke-test: build the blockout only (no submit) when run standalone
    obj = build_tpose_blockout()
    print(f"Built {obj.name}: {len(obj.data.vertices)} verts, dims={list(obj.dimensions)}")
