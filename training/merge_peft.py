#!/usr/bin/env python3
"""
Merge LoRA adapters into the base model using peft directly — bypasses unsloth's
broken merge_and_overwrite_lora ("# of LoRAs = 400 does not match # of saved
modules = 0"), which breaks BOTH save_pretrained_gguf and save_pretrained_merged
on this unsloth version.

Usage:  python merge_peft.py <lora_dir> <out_dir>
"""
import json
import os
import sys

import torch
from peft import PeftModel
from transformers import AutoTokenizer

lora = sys.argv[1] if len(sys.argv) > 1 else "primum-medgemma-lora"
out = sys.argv[2] if len(sys.argv) > 2 else "primum-medgemma-merged"

base_id = json.load(open(os.path.join(lora, "adapter_config.json")))["base_model_name_or_path"]
print(f"[merge_peft] base = {base_id}")

# MedGemma 4B is a multimodal Gemma3; load with the image-text class, falling
# back to the explicit Gemma3 class on older/newer transformers.
try:
    from transformers import AutoModelForImageTextToText as ModelClass
except Exception:
    from transformers import Gemma3ForConditionalGeneration as ModelClass

base = ModelClass.from_pretrained(base_id, torch_dtype=torch.bfloat16, device_map="cuda")
print("[merge_peft] applying + merging adapters…")
model = PeftModel.from_pretrained(base, lora).merge_and_unload()

model.save_pretrained(out, safe_serialization=True)
AutoTokenizer.from_pretrained(lora).save_pretrained(out)
print(f"[merge_peft] merged -> {out}")
