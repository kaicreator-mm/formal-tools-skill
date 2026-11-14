# I24 / R17 — Why3 P0 host-file safety and scoped nonroot native execution

**OUTPUT_LABEL:** `FORMAL_TOOLS_I24_TOOL_INTEGRATION_CONTINUE`  
**Owner:** #24, tool issue #59, Product #11 (no promotion), Runtime #4 (not reopened).

## P0: original delivered script can destroy the host's OCaml directory

The original Why3 package `tools/why3/run`, and current main builder `portable/builders/tools/why3.sh` (Git Blob `7edc977f0d60ad9f20044bc9893526e2fbbb72ab`) contained literal `rm -rf /usr/lib/x86_64-linux-gnu/ocaml` followed by host `mkdir -p /usr/lib/...` and symlink creation. When executed as root this could delete the OS's OCaml installation. **The unsafe original run script was never executed during R17**, and its original Drive file remains unchanged. Avoid any privileged execution until repaired software is independently accepted. This is a P0 potential host-integrity violation, not an assertion that a system was actually damaged.

The repair in this PR:
- Strips absolute symlinks *inside the tool payload*, not their host-side destinations, before any resulting portable archive is constructed; verifies no absolute links remain; records the count.
- Removes every direct host-`/usr` deletion/creation/link from the tool-specific generated `run`.
- Sets the Why3 data, OCaml and library path variables, but **does not claim these relocate the Debian 1.8.0 command plugin loader**. Unconfined `--version` and metadata print options work, while config/prove and all other subcommands return explicit **`WHY3_RELOCATION_NOT_QUALIFIED` exit 2**, rather than accessing foreign host command plugins.
- Adds a Node-level regression that rejects host mutation statements and executes a fixture-generated safe run shim to demonstrate `--version` succeeds but `config detect`/`prove` cannot reach the original binary. Source/build-time safety is separate from semantic proof qualification.

## Independently staged candidate, not canonical

Original new Drive Why3 archive **41,550,468 B**, SHA256 **`5343afcbccd2805dbf9c1ff7689371ced7857a42d0f57615d22e9bee701ff8f3`**; the old `App/packages/SHA256SUMS` entry **`6a0e3cc7...`** is STALE. No silent checksum re-pin or publisher attestation.

One-pass safe stream unpack: **5,346 original entries** = 3,681 regular, 1,350 dirs and 315 symlinks; discard 27 absolute links; keep 288 confined relative links. No name traversal or special file output. A separate candidate package has **5,319 members**; **3,680/3,681 regular file contents remain byte-identical** to the original; the only modified regular payload is `tools/why3/run`. Every candidate tar member mtime was normalized, which is an archive-metadata change, not a content-only claim.

[Noncanonical R17 sanitized candidate tar on Drive](https://drive.google.com/file/d/1HwD8zM9uayJkGtpDuKZL9hdNdzVXo6Sb/view?usp=drivesdk), **54,709,487 B**, SHA256 `62a16b57fd90ed6fdded53c34ddeeddbd375e05d0eb6ab905b4ee82715ce6ed2`, original safe preflight/ZIP SHA and downloaded candidate SHA confirmed. **Do not overwrite the original `App/packages` archive.**

## Real Why3 1.8.0 + Z3 5.4.0 under private chroot

The SHA-pinned original Z3 5.4.0 tool package, `039d3f8c75e92ceb196bb1291d8602340541f1b1be2f0a1acf32d3c025f8ed16`, was safely extracted and executed nonroot. Direct nonroot `why3 --version` with the sanitized shim returns 0 / 1.8.0; normal-host `config detect` and `prove` return 2 from the safe gate. The unconfined binary cannot resolve Debian's *compiled-in absolute* OCaml commands path; the documented `WHY3LIB` override was not sufficient during direct execution.

An isolated **private chroot directory** maps the bundled Why3 `usr/lib/.../why3/commands` to its required compiled-in path **within the chroot only**; it is never created on the real host. Real Why3/Z3 processes ran as UID/GID 65534. For this research-only native test, host libc/libz/libgmp and loader were copied into the private chroot; a regular test placeholder represented `/dev/null` because creating a real device node is denied. **The test runtime is nonhermetic and not production-qualified.** Actual bounded processes:

| Phase | Native exit | Why3 output |
| --- | ---: | --- |
| `config detect` | 0 | 3 prover entries, Z3 5.4.0 **UNRECOGNIZED VERSION** (Why3 rule set recognizes Z3 through 4.13) |
| POS `1+1=2` | 0 | `Valid` |
| NEG `1+1=3` | 2 | `Unknown (sat)` |
| ERR malformed WhyML | 1 | `syntax error` |

[Raw R17 source bytes, preflight, file-level archive comparison, stdout/stderr and receipt hashes](https://drive.google.com/file/d/1DSUlyhSoUhsWXIjCbgsEcHf9p-zV2AWd/view?usp=drivesdk), **9,683 B**, SHA256 **`c5269fed620d62e56ff3eac05a4faf0b58bba73a8bddb15b736190efa783405e`** (27 ZIP entries, CRC verified, authenticated Drive readback). [Machine-readable R17 index](./WHY3_SAFE_NATIVE.json).

## Honest closure gate

P0 source safety remediation is a PR candidate and requires exact-HEAD Woodpecker, independent non-Writer Source-First review and an official rebuilt portable archive. Even the corrected version-only shim remains deliberately **fail-closed for unrelocated proof commands**; the private-chroot POS/NEG/ERR result is bounded **T3 technical research**, not full original package native T3, T4 shared CLI/MCP/SDK admission, T5 domain Oracle, Product #11 or Release. A production-quality solution still needs a relocatable Why3 build or a supported independently reviewed container/sandbox runtime, pinned Z3 prover support and ordinary host-ABI/rights review.

All other 35 tools, old original packages and #7/#14 remain unchanged.
