# G6 R17 guarded real DIS v0.2.0 target consumption — bounded Linux/x64 Node24 receipt (2026-11-14)

Issue #11 R18/R19 closeout. One bounded execution of the **R18-guarded**
original `kaicreator-mm/domain-harness` DIS v0.2.0 SDK/KDP target consumer at
the pinned draft PR #1497 HEAD `90afefa81ef9ad0d42087ffc8a0dbaa32757811f` —
no reimplementation, no modified original bytes, no new solver or LLM calls.
This is the **new R17 receipt** bound to the repaired driver; the historical
R16 receipt at `validation/g6-dis-target-real-2026-11-14/RECEIPT.json` stays
byte-identical and is never retrofitted.

## What ran

Driver: `benchmarks/llm-methods/g6/real-dis-v020-target-consumer.mjs`
(git blob `2c457f42b0cf017ea27a2618012a42e30091bfa2`, LF form) from
formal-tools merged main `e2d20190fdea3084c72bd70de1c15cf9500d128d`
(tree `dc90c07641f5d0299a5727c1d659f8eb4fc37d64`, byte-identical to the
reviewed PR #85 head `0298483b80c8d84e882a7e5cb088a2853204fd17`).

Host: real Linux/x64 (`Linux ... microsoft-standard-WSL2 x86_64`), Node
**v24.21.0**, fresh durable G4 store on ext4, original checkout verified
clean before and after.

Receipt binding (all inside `RECEIPT.json`, schema
`formal-tools/i11-real-dis-v020-target-consumption/0.1`):

- `driver_git_blob = 2c457f42…` (computed in-process from the executing
  driver bytes, not from a checkout claim).
- `execution_platform = v24.21.0 / linux / x64`.
- `dis_target_reference.source_head` and `original_target.verified_head` =
  `90afefa8…` (exact original HEAD) + all ten source pins re-verified.
- `original_target.clean_checkout_before` / `clean_checkout_after` — the
  R18 Git guard results on both sides of the original child processes:
  tracked worktree clean, index flags clean (no `assume-unchanged` /
  `skip-worktree`), no nonignored untracked sources, no ignored files
  outside `node_modules`/`dist`; dependency/generated trees remain
  explicitly **UNATTESTED** (`*_independently_attested: false`,
  `race_free_execution_attested: false`).
- Original chain, executed as unmodified child processes
  (`node --import tsx --test`):
  - `examples/dis-v020-native-sdk/b05-target-consumer.test.mjs`: exit 0,
    3/3 pass, stdout sha256 `48fef2faf42c3e971088a56b99a53648a0c3bdd7bc144a1a8ea2b2024ce0616a`.
  - `examples/dis-v020-cross-project/selected-build.test.mjs`: exit 0,
    9/9 pass, stdout sha256 `55c3df3ab8d65a68ebc8b0a04026a29712ec4e0bc6d18b7e2aea2a1319975a82`.
- Durable store adversarial boundary: `STALE` under provenance drift,
  `INVALIDATED` under `OPERATOR_REVOKED`, tombstone dominates, identical
  bytes cannot resurrect.
- Owner/Oracle/Host witness **strictly BLOCKED**
  (`PRODUCT_TRUST_ROOTS_NOT_APPROVED`; `effect_dispatched=false`,
  `positive_replay=BLOCK`); DIS preflight envelope `kind=UNKNOWN`,
  `authority=NONE`, `effect_dispatched=false`, `host_invocations=0`;
  `dis_effects=0`, `original_claim=UNVERIFIED`, `qualified_replay=false`.

Receipt file: sha256 `89afb53e48181cae021db8471f74360e2babf5de8e2a3e20a2f727d4154a3fee`
(6813 bytes, LF, byte-exact copy of the driver's stdout).

## What this receipt is NOT

- Not a Product PASS, business attestation or formal G5 acceptance.
- Not a Host attestation: the execution host is not an independently
  credentialed formal-tools Host (`host_independently_attested: false`,
  `source_commit_independently_attested: false`).
- Not an authorized positive Replay: qualification is BLOCK on all gates.
- The Git guard does not attest npm dependency contents, generated outputs,
  concurrent swap-and-restore races, or the Host identity.
- Not new Z3/cvc5 or DeepSeek work: zero new solver/LLM invocations.

## Reproduce

```sh
git clone https://github.com/kaicreator-mm/domain-harness.git
git -C domain-harness checkout 90afefa81ef9ad0d42087ffc8a0dbaa32757811f
cd domain-harness && npm ci --ignore-scripts
STORE=$(mktemp -d)
node benchmarks/llm-methods/g6/real-dis-v020-target-consumer.mjs \
  "$STORE" <formal-tools HEAD sha> "$(cd .. && pwd)/domain-harness"
```

Run on Linux/x64 with Node >= 24. Any drift of the original HEAD, any
flagged/skipped index entry, any ordinary worktree drift, or any ignored
source outside `node_modules`/`dist` aborts the driver before or after the
original chain executes (fail-closed).
