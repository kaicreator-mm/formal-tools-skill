# Issue #11 G6 R17 — original DIS checkout source integrity repair

**Technical-only. No Product/Oracle/Host authority, qualified Solution, positive Replay, or Effect grant.**

The already merged R16 real DIS target driver checked the original `domain-harness` Git HEAD plus ten pinned original source blobs. That is insufficient to establish the actual **complete tracked checkout** was unmodified: its two selected original tests import *additional* executable Git-tracked modules, which could be edited or staged while `git rev-parse HEAD` and all ten selected pins remain unchanged. A previously untracked injected import is also possible. The original R16 engineering receipt must not be mistaken for complete source/Host attestation.

## R17 bounded fix

- New `packages/runner/js/verified-git-worktree.mjs` requires the **original repository root**, checks `git ls-files -v -z --cached` and refuses any `assume-unchanged` (`h`) or `skip-worktree` (`S`) index flags **even if porcelain status reports a clean tree**; then checks `git status --porcelain=v1` for staged, changed, removed and non-ignored untracked paths, all under scrubbed `GIT_*` process variables.
- Explicit P2 protection enumerates ignored untracked files through `git ls-files --others --ignored --exclude-standard -z`, including paths hidden by `.git/info/exclude`, `core.excludesfile` and `.gitignore`. It rejects **every** ignored path outside directories named `node_modules` or `dist` at any depth. The two excluded directories are deliberately declared **UNATTESTED** dependencies/generated outputs, not verified or trusted source. This check is NOT a complete original execution/dependency integrity proof and cannot preclude an attacker placing executable code inside those excluded directories. No caller-provided flag may override it.
- The existing `real-dis-v020-target-consumer.mjs` now checks the worktree **before and after** original selected native DIS test processes. Exact Git HEAD + original ten Git blobs remain mandatory. This does not change real DIS SDK/KDP implementation.
- The new `tests/verified-git-worktree.test.mjs` creates actual fresh local Git repositories and verifies previous five cases and new `assume-unchanged` and `skip-worktree` modified tracked files, hidden `.git/info/exclude` and global `core.excludesfile` injected executables, and an explicitly untrusted dependency/generated directory positive boundary. Local Linux Node22: **10/10 PASS**.
- Existing historical R16 `validation/g6-dis-target-real-2026-11-14/RECEIPT.json` remains byte-for-byte **immutable**, pinned to the original R16 driver Git Blob `3b8f6045247dc8819da3a85068668147d64840ad`. The existing receipt test distinguishes that actual prior Host run from the **new R17 guarded source**, rather than falsely rewriting its provenance. A NEW real Node24 Linux/x64 run of R17 original DIS child processes requires its own separate recorded receipt; Node24 CI on R17 only proves the checked-in tests/contract, **not** such a new Host run unless it explicitly executes it.

## Explicit exclusions and remaining risk

The index/status/ignored-path guard deliberately **does not** independently verify ignored `node_modules` or any `dist` generated output (including potentially executable bytes); these are the two explicitly accepted ignored directories, at any depth. It also does not authenticate npm installed dependencies, the executing Host, or prevent simultaneous swap-and-restore between checks. It is a narrower source-integrity improvement, not a complete dependency supply-chain or atomic execution proof. Original Product Owner Source/Claim + independent professional Oracle + trusted Host credentials, actual authorized G4 Solution/Replay, and a separately qualified DIS Effect remain **BLOCKED**. Do not close #11, modify #7/#14, or expand #24/#4.

## Reproduction

```sh
node --test tests/verified-git-worktree.test.mjs
node --test tests/llm-g6-real-dis-target.test.mjs
```

Use the original `domain-harness` HEAD and original source pins from the versioned R16 receipt. Never treat the original 3/3 + 9/9 execution as an R17 execution at new source bytes.
