"""Kompatibler Einstieg für den aktuellen dunklen Hoku-Export."""
import pathlib
import subprocess
import sys

root = pathlib.Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parents[3]
subprocess.run(["node", str(root / "scripts" / "update-hoku-icons.cjs"), str(root)], check=True)
