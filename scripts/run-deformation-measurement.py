#!/usr/bin/env python3
"""Blender runner for deformation gate measurement."""

import sys
from pathlib import Path

# Get the measurement script path
script_dir = Path(__file__).parent
measurement_script = script_dir / "measure-deformation-gate.py"

# Read and execute the measurement script
measurement_code = measurement_script.read_text()

# Execute in current namespace
exec(measurement_code, {"__name__": "__main__", "__file__": str(measurement_script)})
