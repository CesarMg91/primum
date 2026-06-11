#!/usr/bin/env python3
"""
Extract a clean TEXT-ONLY Gemma3 model from the merged multimodal MedGemma so it
converts to GGUF cleanly.

The merged model stores text weights under `model.language_model.model.*`
(alongside a vision tower we don't need). llama.cpp's converter can't map that
prefix. We keep only the language-model tensors, strip the
`model.language_model.` prefix down to the plain `model.*` that
Gemma3ForCausalLM uses, drop the vision tower, and write a text-only config.

Usage:  python make_text_model.py [merged_dir] [out_dir]
"""
import glob
import json
import os
import shutil
import sys

from safetensors import safe_open
from safetensors.torch import save_file

src = sys.argv[1] if len(sys.argv) > 1 else "primum-medgemma-merged"
dst = sys.argv[2] if len(sys.argv) > 2 else "primum-medgemma-text"
os.makedirs(dst, exist_ok=True)

PREFIX = "model.language_model."

# keep only language-model tensors, renamed to the Gemma3ForCausalLM convention
tensors = {}
for f in sorted(glob.glob(os.path.join(src, "*.safetensors"))):
    with safe_open(f, framework="pt") as sf:
        for k in sf.keys():
            if k.startswith(PREFIX):
                tensors[k[len(PREFIX):]] = sf.get_tensor(k)
print(f"[make_text_model] kept {len(tensors)} text tensors (dropped vision/projector)")
if not tensors:
    raise SystemExit("No text tensors found — check the prefix.")
save_file(tensors, os.path.join(dst, "model.safetensors"), metadata={"format": "pt"})

# text-only config: lift text_config to top level, tag as Gemma3ForCausalLM
cfg = json.load(open(os.path.join(src, "config.json")))
text_cfg = cfg.get("text_config", cfg)
text_cfg["architectures"] = ["Gemma3ForCausalLM"]
text_cfg.setdefault("model_type", "gemma3_text")
json.dump(text_cfg, open(os.path.join(dst, "config.json"), "w"), indent=2)

# carry over tokenizer + generation config
for f in os.listdir(src):
    if f.startswith("tokenizer") or f in (
        "special_tokens_map.json",
        "generation_config.json",
    ):
        shutil.copy(os.path.join(src, f), os.path.join(dst, f))

print(f"[make_text_model] wrote text-only model -> {dst}")
