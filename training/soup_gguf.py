"""Model soup: average the weights of two q8_0 GGUFs (c3 + c4) in-place.

Both models share the exact same architecture/tensor layout, so we copy c3 and
overwrite each tensor with the 50/50 average:
  - F32 tensors: average directly.
  - Q8_0 tensors: dequantize both -> f32, average, requantize to q8_0.
Same dtype+shape => identical byte length => safe in-place patch (metadata intact).

Usage: python training/soup_gguf.py c3.gguf c4.gguf out.gguf
"""
import sys, shutil
import numpy as np
import gguf
from gguf.quants import dequantize, quantize

C3, C4, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
F32 = gguf.GGMLQuantizationType.F32

print(f"copiando {C3} -> {OUT} ...", flush=True)
shutil.copyfile(C3, OUT)

r3 = gguf.GGUFReader(C3)
r4 = gguf.GGUFReader(C4)
t4_by_name = {t.name: t for t in r4.tensors}

print(f"promediando {len(r3.tensors)} tensores ...", flush=True)
patched = 0
with open(OUT, "r+b") as f:
    for i, t3 in enumerate(r3.tensors):
        t4 = t4_by_name[t3.name]
        assert t3.tensor_type == t4.tensor_type, f"tipo distinto en {t3.name}"
        assert t3.data.nbytes == t4.data.nbytes, f"tamano distinto en {t3.name}"

        if t3.tensor_type == F32:
            avg = (t3.data.astype(np.float32) + t4.data.astype(np.float32)) * 0.5
            out_bytes = avg.astype(np.float32).tobytes()
        else:  # quantized (Q8_0)
            d3 = dequantize(t3.data, t3.tensor_type)
            d4 = dequantize(t4.data, t4.tensor_type)
            avg = (d3 + d4) * 0.5
            out_bytes = quantize(avg, t3.tensor_type).tobytes()

        assert len(out_bytes) == t3.data.nbytes, (
            f"byte mismatch {t3.name}: {len(out_bytes)} vs {t3.data.nbytes}")
        f.seek(int(t3.data_offset))
        f.write(out_bytes)
        patched += 1
        if patched % 50 == 0 or patched == len(r3.tensors):
            print(f"  {patched}/{len(r3.tensors)}", flush=True)

print(f"listo: {OUT} ({patched} tensores promediados)", flush=True)
