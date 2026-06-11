#!/usr/bin/env python3
"""Print the tensor-name structure of the merged model so we know exactly how to
convert it to GGUF. Usage:  python inspect_tensors.py [merged_dir]"""
import glob
import os
import sys
from collections import Counter

from safetensors import safe_open

d = sys.argv[1] if len(sys.argv) > 1 else "primum-medgemma-merged"
files = sorted(glob.glob(os.path.join(d, "*.safetensors")))
print(f"dir: {d}  ({len(files)} safetensors shards)")

keys = []
for f in files:
    with safe_open(f, framework="pt") as sf:
        keys.extend(sf.keys())
print(f"total tensors: {len(keys)}\n")

print("prefixes (first 3 components):")
pref = Counter(".".join(k.split(".")[:3]) for k in keys)
for p, c in sorted(pref.items()):
    print(f"  {c:4d}  {p}")

print("\nkey examples (embed / norm / lm_head / vision / projector):")
for k in keys:
    if any(x in k for x in ["embed_tokens", "lm_head", "vision", "multi_modal", ".norm."]):
        print("  ", k)
