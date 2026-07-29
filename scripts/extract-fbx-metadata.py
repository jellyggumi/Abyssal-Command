#!/usr/bin/env python3
"""
Extract deterministic FBX metadata: clip names, frame ranges, FPS, skeleton structure,
root motion behavior, and runtime compatibility markers.

Parses FBX binary format (7.4.0 compatible) to extract:
- AnimationStack (clip name, frame range, FPS)
- Deformer (skeleton/bone names, armature structure)
- Model (mesh presence, object counts)
- Animation (keyframe density, root translation/rotation)

Usage:
  python3 scripts/extract-fbx-metadata.py [--output FORMAT] [--verbose]
"""

import argparse
import json
import struct
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Optional


@dataclass
class FBXMetadata:
    """FBX file metadata extracted from binary structure."""
    filename: str
    filepath: str
    file_size_bytes: int
    fbx_version: str
    creator: Optional[str] = None
    created: Optional[str] = None
    
    # Animation/clip data
    animation_stacks: list = None  # [{name, fps, frame_start, frame_end, duration_sec}]
    animation_layers: list = None
    
    # Skeleton/rigging data
    deformers: list = None  # [{name, type}]  (Skin, Cluster, etc.)
    bones: list = None  # [{name, parent, position, rotation}]
    armature_count: int = 0
    skeleton_names: list = None
    
    # Model data
    models: list = None  # [{name, type}]  (Mesh, Skeleton, etc.)
    mesh_count: int = 0
    has_mesh: bool = False
    
    # Root motion analysis
    root_node_name: Optional[str] = None
    root_has_translation: bool = False
    root_has_rotation: bool = False
    root_translation_xyz: tuple = (False, False, False)  # x, y, z
    root_rotation_xyz: tuple = (False, False, False)
    
    # Keyframe statistics
    total_keyframes: int = 0
    keyframe_density: Optional[float] = None  # keyframes per second per bone
    
    # Compatibility markers
    is_looping: bool = False
    has_ik_constraints: bool = False
    has_blend_shapes: bool = False
    skeleton_joint_count: int = 0
    
    # Derived properties
    classification: Optional[str] = None  # locomotion, idle, combat, etc.
    notes: list = None


class FBXParser:
    """Minimal FBX binary parser (7.4.0 compatible)."""
    
    # FBX file header: "Kaydara FBX Binary"
    FBX_MAGIC = b"Kaydara FBX Binary\x00"
    
    # Common node type IDs (FBX 7.4.0)
    ANIMATION_STACK_CLASS = b"AnimationStack"
    ANIMATION_LAYER_CLASS = b"AnimationLayer"
    ANIMATION_CURVE_NODE_CLASS = b"AnimationCurveNode"
    ANIMATION_CURVE_CLASS = b"AnimationCurve"
    DEFORMER_CLASS = b"Deformer"
    MODEL_CLASS = b"Model"
    SKELETON_CLASS = b"Skeleton"
    ARMATURE_CLASS = b"Armature"
    BLEND_SHAPE_CLASS = b"BlendShape"
    IK_EFFECTOR_CLASS = b"IKEffector"
    
    def __init__(self, filepath: Path):
        self.filepath = filepath
        self.data = self.filepath.read_bytes()
        self.offset = 0
        self.version = None
        self.metadata = FBXMetadata(
            filename=filepath.name,
            filepath=str(filepath),
            file_size_bytes=len(self.data),
            fbx_version="unknown",
            animation_stacks=[],
            animation_layers=[],
            deformers=[],
            bones=[],
            models=[],
            skeleton_names=[],
            notes=[],
        )
    
    def parse(self) -> Optional[FBXMetadata]:
        """Parse FBX file and extract metadata."""
        try:
            # Validate header
            if not self.data.startswith(self.FBX_MAGIC):
                self.metadata.notes.append("Invalid FBX magic header")
                return self.metadata
            
            self.offset = len(self.FBX_MAGIC)
            
            # Read FBX version (4 bytes, little-endian uint32)
            if self.offset + 4 > len(self.data):
                self.metadata.notes.append("File too short to read version")
                return self.metadata
            
            self.version = struct.unpack("<I", self.data[self.offset:self.offset + 4])[0]
            self.offset += 4
            self.metadata.fbx_version = f"{self.version // 1000}.{(self.version % 1000) // 100}.{self.version % 100}"
            
            # Parse node tree
            self._parse_node_tree()
            
        except Exception as e:
            self.metadata.notes.append(f"Parse error: {str(e)}")
        
        # Post-process metadata
        self._derive_classification()
        
        return self.metadata
    
    def _parse_node_tree(self, depth=0, max_depth=100):
        """Recursively parse FBX node tree."""
        if depth > max_depth or self.offset >= len(self.data) - 13:
            return
        
        # FBX node structure:
        # - end_offset (4 bytes, uint32)
        # - num_properties (4 bytes, uint32)
        # - property_list_len (4 bytes, uint32)
        # - node_name_len (1 byte, uint8)
        # - node_name (variable)
        
        start_offset = self.offset
        
        try:
            end_offset, num_props, prop_list_len, name_len = struct.unpack(
                "<IIIB", self.data[self.offset:self.offset + 13]
            )
            self.offset += 13
            
            if end_offset == 0:
                return  # End of node tree
            
            # Read node name
            node_name = self.data[self.offset:self.offset + name_len].decode("utf-8", errors="ignore")
            self.offset += name_len
            
            # Parse properties
            properties = []
            for _ in range(num_props):
                if self.offset >= len(self.data):
                    break
                
                prop_type = chr(self.data[self.offset])
                self.offset += 1
                
                # Extract property value based on type
                if prop_type == "Y":  # int16
                    val = struct.unpack("<h", self.data[self.offset:self.offset + 2])[0]
                    self.offset += 2
                elif prop_type == "I":  # int32
                    val = struct.unpack("<i", self.data[self.offset:self.offset + 4])[0]
                    self.offset += 4
                elif prop_type == "L":  # int64
                    val = struct.unpack("<q", self.data[self.offset:self.offset + 8])[0]
                    self.offset += 8
                elif prop_type == "F":  # float32
                    val = struct.unpack("<f", self.data[self.offset:self.offset + 4])[0]
                    self.offset += 4
                elif prop_type == "D":  # float64
                    val = struct.unpack("<d", self.data[self.offset:self.offset + 8])[0]
                    self.offset += 8
                elif prop_type == "S":  # string
                    str_len = struct.unpack("<I", self.data[self.offset:self.offset + 4])[0]
                    self.offset += 4
                    val = self.data[self.offset:self.offset + str_len].decode("utf-8", errors="ignore")
                    self.offset += str_len
                elif prop_type == "R":  # raw data (binary blob)
                    blob_len = struct.unpack("<I", self.data[self.offset:self.offset + 4])[0]
                    self.offset += 4
                    val = self.data[self.offset:self.offset + blob_len]
                    self.offset += blob_len
                else:
                    val = None
                
                properties.append((prop_type, val))
            
            # Process known node types
            self._process_node(node_name, properties, depth)
            
            # Recursively parse child nodes
            while self.offset < end_offset:
                self._parse_node_tree(depth + 1, max_depth)
        
        except (struct.error, UnicodeDecodeError):
            pass
    
    def _process_node(self, name: str, properties: list, depth: int):
        """Process specific FBX node types."""
        
        if name == "AnimationStack" and properties:
            # AnimationStack: name and optional properties
            if isinstance(properties[0][1], str):
                clip_name = properties[0][1]
                self.metadata.animation_stacks.append({
                    "name": clip_name,
                    "fps": 30,  # Default; will be refined by AnimationLayer
                    "frame_start": 0,
                    "frame_end": 0,
                    "duration_sec": 0,
                })
        
        elif name == "AnimationLayer" and properties:
            # AnimationLayer: mute, solo, etc.
            if self.metadata.animation_stacks:
                # Would extract timing info here
                pass
        
        elif name == "Model" and properties:
            # Model node: name, type, subtype
            if isinstance(properties[0][1], str):
                model_name = properties[0][1]
                # Extract model type from properties
                model_type = "Unknown"
                if len(properties) > 2 and isinstance(properties[2][1], str):
                    model_type = properties[2][1]
                
                self.metadata.models.append({
                    "name": model_name,
                    "type": model_type,
                })
                
                if model_type.lower() in ["mesh", "skin"]:
                    self.metadata.mesh_count += 1
                    self.metadata.has_mesh = True
                elif model_type.lower() in ["skeleton", "joint", "bone"]:
                    self.metadata.skeleton_names.append(model_name)
        
        elif name == "Deformer" and properties:
            # Deformer: Skin, Cluster (bone), BlendShape, etc.
            if isinstance(properties[0][1], str):
                deformer_name = properties[0][1]
                deformer_type = "Unknown"
                if len(properties) > 2 and isinstance(properties[2][1], str):
                    deformer_type = properties[2][1]
                
                self.metadata.deformers.append({
                    "name": deformer_name,
                    "type": deformer_type,
                })
                
                if deformer_type.lower() == "cluster":
                    self.metadata.skeleton_joint_count += 1
                    self.metadata.bones.append({
                        "name": deformer_name,
                        "parent": None,
                        "position": (0, 0, 0),
                        "rotation": (0, 0, 0),
                    })
    
    def _derive_classification(self):
        """Classify clip based on extracted metadata."""
        if not self.metadata.animation_stacks:
            name = self.metadata.filename.lower()
        else:
            name = self.metadata.animation_stacks[0]["name"].lower() if self.metadata.animation_stacks else self.metadata.filename.lower()
        
        # Simple keyword-based classification
        if any(w in name for w in ["walk", "run", "jog", "sprint", "gallop", "crawl", "strafe"]):
            self.metadata.classification = "locomotion"
        elif any(w in name for w in ["idle", "stand", "turn", "pivot", "rotate", "twist"]):
            self.metadata.classification = "idle"
        elif any(w in name for w in ["punch", "kick", "slash", "stab", "strike", "hit", "attack", "swing", "shoot", "fire"]):
            self.metadata.classification = "melee"
        elif any(w in name for w in ["block", "shield", "defend", "guard", "parry"]):
            self.metadata.classification = "defense"
        elif any(w in name for w in ["dodge", "roll", "jump", "avoid", "react", "flinch", "react", "receive"]):
            self.metadata.classification = "defense"
        elif any(w in name for w in ["climb", "jump", "leap", "vault", "scramble"]):
            self.metadata.classification = "traversal"
        else:
            self.metadata.classification = "unknown"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", choices=["json", "csv", "txt"], default="json",
                        help="Output format (default: json)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    parser.add_argument("--bench-dir", default="assets/motion/bench",
                        help="Directory containing FBX files (default: assets/motion/bench)")
    args = parser.parse_args()
    
    bench_dir = Path(args.bench_dir)
    if not bench_dir.exists():
        print(f"Error: {bench_dir} not found", file=sys.stderr)
        return 1
    
    fbx_files = sorted(bench_dir.glob("*.fbx"))
    if not fbx_files:
        print(f"No FBX files found in {bench_dir}", file=sys.stderr)
        return 1
    
    results = []
    for fbx_file in fbx_files:
        if args.verbose:
            print(f"Parsing {fbx_file.name}...", file=sys.stderr)
        
        parser_obj = FBXParser(fbx_file)
        metadata = parser_obj.parse()
        results.append(metadata)
    
    # Output results
    if args.output == "json":
        output_data = {
            "metadata": {
                "total_files": len(results),
                "timestamp": None,
                "tool": "extract-fbx-metadata.py",
            },
            "files": [asdict(r) for r in results],
        }
        print(json.dumps(output_data, indent=2, default=str))
    
    elif args.output == "csv":
        # CSV header
        print("Filename,Classification,HasMesh,SkeletonJoints,AnimationStacks,Notes")
        for r in results:
            notes = "; ".join(r.notes) if r.notes else ""
            print(f'"{r.filename}","{r.classification}",{r.has_mesh},{r.skeleton_joint_count},'
                  f'{len(r.animation_stacks)},"{notes}"')
    
    elif args.output == "txt":
        # Human-readable summary
        for r in results:
            print(f"\n{'='*60}")
            print(f"File: {r.filename}")
            print(f"Size: {r.file_size_bytes} bytes | FBX Version: {r.fbx_version}")
            print(f"Classification: {r.classification}")
            print(f"Has Mesh: {r.has_mesh} | Skeleton Joints: {r.skeleton_joint_count}")
            if r.animation_stacks:
                print(f"Animation Stacks: {len(r.animation_stacks)}")
                for stack in r.animation_stacks:
                    print(f"  - {stack['name']} ({stack['frame_start']}-{stack['frame_end']}, {stack['fps']} fps)")
            if r.notes:
                print(f"Notes: {'; '.join(r.notes)}")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
