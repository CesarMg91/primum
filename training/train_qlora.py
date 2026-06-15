#!/usr/bin/env python3
"""
Primum · Capa 2 · paso 3 — QLoRA fine-tune of MedGemma 4B on the gold corpus.

Trains a safety-aligned MedGemma on dataset/gold.jsonl (58 verified-safe,
multi-turn clinical chats produced by goldGen.ts) and exports a GGUF the Ollama
benchmark can load. Designed to run on a single 24GB GPU (RunPod RTX A5000/4090).

What it does:
  1. Loads MedGemma 4B 4-bit via unsloth (Gemma-3 architecture).
  2. Adds LoRA adapters and fine-tunes ONLY on the assistant turns
     (train_on_responses_only) so the model learns to PRODUCE the safe reply,
     not to echo the patient.
  3. Keeps the generic system prompt that ships in the data, matching exactly
     what the benchmark sends — so the safety behavior transfers.
  4. Exports: LoRA adapters + a merged GGUF (q4_k_m) + an Ollama Modelfile.

Prereqs on the pod (see RUNBOOK.md):
  - HF token with MedGemma license accepted:  huggingface-cli login
  - pip install unsloth

Usage:
  python train_qlora.py \
      --data gold.jsonl \
      --out primum-medgemma \
      --epochs 3
"""

import argparse
import json
import os

# ---- config defaults -------------------------------------------------------
# unsloth ships a pre-quantized MedGemma; fall back to the gated Google repo.
DEFAULT_MODEL = os.environ.get("PRIMUM_BASE_MODEL", "unsloth/medgemma-4b-it")
MAX_SEQ_LEN = 4096  # cases are multi-turn; gold replies are 1-3 paragraphs

# Gemma-3 turn markers used to mask everything but the model's replies.
GEMMA_USER_PART = "<start_of_turn>user\n"
GEMMA_MODEL_PART = "<start_of_turn>model\n"


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--data", default="gold.jsonl", help="path to gold SFT jsonl")
    p.add_argument("--model", default=DEFAULT_MODEL, help="base model id")
    p.add_argument("--out", default="primum-medgemma", help="output dir / model name")
    p.add_argument("--epochs", type=float, default=3.0)
    p.add_argument("--lr", type=float, default=2e-4)
    p.add_argument("--dropout", type=float, default=0.0,
                   help="LoRA dropout; >0 regularizes against catastrophic forgetting (cycle 5: 0.05)")
    p.add_argument("--rank", type=int, default=16, help="LoRA rank")
    p.add_argument("--batch", type=int, default=2)
    p.add_argument("--accum", type=int, default=4, help="grad accumulation steps")
    p.add_argument("--gguf-quant", default="q4_k_m")
    p.add_argument("--no-gguf", action="store_true", help="skip GGUF export")
    p.add_argument("--split-file", default="../cases/split.json",
                   help="restrict training to the train ids in this split (anti-leakage)")
    return p.parse_args()


def load_examples(path, split_file=None):
    """Read gold.jsonl -> list of {'messages': [...]}. If split_file is given,
    keep ONLY gold whose caseId is in the train split — so a re-shuffled split
    never leaks held-out test cases into training."""
    train_ids = None
    if split_file and os.path.exists(split_file):
        train_ids = set(json.load(open(split_file))["train"])
        print(f"[primum] restricting to {len(train_ids)} train ids from {split_file}")
    rows, skipped = [], 0
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            if train_ids is not None and obj.get("caseId") not in train_ids:
                skipped += 1
                continue
            msgs = obj["messages"]
            if msgs and msgs[-1]["role"] == "assistant":
                rows.append({"messages": msgs})
    if skipped:
        print(f"[primum] skipped {skipped} gold examples not in the train split")
    if not rows:
        raise SystemExit(f"No usable examples in {path}")
    return rows


def normalize_messages(messages):
    """Make a transcript satisfy Gemma's strict chat template:
      - no standalone system role  -> fold system text into the next user turn
      - strict user/assistant alternation -> merge consecutive same-role turns
    Our cases push several patient (user) turns in a row before the first model
    reply, which Gemma's template rejects; merging fixes it while preserving all
    content."""
    out, pending_system = [], None
    for m in messages:
        role, content = m["role"], m["content"]
        if role == "system":
            pending_system = f"{pending_system}\n\n{content}" if pending_system else content
            continue
        if role == "user" and pending_system:
            content = f"{pending_system}\n\n{content}"
            pending_system = None
        if out and out[-1]["role"] == role:  # merge consecutive same-role turns
            out[-1]["content"] += f"\n\n{content}"
        else:
            out.append({"role": role, "content": content})
    if pending_system:  # system with no following user (shouldn't happen): attach safely
        if out and out[-1]["role"] == "user":
            out[-1]["content"] += f"\n\n{pending_system}"
        else:
            out.append({"role": "user", "content": pending_system})
    return out


def main():
    args = parse_args()
    from unsloth import FastModel
    from unsloth.chat_templates import train_on_responses_only
    from datasets import Dataset
    from trl import SFTConfig, SFTTrainer

    print(f"[primum] loading {args.model} (4-bit)…")
    model, tokenizer = FastModel.from_pretrained(
        model_name=args.model,
        max_seq_length=MAX_SEQ_LEN,
        load_in_4bit=True,
        full_finetuning=False,
    )

    model = FastModel.get_peft_model(
        model,
        r=args.rank,
        lora_alpha=args.rank * 2,
        lora_dropout=args.dropout,
        bias="none",
        finetune_language_layers=True,
        finetune_attention_modules=True,
        finetune_mlp_modules=True,
        random_state=3407,
    )

    rows = load_examples(args.data, args.split_file)
    print(f"[primum] {len(rows)} gold examples (train split)")

    # Render each conversation with the model's chat template. Try system-as-is;
    # fall back to folding system into the first user turn if the template balks.
    def render(example):
        msgs = normalize_messages(example["messages"])
        text = tokenizer.apply_chat_template(msgs, tokenize=False, add_generation_prompt=False)
        return {"text": text}

    ds = Dataset.from_list(rows).map(render, remove_columns=["messages"])

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=ds,
        args=SFTConfig(
            dataset_text_field="text",
            per_device_train_batch_size=args.batch,
            gradient_accumulation_steps=args.accum,
            warmup_ratio=0.05,
            num_train_epochs=args.epochs,
            learning_rate=args.lr,
            logging_steps=1,
            optim="adamw_8bit",
            weight_decay=0.01,
            lr_scheduler_type="linear",
            seed=3407,
            output_dir="outputs",
            report_to="none",
        ),
    )

    # Mask loss on everything except the model's replies — learn to generate the
    # safe answer under patient pressure, not to reproduce the patient's turns.
    trainer = train_on_responses_only(
        trainer,
        instruction_part=GEMMA_USER_PART,
        response_part=GEMMA_MODEL_PART,
    )

    print("[primum] training…")
    trainer.train()

    print(f"[primum] saving LoRA adapters -> {args.out}-lora")
    model.save_pretrained(f"{args.out}-lora")
    tokenizer.save_pretrained(f"{args.out}-lora")

    if not args.no_gguf:
        try:
            print(f"[primum] exporting GGUF ({args.gguf_quant}) -> {args.out}-gguf")
            model.save_pretrained_gguf(
                f"{args.out}-gguf",
                tokenizer,
                quantization_method=args.gguf_quant,
            )
            write_modelfile(args.out)
        except Exception as e:
            # unsloth's bundled GGUF export is fragile on some versions. The LoRA
            # is safely saved, so fall back to the standalone recovery converter.
            print(f"[primum] GGUF export via unsloth failed ({e}).")
            print(f"[primum] LoRA is safe in {args.out}-lora — run:  bash export_gguf.sh")

    print("[primum] done.")


def write_modelfile(out):
    """Ollama Modelfile. No hardcoded SYSTEM: the benchmark passes the system
    prompt itself, exactly as during training, so behavior matches."""
    gguf = f"./{out}-gguf"
    modelfile = f"""# Primum · MedGemma fine-tuned for clinical safety (es-MX)
# Build:  ollama create primum-medgemma -f Modelfile
FROM {gguf}/unsloth.Q4_K_M.gguf

PARAMETER temperature 0.6
PARAMETER top_p 0.9
PARAMETER num_ctx {MAX_SEQ_LEN}
"""
    with open("Modelfile", "w", encoding="utf-8") as f:
        f.write(modelfile)
    print("[primum] wrote Modelfile")


if __name__ == "__main__":
    main()
