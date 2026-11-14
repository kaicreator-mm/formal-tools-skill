# #24 / R11 — exact nuXmv 2.2.0 CTL and private-library admission evidence

This PR is a **one-tool fixture** repair; the shared Runtime `doctor` implementation belongs to [PR #79](https://github.com/kaicreator-mm/formal-tools/pull/79) with a separate Writer/read-set and same tool metadata contract. No SDK/MCP/Registry source is changed and no extra MCP server is created.

Original Drive `nuxmv-2.2.0-linux-x86_64.tar.zst` SHA256 `75ef7e5c33a68849e84dc8e7ac784b8aee62d6e8c7ffe20ebda8c4b0797df41b` matches canonical manifest; 39 safe archive entries, genuine `nuXmv 2.2.0` binary with its own `libicuuc.so.70`. Host is Debian13 x86_64 **nonroot nobody** with original source bundle read-only.

The actual corrected PR79 portable Runner source Git Blob `0f9e1f7d5f07c3dafaaba59cc08a0beaff944a99` was used **in an isolated staging environment** with original `meta.sh` identity alias `TOOL_TOOL_ID` normalized only in the disposable staging tree. The old delivered tool archive is unchanged and NOT formally package-qualified until rebuilt and re-pinned.

| Fixed source fixture | Actual native exit | Exact process-owned output |
| --- | ---: | --- |
| POS `tests/nuxmv/pos.smv` | 0 | `-- specification EF s = 7  is true` |
| NEG `tests/nuxmv/neg.smv` | 0 | `-- specification AG s <= 5  is false` |
| ERR `tests/nuxmv/err.smv` | 1 | `line 2: at token "is": syntax error` |

Original source `expect.sh` matched `is true`, `is false` and allowed **any** error exit with a generic error regex. Strict new fixture (Git Blob `24e670e3420afa61c800396d5b5154b8bd1a3898`) anchors the real CTL formula and observed Boolean result, and pins syntax error to process exit **1**. It was **executed byte-for-byte** with exact native `formal-tools/portable-verify/0.2` TSV sha256 `6ffe9ad5b962f0231cc2272f4714e9f3b31ead22ce90ae3a65a1e508bc31eae7`; POS/NEG/ERR all matched with exact exit contract, runner exit0.

**Reproducible real shared doctor bug:** old `ldd` without private `LD_LIBRARY_PATH` reports `libicuuc.so.70 => not found` although the original run wrapper exports `tools/nuxmv/lib`. The PR79 updated Runner sets the exact private library path for `ldd` and **this actual nuXmv doctor now exits 0** with `verdict: OK`. Direct ldd with the bundled path finds no missing lib. PR79 independent mocked-lib doctor tests are **6/6 PASS**, including a truly absent library case remaining FAIL. The two PRs do not overlap file writes.

[Canonical Drive R11 raw process logs, TSV, fixture, source runner, metadata and ldd comparison](https://drive.google.com/file/d/18JllviN3GF86ocNhLIkCy8k9NUmaeyQA/view?usp=drivesdk), ZIP **11,309 B**, SHA256 **`661fccef52e9fbf39c76f6e3c3940cfda69b65dc8ab2efdef884937cad86d0d6`** (verified after Drive readback, 18 entries, CRC PASS). [Machine-readable exact SHA index](./NUXMV_NATIVE.json).

**Honest gate:** scoped native T3/fixture-level technical PASS; **not** original-repackaged T4, not full main CLI/MCP/SDK host end-to-end, not independent T5 model semantics or Product #11. The source Runner PR79 is currently separate/unmerged at time of recording. Require both exact-HEAD Woodpecker push+PR CI and independent non-Writer Source-First review before merges; avoid repeating unaffected historical tool tests. #7/#14 stay closed.

## R11 independent metadata-only repack candidate (not canonical)

The original `nuxmv-2.2.0` archive and official Drive `App/packages` remain unchanged. A separately stored [nuXmv corrected-metadata *candidate*](https://drive.google.com/file/d/1yjneRDGdgF5MAob2SKiCr3l3ZqqPe_wJ/view?usp=drivesdk) was made by replacing only `TOOL_TOOL_ID=nuxmv` with `TOOL_ID=nuxmv`. Across the exact original and candidate extracted archives, **33/33 ordinary files matched byte-for-byte except `tools/nuxmv/meta.sh`**, 39 tar entries; no unsafe symlinks. Candidate SHA256 `2d7b2f0037a043c35616198e2ee916a88d48e3abf54b99e6709c911a78b2b777`, 46,602,277 B, verified again after authenticated Drive readback. It is larger than the original because it uses fast deterministic zstd `-5` compression; no change to executable/library bytes.

A **clean, separately extracted root-owned candidate** (with PR79 Runner and this PR's fixed fixture) passed nonroot `doctor` exit 0, `version` exit 0 / 2.2.0, `verify` exit 0, exact native phase exits `0/0/1`, TSV SHA256 `876e7eb554d9cad34fdea1a6d04c40b1206023562c5d039a1e637f990b80aa7c`. [Machine-readable candidate pin](./CANDIDATE_PACKAGE.json). This improves T3 evidence but is **not** a formal T4 admission, since independent review and full original CLI/MCP/SDK endpoint receipts remain outstanding.

## R13 independent P2 tar-header provenance clarification

The statement "only `meta.sh` changed" above refers **only to decompressed regular-file payload bytes**. It does **not** mean the candidate tar is archive-metadata equivalent to the original. An independent original-versus-candidate tar-header comparison confirmed exactly **39/39 entries changed mode** from original `0755/0644` to candidate `0555/0444`, and **39/39 entry modification timestamps changed** (normalized to zero). UID and GID stayed identical (**0/39 changes**), and the 39 member paths match. The candidate is deliberately read-only and remains a **noncanonical validation artifact**; it is not an official replacement for the original SHA-pinned archive. The machine-readable table is in [CANDIDATE_PACKAGE.json](./CANDIDATE_PACKAGE.json).

After the historical R11 three-phase native receipt, the shared Runner path/ldd validation was repaired in a separate PR #79. The new Runner's exact source Blob `102e971481a3e213fdb41fa45230b1dd3beaf2bd` (PR #79 HEAD `3b119d14b3db32b9b2cba3895bb03f9e52d50dfc` at documentation time) was independently rebuilt in Debian13 and exercised without re-running native solvers: **174/174** path/symlink/metadata/ldd scoped checks under UID 65534 using GNU, BusyBox, and deliberately unavailable `readlink -f` fallback; nonroot actual nuXmv candidate `doctor` and `version` both returned 0 with private ICU linkage correctly recognized. [R13 original scoped test archive](https://drive.google.com/file/d/1uSaNNI6GW4GcxXb9vyS7CM6wg_wlAXAY/view?usp=drivesdk), SHA256 `08219fa6807d00861cf0a30e1226196905416bd9d68d2ea33266205c57f56eee`. R11 raw solver logs and their SHA remain unchanged. These checks do not grant full SDK/CLI/MCP T4 or semantic T5 qualifications.
