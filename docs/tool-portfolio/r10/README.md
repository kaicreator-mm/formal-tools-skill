# I24 / R10 — HiGHS 1.15.1 real-native fixture and strict portable metadata gate

**OUTPUT_LABEL:** `FORMAL_TOOLS_I24_TOOL_INTEGRATION_CONTINUE`

**Branch:** `fix/i24-highs-1151-native-error-r10`, based on main `9edcb4c2698ef9733215a8281962268152a7eab9`.

The former portable source PR #22 and evidence PR #77 were **merged before** the new HiGHS fix. Their merge commits do **not** contain this R10 change. This follow-on is independent and narrow. No shared Registry/Capability mapping, SDK/MCP or original 13/53 operation contract is modified.

## Real first-party version identity, no false 1.16→1.15 downgrade

Canonical original Drive archive `tools/highs-1.15.1-linux-x86_64.tar.zst`, ID `19SGQTJynASZc3-wgIHG5PqMVdHCHtOV_`, SHA256 **`ea0a12198f986f9fd03c7a29525d7f93c64e39c51525492bf3fc37e0bc7815a2`**, agrees with canonical `App/packages/SHA256SUMS`. zstd and 30-entry safe tar preflight passed; there were no symlinks. Both highspy Python distribution metadata and the native HiGHS solver report **1.15.1**. This differs from the separate Drive wheelhouse whose name suggests `1.15.1` but whose bytes (outer SHA256 `a67913c95322957bfcaf6c0e9ff9f1dba8f99a2bd0be27d0ce80119feb45f620`) contain **highspy 1.16.0**; this was never promoted.

## Exact-source non-root native execution

In this ChatGPT Debian13 x86_64 container, with root-owned tool contents not writable to non-root UID `nobody`, the original 1.15.1 highspy binary and bundled payload executed through the actual PR #22 corrected portable runner.

| Phase | Actual process exit | Specific oracle |
| --- | ---: | --- |
| POS | 0 | `OPTIMAL`, objective = **4.000** |
| NEG | 0 | `INFEASIBLE` model status |
| ERR | 3 | Underlying highspy `readModel` returns **`HighsStatus.kError`** for a nonexistent LP; checked and bridged to explicit nonzero process exit |

All `formal-tools/portable-verify/0.2` TSV labels, regex checks, and exit contracts were satisfied. Real phase logs and TSV, source files and original metadata bytes are preserved. **The Python313 interpreter for these tests is the host CPython3.13 adapter, not a separately downloaded/verified hermetic 294MB portable interpreter.** This is T3/fixture technical evidence, not an approved complete T4.

## Real shared Runner bug discovered and repaired in source

The original checksum-valid `highs-1.15.1` tar contains `TOOL_TOOL_ID=highs` in `meta.sh` instead of required `TOOL_ID=highs`. The historical metadata generator is fixed on main for *future builds*, but these original delivered archives have not been rebaked. At least CBMC, ELK, fast-check and AFL++ original archives also contain the historical alias (directly inspected in this run; no claim about the remaining 31).

**Reproduced unmodified original runner against original HiGHS metadata:** `doctor highs` returned `0 / verdict OK` (false healthy), `version highs` returned **1** due to `TOOL_ID: unbound variable`, and `run highs` proceeded exit **0** despite invalid metadata. This is a real failure to fail closed.

**Source fix:** `portable/packaging/bundle-template/bin/tool-runner` now resets inherited identity/version/kind variables before sourcing each tool's metadata, requires matching exact tool ID plus nonempty version/kind, and explicitly stops `run` and `version` if loading metadata fails. The invalid **original** metadata now correctly returns exit **2** for `doctor`, `version` and `run`; a separately staged correctly normalized metadata record returns exit 0 for these and for the three-phase `verify`. No permanent modification or repackaging of the original archive is claimed.

**Five new Node built-in native tests: 5/5 PASS**, verifying good metadata, legacy alias rejected for all three dispatches, environment spoofing rejection, foreign identity rejection and missing version/kind. Test file `tests/tool-portable-metadata.test.mjs`, tested against byte-identical updated Runner (git blob `b7efaf24948d4ea0d5babde71ac96b3755f1bda4`).

## Durable exact-byte evidence and handoff

[Canonical Drive R10 raw archive](https://drive.google.com/file/d/1evX7tTRR5g8XGbIcxPBPpJpvr66BRuiB/view?usp=drivesdk), path `App/10-formal-tools/validation/receipts/formal-tools-i24-r10-highs1151-native-and-meta.zip`.

- ZIP **20,012 bytes**, SHA256 **`d3f9ac86c7071352189893932cbb4d2a95c1c091b5ee564d258839e908107a45`** verified after Drive upload/readback, 36 members, ZIP CRC PASS.
- Contains original and repaired Runner source bytes, original and staged normalized `meta.sh`, exact fixed pos/neg/error fixtures, child logs, TSV, metadata test code, old and new `doctor/version/run` stdout/stderr/return codes and per-entry SHA256 manifest `R10_RECEIPTS.json`.
- [Machine-readable R10 index](./HIGHS_1151_META_GATE.json).

**Remaining gates:** the old original `highs-1.15.1` archive **does not** satisfy its version/doctor provenance contract. A new package must be built with the corrected current metadata builder, SHA-pinned and tested in a fresh trusted host before package-level qualification. Independently review this change set, Woodpecker exact head and affected-scope non-root CI; no automatic T4/T5/Domain Oracle promotion. Full original SDK/MCP/CLI host call not performed by this R10 test. #7 and #14 remain closed.

## R11 incremental shared doctor fix — after original R10 records

A newly executed native tool, **nuXmv 2.2.0 (#45)**, exposed a second shared Runner false negative: its original bundled `libicuuc.so.70` is missing from **unqualified** host `ldd` output, while real `tools/nuxmv/run` succeeds with `LD_LIBRARY_PATH=tools/nuxmv/lib`. Reproduced in this ChatGPT Debian13 nonroot container with the canonical SHA-verified nuXmv package. The Runner now checks native ELF dependencies with exactly that tool-local private library path, falling back to ordinary ldd when none exists. This fixes `doctor nuxmv` from false FAIL to correct exit0/PASS, without globally ignoring missing dependencies.

The new Node metadata/doctor test adds an isolated mocked `ldd` that must pass with the private library directory, then **fail** with the lib directory removed. **6/6 Node tests pass** (versus historical R10 5/5). Exact new source Runner Git Blob: `0f9e1f7d5f07c3dafa59cc08a0beaff944a99`; new test Blob: `1cc6303b3fc16977070d1615736a0cc837cb539e`. Historical R10 real HiGHS receipt/ZIP remains bound to the earlier Runner SHA; it is **not rewritten**.

The tool-specific nuXmv fixed CTL/invalid syntax fixture lives in separate, non-conflicting [PR #81](https://github.com/kaicreator-mm/formal-tools/pull/81). Its actual UID nobody POS/NEG/ERR exit0/0/1 and private-lib doctor logs are preserved [in stable Drive R11 archive](https://drive.google.com/file/d/18JllviN3GF86ocNhLIkCy8k9NUmaeyQA/view?usp=drivesdk), 11,309B, sha256 `661fccef52e9fbf39c76f6e3c3940cfda69b65dc8ab2efdef884937cad86d0d6`. New evidence summary: [R10 JSON incremental_r11_doctor](./HIGHS_1151_META_GATE.json). No original nuXmv meta or HiGHS 1.15.1 source tar was silently mutated. As before, this is a bounded technical observation, not source-owner formal T4 or T5.
