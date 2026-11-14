import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const TEMPLATE = resolve("portable/packaging/bundle-template/bin/tool-runner");
const onLinux = process.platform === "linux";

function fixture(runScript, expectSource) {
  const root = mkdtempSync(join(tmpdir(), "ft-i11-portable-"));
  mkdirSync(join(root, "bin"), { recursive: true });
  mkdirSync(join(root, "tools/mock"), { recursive: true });
  cpSync(TEMPLATE, join(root, "bin/tool-runner"));
  chmodSync(join(root, "bin/tool-runner"), 0o755);
  writeFileSync(join(root, "tools/mock/meta.sh"), "TOOL_ID=mock\nTOOL_KIND=binary\nTOOL_VERSION=1.0\n");
  writeFileSync(join(root, "tools/mock/run"), "#!/bin/sh\n" + runScript + "\n");
  chmodSync(join(root, "tools/mock/run"), 0o755);
  if (expectSource !== null) {
    mkdirSync(join(root, "tests/mock"), { recursive: true });
    writeFileSync(join(root, "tests/mock/expect.sh"), expectSource);
  }
  const run = (target = "mock") => spawnSync("bash", [join(root, "bin/tool-runner"), "verify", target], {
    cwd: root, encoding: "utf8", timeout: 15_000,
    env: { ...process.env, FT_EVIDENCE_DIR: join(root, "evidence") }
  });
  return { root, run, receipt: () => readFileSync(join(root, "evidence/verify-mock.tsv"), "utf8"),
    cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

const EXPECT_POS = "EXPECT_POS_ARGS=''\nEXPECT_POS_EXIT=0\nEXPECT_POS_REGEX='^SAT'\nEXPECT_POS_LABEL=SAT\n";

test("portable runner records real nonzero exit even when stdout matches SAT", { skip: !onLinux }, () => {
  const f = fixture("echo SAT; exit 7", EXPECT_POS);
  try {
    const p = f.run();
    assert.equal(p.status, 1, p.stderr);
    assert.match(f.receipt(), /mock\tpos\t7\t[^\n]*\t1\t0\tSAT/);
    assert.match(f.receipt(), /verdict\tFAIL/);
  } finally { f.cleanup(); }
});

test("portable runner accepts correct typed stdout and zero exit", { skip: !onLinux }, () => {
  const f = fixture("echo SAT; exit 0", EXPECT_POS);
  try {
    const p = f.run();
    assert.equal(p.status, 0, p.stderr);
    assert.match(f.receipt(), /mock\tpos\t0\t[^\n]*\t1\t1\tSAT/);
    assert.match(f.receipt(), /verdict\tPASS/);
  } finally { f.cleanup(); }
});

test("missing verification contract is SKIP and makes verify all nonzero", { skip: !onLinux }, () => {
  const f = fixture("echo SAT; exit 0", null);
  try {
    const p = f.run("all");
    assert.equal(p.status, 1, p.stderr);
    assert.match(f.receipt(), /verdict\tSKIP/);
    assert.match(p.stdout, /verify-all verdict: FAIL/);
  } finally { f.cleanup(); }
});

test("failed mandatory setup cannot be hidden by a passing positive case", { skip: !onLinux }, () => {
  const expectSetup = "EXPECT_SETUP_VIA=run\nEXPECT_SETUP_ARGS='setup'\n" + EXPECT_POS;
  const f = fixture('if [ "${1:-}" = setup ]; then echo PREPARE; exit 3; fi; echo SAT; exit 0', expectSetup);
  try {
    const p = f.run();
    assert.equal(p.status, 1, p.stderr);
    assert.match(f.receipt(), /mock\tsetup\t3\t[^\n]*\t1\t0\tSETUP/);
    assert.match(f.receipt(), /verdict\tFAIL/);
    assert.doesNotMatch(f.receipt(), /mock\tpos/);
  } finally { f.cleanup(); }
});

test("non-executable run shim is SKIP for verify and exit 126 for run, never PASS", { skip: !onLinux }, () => {
  const f = fixture("echo SAT; exit 0", EXPECT_POS);
  chmodSync(join(f.root, "tools/mock/run"), 0o644);
  try {
    const p = f.run();
    assert.equal(p.status, 1, p.stderr);
    assert.match(f.receipt(), /verdict\tSKIP/);
    assert.doesNotMatch(f.receipt(), /mock\tpos/);
    const r = spawnSync("bash", [join(f.root, "bin/tool-runner"), "run", "mock"], {
      cwd: f.root, encoding: "utf8", timeout: 15_000,
      env: { ...process.env, FT_EVIDENCE_DIR: join(f.root, "evidence") }
    });
    assert.equal(r.status, 126, `run rc=${r.status} err=${r.stderr}`);
  } finally { f.cleanup(); }
});
