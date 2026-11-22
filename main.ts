// Tiny stack VM (make.fun tiny-stack-vm-01): the full ISA in one small file.
// Wrapping 32-bit ints, 256 stack, 64 calls, 256 words, ten traps, step/output caps.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
function run(P, I) {
  const S = [], C = [], M = new Int32Array(256), O = [];
  let pc = 0, steps = 0, ip = 0, oc = 0;
  const N = P.length, E = (code) => ({ out: O, code });
  for (;;) {
    if (steps >= 1e6) return E(10);
    if (pc < 0 || pc >= N) return E(9);
    const op = P[pc];
    let il = 0;
    if (op === 1) il = 1;
    else if (op === 2) il = 4;
    else if (op >= 0x30 && op <= 0x33) il = 2;
    if (pc + 1 + il > N) return E(9);
    steps++;
    const L = S.length;
    switch (op) {
      case 0x00: return E(0);
      case 0x01: { if (L > 255) return E(3); let v = P[pc + 1]; if (v > 127) v -= 256; S.push(v); pc += 2; break; }
      case 0x02: if (L > 255) return E(3); S.push(P[pc + 1] | (P[pc + 2] << 8) | (P[pc + 3] << 16) | (P[pc + 4] << 24)); pc += 5; break;
      case 0x03: if (L < 1) return E(2); S.length = L - 1; pc++; break;
      case 0x04: if (L < 1) return E(2); if (L > 255) return E(3); S.push(S[L - 1]); pc++; break;
      case 0x05: { if (L < 2) return E(2); const t = S[L - 1]; S[L - 1] = S[L - 2]; S[L - 2] = t; pc++; break; }
      case 0x06: if (L < 2) return E(2); if (L > 255) return E(3); S.push(S[L - 2]); pc++; break;
      case 0x07: { if (L < 3) return E(2); const a = S[L - 3]; S[L - 3] = S[L - 2]; S[L - 2] = S[L - 1]; S[L - 1] = a; pc++; break; }
      case 0x17: case 0x1B: if (L < 1) return E(2); S[L - 1] = op === 0x17 ? (-S[L - 1]) | 0 : ~S[L - 1]; pc++; break;
      case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15: case 0x16:
      case 0x18: case 0x19: case 0x1A: case 0x1C: case 0x1D: case 0x1E:
      case 0x20: case 0x21: case 0x22: {
        if (L < 2) return E(2);
        const a = S[L - 2], b = S[L - 1];
        let r;
        if (op === 0x10) r = (a + b) | 0;
        else if (op === 0x11) r = (a - b) | 0;
        else if (op === 0x12) r = Math.imul(a, b);
        else if (op === 0x13) { if (b === 0) return E(4); r = ((a - (a % b)) / b) | 0; }
        else if (op === 0x14) { if (b === 0) return E(4); r = (a % b) | 0; }
        else if (op === 0x15) { const u = b >>> 0; if (u === 0) return E(4); const w = a >>> 0; r = ((w - (w % u)) / u) | 0; }
        else if (op === 0x16) { const u = b >>> 0; if (u === 0) return E(4); r = ((a >>> 0) % u) | 0; }
        else if (op === 0x18) r = a & b;
        else if (op === 0x19) r = a | b;
        else if (op === 0x1A) r = a ^ b;
        else if (op === 0x1C) r = a << (b & 31);
        else if (op === 0x1D) r = a >> (b & 31);
        else if (op === 0x1E) r = (a >>> (b & 31)) | 0;
        else if (op === 0x20) r = a === b ? 1 : 0;
        else if (op === 0x21) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        S.length = L - 1; S[L - 2] = r; pc++; break;
      }
      case 0x30: case 0x31: case 0x32: {
        let off = P[pc + 1] | (P[pc + 2] << 8);
        if (off >= 32768) off -= 65536;
        if (op === 0x30) { pc += 3 + off; break; }
        if (L < 1) return E(2);
        const v = S[L - 1];
        S.length = L - 1;
        pc = (op === 0x31) === (v === 0) ? pc + 3 + off : pc + 3;
        break;
      }
      case 0x33: if (C.length > 63) return E(7); C.push(pc + 3); pc = P[pc + 1] | (P[pc + 2] << 8); break;
      case 0x34: if (C.length === 0) return E(8); pc = C.pop(); break;
      case 0x40: { if (L < 1) return E(2); const ad = S[L - 1]; if (ad < 0 || ad > 255) return E(6); S[L - 1] = M[ad]; pc++; break; }
      case 0x41: { if (L < 2) return E(2); const ad = S[L - 1]; if (ad < 0 || ad > 255) return E(6); M[ad] = S[L - 2]; S.length = L - 2; pc++; break; }
      case 0x50: {
        if (L < 1) return E(2);
        const s = String(S[L - 1]);
        if (oc + s.length > 65536) return E(11);
        S.length = L - 1;
        for (let i = 0; i < s.length; i++) O.push(s.charCodeAt(i));
        oc += s.length; pc++; break;
      }
      case 0x51: if (L < 1) return E(2); if (oc + 1 > 65536) return E(11); O.push(S[L - 1] & 255); oc++; S.length = L - 1; pc++; break;
      case 0x52: if (L > 255) return E(3); S.push(ip < I.length ? I[ip++] : -1); pc++; break;
      case 0x53: if (L < 1) return E(2); return E(S[L - 1] & 255);
      default: return E(5);
    }
  }
}
for (const d of readdirSync("/input", { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const dir = "/input/" + d.name;
  let P, I;
  try { P = readFileSync(dir + "/program.bin"); } catch { P = Buffer.alloc(0); }
  try { I = readFileSync(dir + "/input.bin"); } catch { I = Buffer.alloc(0); }
  const r = run(P, I);
  mkdirSync("/output/" + d.name, { recursive: true });
  writeFileSync("/output/" + d.name + "/stdout.bin", Buffer.from(r.out));
  writeFileSync("/output/" + d.name + "/exit.txt", String(r.code));
}
