#!/usr/bin/env python3
"""
Prepare Vox concept-film workspace.
Assembles local torn-paper/halftone collage posters from approved GTI source plates
and maps the canonical beat-map to a Vox-compatible beats.json with manifest.
"""
import os
import sys
import json
import math
import random
import shutil
import argparse
from pathlib import Path
import hashlib
from PIL import Image, ImageDraw, ImageFilter

# Visual constants
CANVAS_WIDTH = 960
CANVAS_HEIGHT = 540

BEAT_BG_COLORS = {
    1: (20, 20, 20),      # Charcoal black
    2: (25, 25, 25),      # Soot charcoal
    3: (15, 20, 25),      # Wet obsidian
    4: (25, 30, 45),      # Desaturated indigo
    5: (40, 20, 50),      # Royal violet
    6: (10, 15, 30)       # Black sea
}

BEAT_PALETTES = {
    1: [(0, 120, 120), (235, 235, 235), (45, 45, 45)],      # Abyss Teal, Lunar White, Charcoal
    2: [(185, 35, 25), (0, 125, 125), (55, 55, 55)],        # Ember Red, Teal, Charcoal
    3: [(0, 120, 120), (215, 110, 25), (35, 35, 40)],       # Teal, Ember Gold, Obsidian
    4: [(45, 95, 95), (55, 65, 105), (135, 55, 175)],       # Desat Teal, Indigo, Violet
    5: [(105, 35, 145), (65, 95, 155), (185, 145, 35)],     # Fading Violet, Cold Blue, Dawnless Gold
    6: [(55, 85, 145), (175, 135, 35), (20, 25, 40)]        # Cold Blue, Dawnless Gold, Sea Black
}

# Derived crops preserve source provenance while excluding the known game-UI regions
# from otherwise approved narrative plates. Values are source-image coordinates.
TEXT_FREE_SOURCE_CROPS = {
    "scene_03_possession_action_v01.jpg": (100, 0, 730, 450),
}

def get_sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as file:
        while chunk := file.read(8192):
            digest.update(chunk)
    return digest.hexdigest()



def crop_text_free_source(src, source_path):
    source_name = Path(source_path).name
    crop_box = TEXT_FREE_SOURCE_CROPS.get(source_name)
    if crop_box is None:
        return src

    left, top, right, bottom = crop_box
    if not (0 <= left < right <= src.width and 0 <= top < bottom <= src.height):
        sys.exit(f"Error: Text-free crop is invalid for source plate '{source_path}'.")

    return src.crop(crop_box)

def source_policy_error(plate_path, beat_id):
    sys.exit(
        f"Error: Source plate '{plate_path}' for Beat {beat_id} must be a file inside approved assets/images."
    )


def resolve_source_plate(repo_root, plate_path, beat_id):
    candidate_path = Path(plate_path)
    if candidate_path.is_absolute():
        source_policy_error(plate_path, beat_id)

    approved_source_root = (repo_root / "assets" / "images").resolve()
    resolved_candidate = (repo_root / candidate_path).resolve()
    try:
        normalized_path = resolved_candidate.relative_to(approved_source_root)
    except ValueError:
        source_policy_error(plate_path, beat_id)

    if not resolved_candidate.is_file():
        sys.exit(f"Error: Source plate missing at '{resolved_candidate}' for Beat {beat_id}.")

    return resolved_candidate, (Path("assets") / "images" / normalized_path).as_posix()


def expected_poster_filenames(beats):
    return {
        f"kf_{beat['id']}{shot['id']}.png"
        for beat in beats
        for shot in beat.get("shots", [])
    }


def prepare_output_directory(output_dir, expected_posters):
    output_path = Path(output_dir).expanduser().resolve()
    if not output_path.exists():
        output_path.mkdir(parents=True)
    elif not output_path.is_dir():
        sys.exit(f"Error: Output path '{output_path}' must be a directory.")
    else:
        allowed_children = {"beats.json", "manifest.json", "keyframes"}
        unexpected_children = sorted(
            child.name for child in output_path.iterdir() if child.name not in allowed_children
        )
        if unexpected_children:
            sys.exit(
                f"Error: Refusing non-empty output directory '{output_path}' with non-generated content."
            )

        for filename in ("beats.json", "manifest.json"):
            generated_file = output_path / filename
            if generated_file.exists() and not generated_file.is_file():
                sys.exit(
                    f"Error: Refusing non-empty output directory '{output_path}' with non-generated content."
                )

        keyframes_path = output_path / "keyframes"
        if keyframes_path.exists():
            if not keyframes_path.is_dir():
                sys.exit(
                    f"Error: Refusing non-empty output directory '{output_path}' with non-generated content."
                )
            unexpected_keyframes = sorted(
                child.name
                for child in keyframes_path.iterdir()
                if not child.is_file() or child.name not in expected_posters
            )
            if unexpected_keyframes:
                sys.exit(
                    f"Error: Refusing non-empty output directory '{output_path}' with non-generated content."
                )
            shutil.rmtree(keyframes_path)

        for filename in ("beats.json", "manifest.json"):
            generated_file = output_path / filename
            if generated_file.exists():
                generated_file.unlink()

    keyframes_path = output_path / "keyframes"
    keyframes_path.mkdir()
    return output_path, keyframes_path

def perturb_segment(p1, p2, max_disp=4.0, step=8.0):
    x1, y1 = p1
    x2, y2 = p2
    dx = x2 - x1
    dy = y2 - y1
    dist = math.hypot(dx, dy)
    if dist < step:
        return [p1]
    
    n = int(dist / step)
    points = [p1]
    px = -dy / dist
    py = dx / dist
    
    for i in range(1, n):
        t = i / n
        xi = x1 + dx * t
        yi = y1 + dy * t
        disp = random.uniform(-max_disp, max_disp)
        # Fiber-like jitter
        jitter_x = random.uniform(-0.5, 0.5)
        jitter_y = random.uniform(-0.5, 0.5)
        points.append((xi + px * disp + jitter_x, yi + py * disp + jitter_y))
    return points

def generate_torn_polygon(rect, max_disp=4.0, step=8.0):
    x1, y1, x2, y2 = rect
    c1 = (x1, y1)
    c2 = (x2, y1)
    c3 = (x2, y2)
    c4 = (x1, y2)
    
    path = []
    path.extend(perturb_segment(c1, c2, max_disp, step))
    path.extend(perturb_segment(c2, c3, max_disp, step))
    path.extend(perturb_segment(c3, c4, max_disp, step))
    path.extend(perturb_segment(c4, c1, max_disp, step))
    return path

def create_halftone_pattern(width, height, dot_color=(0, 0, 0), spacing=8, radius=1.0):
    halftone = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(halftone)
    for y in range(0, height + spacing, spacing):
        offset = (spacing // 2) if (y // spacing) % 2 == 1 else 0
        for x in range(-spacing, width + spacing, spacing):
            cx = x + offset
            cy = y
            draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=dot_color + (255,))
    return halftone

def draw_torn_paper_layer(main_img, rect, color, seed_val, shadow_opacity=140):
    draw = ImageDraw.Draw(main_img)
    width, height = main_img.size
    
    random.seed(seed_val)
    path = generate_torn_polygon(rect, max_disp=5.0, step=8.0)
    
    # 1. Drop Shadow
    shadow_mask = Image.new("L", (width, height), 0)
    shadow_draw = ImageDraw.Draw(shadow_mask)
    shadow_draw.polygon(path, fill=shadow_opacity)
    shadow_mask_blurred = shadow_mask.filter(ImageFilter.GaussianBlur(6))
    
    shadow_color = Image.new("RGBA", (width, height), (10, 10, 15, 255))
    main_img.paste(shadow_color, (4, 6), shadow_mask_blurred)
    
    # 2. Outer paper border (off-white core)
    x1, y1, x2, y2 = rect
    border_rect = (x1 - 3, y1 - 3, x2 + 3, y2 + 3)
    path_outer = generate_torn_polygon(border_rect, max_disp=5.0, step=8.0)
    
    paper_border = Image.new("RGBA", (width, height), (245, 242, 235, 255))
    border_mask = Image.new("L", (width, height), 0)
    border_draw = ImageDraw.Draw(border_mask)
    border_draw.polygon(path_outer, fill=255)
    main_img.paste(paper_border, (0, 0), border_mask)
    
    # 3. Inner paper color
    paper_inner = Image.new("RGBA", (width, height), color + (255,))
    inner_mask = Image.new("L", (width, height), 0)
    inner_draw = ImageDraw.Draw(inner_mask)
    inner_draw.polygon(path, fill=255)
    main_img.paste(paper_inner, (0, 0), inner_mask)

def composite_source_plate(main_img, rect, source_path, seed_val, shadow_opacity=140):
    width, height = main_img.size
    x1, y1, x2, y2 = rect
    rect_w = int(x2 - x1)
    rect_h = int(y2 - y1)
    
    src = crop_text_free_source(Image.open(source_path).convert("RGBA"), source_path)
    src_w, src_h = src.size
    aspect_src = src_w / src_h
    aspect_rect = rect_w / rect_h
    
    if aspect_src > aspect_rect:
        new_h = rect_h
        new_w = int(rect_h * aspect_src)
        src_resized = src.resize((new_w, new_h), Image.Resampling.LANCZOS)
        crop_x = (new_w - rect_w) // 2
        src_cropped = src_resized.crop((crop_x, 0, crop_x + rect_w, rect_h))
    else:
        new_w = rect_w
        new_h = int(rect_w / aspect_src)
        src_resized = src.resize((new_w, new_h), Image.Resampling.LANCZOS)
        crop_y = (new_h - rect_h) // 2
        src_cropped = src_resized.crop((0, crop_y, rect_w, crop_y + rect_h))
        
    random.seed(seed_val)
    path_inner = generate_torn_polygon(rect, max_disp=6.0, step=8.0)
    
    border_rect = (x1 - 4, y1 - 4, x2 + 4, y2 + 4)
    path_outer = generate_torn_polygon(border_rect, max_disp=6.0, step=8.0)
    
    # 1. Drop Shadow
    shadow_mask = Image.new("L", (width, height), 0)
    shadow_draw = ImageDraw.Draw(shadow_mask)
    shadow_draw.polygon(path_inner, fill=shadow_opacity)
    shadow_mask_blurred = shadow_mask.filter(ImageFilter.GaussianBlur(8))
    
    shadow_color = Image.new("RGBA", (width, height), (8, 8, 12, 255))
    main_img.paste(shadow_color, (5, 7), shadow_mask_blurred)
    
    # 2. Outer paper border (exposed white core)
    paper_border = Image.new("RGBA", (width, height), (248, 246, 240, 255))
    border_mask = Image.new("L", (width, height), 0)
    border_draw = ImageDraw.Draw(border_mask)
    border_draw.polygon(path_outer, fill=255)
    main_img.paste(paper_border, (0, 0), border_mask)
    
    # 3. Cropped source image
    src_layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    src_layer.paste(src_cropped, (int(x1), int(y1)))
    
    inner_mask = Image.new("L", (width, height), 0)
    inner_draw = ImageDraw.Draw(inner_mask)
    inner_draw.polygon(path_inner, fill=255)
    
    main_img.paste(src_layer, (0, 0), inner_mask)

def draw_tape(main_img, cx, cy, angle_deg, width=40, height=15, color=(220, 215, 190, 100)):
    tape = Image.new("RGBA", (width, height), color)
    tape_rot = tape.rotate(angle_deg, expand=True, resample=Image.Resampling.BILINEAR)
    rw, rh = tape_rot.size
    px = int(cx - rw / 2)
    py = int(cy - rh / 2)
    main_img.paste(tape_rot, (px, py), tape_rot)

def apply_halftone_texture(main_img, seed_val, opacity=0.08):
    width, height = main_img.size
    halftone_dots = create_halftone_pattern(width, height, dot_color=(0, 0, 0), spacing=8, radius=1.0)
    halftone_with_opacity = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    halftone_with_opacity = Image.blend(halftone_with_opacity, halftone_dots, opacity)
    return Image.alpha_composite(main_img.convert("RGBA"), halftone_with_opacity)

def generate_shot_poster(beat_id, shot_id, source_plates, output_path):
    seed_val = f"shot_{beat_id}_{shot_id}"
    random.seed(seed_val)
    
    # Create canvas
    main_img = Image.new("RGBA", (CANVAS_WIDTH, CANVAS_HEIGHT), BEAT_BG_COLORS[beat_id] + (255,))
    palette = BEAT_PALETTES[beat_id]
    
    # 1. Background paper blocks
    num_bg_blocks = random.randint(1, 2)
    for i in range(num_bg_blocks):
        bg_color = random.choice(palette)
        block_w = random.randint(150, 300)
        block_h = random.randint(150, 450)
        bx1 = random.randint(-50, CANVAS_WIDTH - block_w + 50)
        by1 = random.randint(-50, CANVAS_HEIGHT - block_h + 50)
        rect = (bx1, by1, bx1 + block_w, by1 + block_h)
        draw_torn_paper_layer(main_img, rect, bg_color, f"bg_{beat_id}_{shot_id}_{i}")
        
    # 2. Composite source plates
    num_plates = len(source_plates)
    
    if num_plates == 1:
        rect = (120, 60, 840, 480)
        composite_source_plate(main_img, rect, source_plates[0], f"plate_{beat_id}_{shot_id}_0")
    elif num_plates == 2:
        if shot_id == 'a':
            rect1 = (80, 70, 540, 470)
            rect2 = (440, 90, 880, 450)
            composite_source_plate(main_img, rect1, source_plates[0], f"plate_{beat_id}_{shot_id}_0")
            composite_source_plate(main_img, rect2, source_plates[1], f"plate_{beat_id}_{shot_id}_1")
        else:
            rect1 = (100, 50, 600, 490)
            rect2 = (500, 60, 860, 440)
            composite_source_plate(main_img, rect1, source_plates[1], f"plate_{beat_id}_{shot_id}_1")
            composite_source_plate(main_img, rect2, source_plates[0], f"plate_{beat_id}_{shot_id}_0")
    elif num_plates == 3:
        if shot_id == 'a':
            rect1 = (60, 60, 500, 480)
            rect2 = (420, 80, 800, 460)
            rect3 = (640, 150, 900, 400)
            composite_source_plate(main_img, rect1, source_plates[0], f"plate_{beat_id}_{shot_id}_0")
            composite_source_plate(main_img, rect2, source_plates[1], f"plate_{beat_id}_{shot_id}_1")
            composite_source_plate(main_img, rect3, source_plates[2], f"plate_{beat_id}_{shot_id}_2")
        else:
            rect1 = (120, 80, 550, 440)
            rect2 = (480, 50, 880, 470)
            rect3 = (80, 180, 320, 420)
            composite_source_plate(main_img, rect2, source_plates[0], f"plate_{beat_id}_{shot_id}_0")
            composite_source_plate(main_img, rect1, source_plates[2], f"plate_{beat_id}_{shot_id}_2")
            composite_source_plate(main_img, rect3, source_plates[1], f"plate_{beat_id}_{shot_id}_1")

    # 3. Washi tape accents
    num_tapes = random.randint(2, 4)
    for t in range(num_tapes):
        tx = random.randint(100, 860)
        ty = random.randint(80, 460)
        t_angle = random.randint(-35, 35)
        tape_color = random.choice([
            (230, 220, 180, 100),  # semi-transparent yellowish washi tape
            (200, 225, 225, 90),   # semi-transparent teal washi tape
            (225, 195, 195, 90)    # semi-transparent red washi tape
        ])
        draw_tape(main_img, tx, ty, t_angle, width=55, height=18, color=tape_color)
        
    # 4. Halftone overlay
    main_img = apply_halftone_texture(main_img, f"halftone_{beat_id}_{shot_id}", opacity=0.08)
    
    # Save as RGB PNG
    main_img.convert("RGB").save(output_path, "PNG")

def main():
    parser = argparse.ArgumentParser(description="Prepare Vox concept-film workspace.")
    parser.add_argument("beat_map", help="Path to canonical beat-map JSON")
    parser.add_argument("output_dir", help="Path to output project directory")
    args = parser.parse_args()
    
    repo_root = Path(__file__).resolve().parent.parent

    # Load beat-map
    beat_map_path = Path(args.beat_map)
    if not beat_map_path.is_file():
        sys.exit(f"Error: Beat map file '{args.beat_map}' does not exist.")

    with beat_map_path.open(encoding="utf-8") as f:
        try:
            beat_map = json.load(f)
        except Exception as e:
            sys.exit(f"Error: Failed to parse beat-map JSON: {e}")

    # Validate beats and source plates before touching the output directory.
    beats = beat_map.get("beats")
    if not beats:
        sys.exit("Error: No beats listed in the beat-map.")

    resolved_sources_by_beat = []
    unique_sources = {}
    for beat in beats:
        source_plates = beat.get("source_key_art")
        if not source_plates:
            sys.exit(f"Error: Beat {beat.get('id')} has no source plates listed.")

        resolved_plates = []
        for plate_path in source_plates:
            resolved_plate, normalized_path = resolve_source_plate(
                repo_root, plate_path, beat.get("id")
            )
            resolved_plates.append(resolved_plate)
            unique_sources[normalized_path] = resolved_plate
        resolved_sources_by_beat.append(resolved_plates)

    output_dir, keyframes_dir = prepare_output_directory(
        args.output_dir, expected_poster_filenames(beats)
    )
    
    # Mapped beats list
    mapped_beats = []
    posters_metadata = []
    
    # Process shots and generate posters
    for beat, source_plates_abs in zip(beats, resolved_sources_by_beat):
        beat_id = beat["id"]
        headline_ko = beat["headline_ko"]
        
        mapped_shots = []
        for shot in beat.get("shots", []):
            shot_id = shot["id"]
            
            # Target output file path
            poster_filename = f"kf_{beat_id}{shot_id}.png"
            poster_abs_path = keyframes_dir / poster_filename
            
            # Generate the poster
            generate_shot_poster(beat_id, shot_id, source_plates_abs, poster_abs_path)
            
            # Calculate path relative to repository root
            poster_rel_path = os.path.relpath(poster_abs_path, repo_root)
            
            # Record poster metadata for manifest
            poster_hash = get_sha256(poster_abs_path)
            posters_metadata.append({
                "path": poster_rel_path,
                "sha256": poster_hash,
                "width": CANVAS_WIDTH,
                "height": CANVAS_HEIGHT
            })
            
            # Build mapped shot object
            mapped_shot = {
                "id": shot_id,
                "dur": shot.get("dur", 3),
                "title": shot.get("title", False),
                "camera_move": shot.get("camera_move", "push_in"),
                "element_motion": shot.get("element_motion", ""),
                "scene": shot.get("scene", ""),
                "keyframe_path": poster_rel_path
            }
            mapped_shots.append(mapped_shot)
            
        # Build mapped beat object
        mapped_beat = {
            "id": beat_id,
            "title_cn": headline_ko,
            "title_en": "",
            "bg": beat.get("bg", ""),
            "feel": beat.get("feel", ""),
            "narration": beat.get("narration", ""),
            "shots": mapped_shots
        }
        mapped_beats.append(mapped_beat)
        
    # Construct output beats.json
    output_beats = {
        "project": beat_map.get("project", "abyssal-surge-concept-film"),
        "topic": beat_map.get("topic", ""),
        "language": beat_map.get("language", "ko"),
        "aspect": beat_map.get("aspect", "16:9"),
        "style": "collage",
        "provider": beat_map.get("provider", "atlas_cloud"),
        "video_model": beat_map.get("video_model", "google/gemini-omni-flash/image-to-video"),
        "motion_style": beat_map.get("motion_style", "punchy"),
        "constraints": beat_map.get("constraints", "strict"),
        "theme": beat_map.get("visual_direction", {}).get("theme", "custom_abyssal_editorial_collage"),
        "visual_production_path": "no-Atlas-text-to-image: deterministic local Pillow collage composites from approved GodTiboImagen stage plates",
        "generation_gate": beat_map.get("generation_gate", {}),
        "visual_direction": beat_map.get("visual_direction", {}),
        "beats": mapped_beats
    }
    
    # Save output beats.json
    beats_json_path = os.path.join(output_dir, "beats.json")
    with open(beats_json_path, "w", encoding="utf-8") as f:
        json.dump(output_beats, f, ensure_ascii=False, indent=2)
        
    # Gather manifest information
    canonical_input_rel = os.path.relpath(beat_map_path, repo_root)
    canonical_input_hash = get_sha256(beat_map_path)

    source_files_metadata = []
    for normalized_path, source_path in sorted(unique_sources.items()):
        source_files_metadata.append({
            "path": normalized_path,
            "sha256": get_sha256(source_path)
        })
        
    output_beats_json_rel = os.path.relpath(beats_json_path, repo_root)
    output_beats_json_hash = get_sha256(beats_json_path)
    
    manifest_data = {
        "canonical_input": {
            "path": canonical_input_rel,
            "sha256": canonical_input_hash
        },
        "source_files": source_files_metadata,
        "posters": posters_metadata,
        "output_beats_json": {
            "path": output_beats_json_rel,
            "sha256": output_beats_json_hash
        },
        "upstream_vox_revision": "0f66dc444fc18ac26f6dddd30ee5505d31b45de6"
    }
    
    manifest_path = os.path.join(output_dir, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, ensure_ascii=False, indent=2)
        
    print(f"Success: Prepared Vox workspace in '{output_dir}'")
    print(f"Generated beats.json at '{beats_json_path}'")
    print(f"Generated manifest.json at '{manifest_path}'")
    print(f"Generated {len(posters_metadata)} posters in '{keyframes_dir}'")

if __name__ == "__main__":
    main()
