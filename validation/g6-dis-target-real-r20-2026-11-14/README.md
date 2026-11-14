# G6 R20 guarded real DIS v0.2.0 target consumption — bounded Linux/x64 Node24 receipt (2026-11-14)

Issue #11 R20 closeout. One bounded execution of the **#88-repaired**
(original-DIS HEAD and original test subprocesses bound to a sanitized Git
environment) original `kaicreator-mm/domain-harness` DIS v0.2.0 SDK/KDP target
consumer at the pinned draft PR #1497 HEAD
`90afefa81ef9ad0d42087ffc8a0dbaa32757811f` — no reimplementation, no modified
original bytes, no new solver or LLM calls. The historical R16 receipt at
`validation/g6-dis-target-real-2026-11-14/RECEIPT.json` (blob
`9d6b906e88e2d8799f6082299d2eaaf13aa69bf2`) and the R17 receipt at
`validation/g6-dis-target-real-r17-2026-11-14/RECEIPT.json` stay
byte-identical and are never retrofitted.

## Gate chain that preceded this run

- PR #88 `fix(i11/g6): bind original DIS HEAD and subprocesses to sanitized
  Git environment` reviewed by a separate non-Writer conversation at exact
  head `d1b2caf109d98abcf157ff71b02de97826c46b41` — **ACCEPT_SCOPED,
  P0=0/P1=0/P2=0** ([review comment](https://github.com/kaicreator-mm/formal-tools/pull/88#issuecomment-6879313713)):
  independent byte materialization from the mirror, CI #803 (push) / #804
  (pull_request) verified SUCCESS on that exact commit via the Woodpecker
  API, and 12/12 Git POS/NEG tests re-passed locally on win32 Node v24.21.0
  (cross-platform confirmation of the Writer's Linux Node22 12/12).
- Merged with a two-parent merge commit: main
  `7b97821aeeae2042cff63738c37d17bd54dd55cf`, parents
  `7f8cb083cb026e397228e9cf9eb6772191f258d2` + `d1b2caf1…`; merge tree
  `7e24fcf6082056d4d7f71747fc9515ea505f370c` = main tree + exactly the three
  reviewed file changes (driver `0954f885d485eec76d3b5131de192e6296a8b15a`,
  guard `672937eacebf133f65daf8e9bf6ea1158145ff59`, new regression test
  `b56440a25c01b5356eb75a5438029d2f464a843b`).
- Post-merge main CI: pipeline **#814 failed in the clone step only**
  (`TLS connect error: error:0A000126 SSL routines::unexpected eof`,
  exit status 128 after 3 retries; the build step log is `null` — it never
  started). Root cause = agent-side GitHub pull transient per the
  2026-11-10 #2395→#2396 precedent, **not** a source failure. Same-SHA rerun
  via API = pipeline **#817 SUCCESS** on `7b97821…` (its clone log shows the
  fetch retry then `git reset --hard 7b97821…`). No empty commit was created
  and no PR branch was touched.

## What ran

Driver: `benchmarks/llm-methods/g6/real-dis-v020-target-consumer.mjs`
(git blob `0954f885d485eec76d3b5131de192e6296a8b15a`, LF form; re-verified
with `git hash-object` on the executing working-tree file) from formal-tools
merged main `7b97821aeeae2042cff63738c37d17bd54dd55cf`.

Host: real Linux/x64 (`Linux 6.18.58.1-microsoft-standard-WSL2` x86_64,
same WSL2 execution class as the R17 receipt), Node **v24.21.0**, fresh
durable G4 store `/home/cc/g6-store-r20` on ext4 (owner `cc`, mode 0700
files), original domain-harness checkout verified clean (0 porcelain lines)
before and after the run, formal-tools checkout clean (0 porcelain lines)
at `7b97821…`.

Provisioning trail (honest record): the first invocation attempt aborted
fail-closed in ~0.4 s with
`REAL_DIS_V020_TARGET_CONSUMPTION_BLOCKED: durable store did not persist the
unqualified candidate fail-closed` because the store directory had not been
provisioned (`ownerDirectory` `lstat`s an absent path; the driver requires
an owner-provisioned store root). No stdout, no receipt, no store bytes were
produced by that attempt. After `mkdir /home/cc/g6-store-r20` by the owner,
the **single authoritative run** below was executed; nothing else changed
between the two invocations.

Receipt binding (all inside `RECEIPT.json`, schema
`formal-tools/i11-real-dis-v020-target-consumption/0.1`):

- `source_head = 7b97821…` (merged main) and `driver_git_blob = 0954f885…`
  (computed in-process from the executing driver bytes, matching the
  reviewed/merged git blob).
- `execution_platform = v24.21.0 / linux / x64`.
- `dis_target_reference.source_head` and `original_target.verified_head` =
  `90afefa8…` (exact original HEAD) + all ten source pins re-verified.
- `original_target.clean_checkout_before` / `clean_checkout_after` — the
  #88-repaired guard results on both sides of the original child processes:
  tracked worktree clean, index flags clean (no `assume-unchanged` /
  `skip-worktree`), no nonignored untracked sources, no ignored files
  outside `node_modules`/`dist`; dependency/generated trees remain
  explicitly **UNATTESTED** (`*_independently_attested: false`,
  `race_free_execution_attested: false`). HEAD resolution now shares the
  same `realpath`-canonical root and `GIT_*`-stripped environment as the
  worktree guard (the P1 closed by #88).
- Original chain, executed as unmodified child processes
  (`node --import tsx --test`, `env:sanitizedGitEnv()`):
  - `examples/dis-v020-native-sdk/b05-target-consumer.test.mjs`: exit 0,
    3/3 pass, stdout sha256
    `21a193d7e5e440d81a8ea70b1b7e98986f622ac14b65fde17ea02d89b7ec60f2`
    (655 ms).
  - `examples/dis-v020-cross-project/selected-build.test.mjs`: exit 0,
    9/9 pass, stdout sha256
    `185c02059ede5e378997acef5485c5dfff51f2f10a351df184082fcba6d6c51d`
    (503 ms).
  The two child `stdout_sha256` values are timing-bound (node:test TAP
  embeds per-test durations), so they differ from the R17 receipt's hashes
  by design; the semantic assertions are identical.
- Durable store adversarial boundary: `CANDIDATE_PERSISTED` →
  `REPLAY_BLOCKED_UNQUALIFIED` → `STALE` under provenance drift →
  `INVALIDATED` under `OPERATOR_REVOKED` → tombstone dominates → identical
  bytes cannot resurrect.
- Owner/Oracle/Host witness **strictly BLOCKED**
  (`PRODUCT_TRUST_ROOTS_NOT_APPROVED`; `effect_dispatched=false`,
  `positive_replay=BLOCK`); DIS preflight envelope `kind=UNKNOWN`,
  `authority=NONE`, `effect_dispatched=false`, `host_invocations=0`;
  `dis_effects=0`, `original_claim=UNVERIFIED`, `qualified_replay=false`,
  `status=PASSED_ENGINEERING_ONLY`.

Receipt file: sha256
`fe67f6070648e30700f3ba1686ff6db2fcd242bbb6f5166ec467ed411fa4cd71`
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
STORE=$(mktemp -d)   # must pre-exist: ownerDirectory lstat()s the path
node benchmarks/llm-methods/g6/real-dis-v020-target-consumer.mjs \
  "$STORE" <formal-tools HEAD sha> "$(cd .. && pwd)/domain-harness"
```

Run on Linux/x64 with Node >= 24. Any drift of the original HEAD (including
ambient `GIT_DIR`/`GIT_WORK_TREE` redirection attempts, now sanitized), any
flagged/skipped index entry, any ordinary worktree drift, or any ignored
source outside `node_modules`/`dist` aborts the driver before or after the
original chain executes (fail-closed).
