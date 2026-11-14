import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, chmodSync, rmSync, symlinkSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const original = fileURLToPath(new URL('../portable/packaging/bundle-template/bin/tool-runner', import.meta.url));
function withFixture(meta, run) {
  const root = mkdtempSync(join(tmpdir(), 'ft-portal-meta-'));
  try {
    const bin = join(root, 'bin');
    const dir = join(root, 'tools', 'highs');
    mkdirSync(bin, {recursive:true});
    mkdirSync(dir, {recursive:true});
    copyFileSync(original,join(bin,'tool-runner'));
    chmodSync(join(bin,'tool-runner'),0o755);
    writeFileSync(join(dir,'meta.sh'),meta);
    return run((command,extraEnv={}) => spawnSync('bash',[join(bin,'tool-runner'),command,'highs'], {
      encoding:'utf8',timeout:5000,env:{...process.env,FT_EVIDENCE_DIR:join(root,'receipts'),...extraEnv}
    }), root);
  } finally {
    rmSync(root,{recursive:true,force:true});
  }
}
// Generic bundle factory for adversarial-ID / containment tests (arbitrary ids).
function bundle() {
  const root = mkdtempSync(join(tmpdir(), 'ft-portal-r13-'));
  const bin = join(root, 'bin');
  mkdirSync(bin, {recursive:true});
  copyFileSync(original, join(bin, 'tool-runner'));
  chmodSync(join(bin, 'tool-runner'), 0o755);
  const exe = (command, id, extraEnv={}) => spawnSync('bash', [join(bin,'tool-runner'), command, ...(id === undefined ? [] : [id])], {
    encoding:'utf8', timeout:5000, env:{...process.env, FT_EVIDENCE_DIR:join(root,'receipts'), ...extraEnv}
  });
  const addTool = (id, meta, files={}) => {
    const dir = join(root, 'tools', id);
    mkdirSync(dir, {recursive:true});
    if (meta !== null) writeFileSync(join(dir,'meta.sh'), meta);
    for (const [name, body] of Object.entries(files)) {
      writeFileSync(join(dir,name), body);
      chmodSync(join(dir,name), 0o755);
    }
    return dir;
  };
  return { root, exe, addTool, cleanup: () => rmSync(root,{recursive:true,force:true}) };
}
// Escape target outside the bundle whose self-consistent metadata would have
// satisfied the old runner's equality gate for the given requested id.
function outsideEscape(metaBody) {
  const outside = mkdtempSync(join(tmpdir(), 'ft-portal-out-'));
  writeFileSync(join(outside,'meta.sh'), metaBody);
  writeFileSync(join(outside,'run'), '#!/bin/sh\necho PATH_ESCAPE_EXECUTED\n');
  chmodSync(join(outside,'run'), 0o755);
  return outside;
}
const good = 'TOOL_ID=highs\nTOOL_VERSION=1.15.1\nTOOL_KIND=unprobed\nUNAVAILABLE=0\n';

test('portable metadata: identity/version/doctor pass when correct', () => {
  withFixture(good, exe => {
    const d=exe('doctor');const v=exe('version');
    assert.equal(d.status,0,d.stderr);assert.match(d.stdout,/doctor: highs .*verdict: OK/s);
    assert.equal(v.status,0,v.stderr);assert.match(v.stdout,/tool: highs\nversion: 1\.15\.1/);
  });
});

test('portable metadata: legacy TOOL_TOOL_ID fails closed for doctor, version, and run', () => {
  withFixture(good.replace('TOOL_ID=','TOOL_TOOL_ID='), exe => {
    for (const cmd of ['doctor','version','run']) {
      const p=exe(cmd);
      assert.equal(p.status,2,`${cmd}: ${p.stderr}`);
      assert.match(p.stderr,/invalid tool metadata/);
      assert.doesNotMatch(p.stdout,/verdict: OK/);
    }
  });
});

test('portable metadata: environment TOOL_ID spoof cannot hide missing ID', () => {
  withFixture(good.replace('TOOL_ID=','TOOL_TOOL_ID='), exe => {
    const p=exe('doctor',{TOOL_ID:'highs'});
    assert.equal(p.status,2,p.stderr);
    assert.match(p.stderr,/invalid tool metadata/);
  });
});

test('portable metadata: foreign identity is rejected before version/doctor', () => {
  withFixture(good.replace('TOOL_ID=highs','TOOL_ID=z3'), exe => {
    for(const cmd of ['doctor','version','run']) {
      const p=exe(cmd);assert.equal(p.status,2,p.stderr);
    }
  });
});

test('portable metadata: missing version or kind is rejected', () => {
  for (const m of [good.replace('TOOL_VERSION=1.15.1',''),good.replace('TOOL_KIND=unprobed','')]) {
    withFixture(m, exe => {
      const p=exe('doctor');assert.equal(p.status,2,p.stderr);
      assert.match(p.stderr,/invalid tool metadata/);
    });
  }
});

test('doctor uses bundled native library directory while still failing on truly absent dependency', () => {
  const meta = good + 'TOOL_MAIN_BIN=tools/highs/bin/highs\n';
  withFixture(meta, (exe, root) => {
    const lib = join(root, 'tools', 'highs', 'lib');
    const binary = join(root, 'tools', 'highs', 'bin');
    const mocks = join(root, 'mockbin');
    mkdirSync(lib, {recursive:true});
    mkdirSync(binary, {recursive:true});
    mkdirSync(mocks, {recursive:true});
    writeFileSync(join(binary, 'highs'), 'test-only binary placeholder');
    const ldd = join(mocks, 'ldd');
    writeFileSync(ldd, [
      '#!/bin/sh',
      'case ":${LD_LIBRARY_PATH:-}:" in',
      '  *:"' + lib + '":*) echo "libsolver.so => ' + lib + '/libsolver.so";;',
      '  *) echo "libsolver.so => not found";;',
      'esac',
      ''
    ].join('\n'));
    chmodSync(ldd, 0o755);
    const env = {PATH:mocks + ':' + process.env.PATH};
    const pass = exe('doctor',env);
    assert.equal(pass.status,0, pass.stdout+pass.stderr);
    assert.match(pass.stdout,/ldd: no missing libs OK/);
    rmSync(lib,{recursive:true,force:true});
    const fail = exe('doctor',env);
    assert.equal(fail.status,1,fail.stdout+fail.stderr);
    assert.match(fail.stdout,/ldd missing libs: 1 FAIL/);
  });
});

test('R13 P1: traversal, absolute, separator and dot-segment tool IDs are rejected before any source/exec', () => {
  const b = bundle();
  try {
    // Escape target OUTSIDE the bundle whose meta.sh self-identifies as the
    // traversal id, so the old equality gate alone would have admitted it.
    const outside = mkdtempSync(join(tmpdir(), 'ft-portal-out-'));
    const rel = relative(join(b.root, 'tools'), outside);
    writeFileSync(join(outside,'meta.sh'), `TOOL_ID=${rel}\nTOOL_VERSION=9.9\nTOOL_KIND=unprobed\n`);
    writeFileSync(join(outside,'run'), '#!/bin/sh\necho PATH_ESCAPE_EXECUTED\n');
    chmodSync(join(outside,'run'), 0o755);
    const badIds = [rel, '../' + basename(outside), '/etc', '/highs', '.', '..', 'a/b', 'a/../b', './highs', '../highs'];
    for (const bad of badIds) {
      for (const cmd of ['doctor','version','run']) {
        const p = b.exe(cmd, bad);
        assert.equal(p.status, 2, `${cmd} ${JSON.stringify(bad)}: rc=${p.status} out=${p.stdout} err=${p.stderr}`);
        assert.doesNotMatch(p.stdout, /PATH_ESCAPE_EXECUTED/, `${cmd} ${JSON.stringify(bad)} executed outside program`);
        assert.doesNotMatch(p.stdout, /verdict: OK/, `${cmd} ${JSON.stringify(bad)} passed doctor`);
        assert.doesNotMatch(p.stdout, /version: 9\.9/, `${cmd} ${JSON.stringify(bad)} leaked outside metadata`);
        assert.match(p.stderr, /invalid tool id/, `${cmd} ${JSON.stringify(bad)}: ${p.stderr}`);
      }
    }
  } finally { b.cleanup(); }
});

test('R13 P1: symlinked meta.sh that escapes tools/<id> is refused despite matching TOOL_ID', () => {
  const b = bundle();
  try {
    const outside = mkdtempSync(join(tmpdir(), 'ft-portal-out-'));
    writeFileSync(join(outside,'meta.sh'), good); // TOOL_ID=highs, would pass equality
    writeFileSync(join(outside,'run'), '#!/bin/sh\necho SYMLINK_ESCAPE_EXECUTED\n');
    chmodSync(join(outside,'run'), 0o755);
    b.addTool('highs', null);
    symlinkSync(join(outside,'meta.sh'), join(b.root,'tools','highs','meta.sh'));
    for (const cmd of ['doctor','version','run']) {
      const p = b.exe(cmd, 'highs');
      assert.equal(p.status, 2, `${cmd}: rc=${p.status} out=${p.stdout} err=${p.stderr}`);
      assert.doesNotMatch(p.stdout, /verdict: OK/);
      assert.doesNotMatch(p.stdout, /SYMLINK_ESCAPE_EXECUTED/);
      assert.match(p.stderr, /resolves outside tools\/highs/, p.stderr);
    }
  } finally { b.cleanup(); }
});

test('R13 P1: symlinked run shim that escapes tools/<id> is not executed', () => {
  const b = bundle();
  try {
    const outside = mkdtempSync(join(tmpdir(), 'ft-portal-out-'));
    writeFileSync(join(outside,'run'), '#!/bin/sh\necho SYMLINK_ESCAPE_EXECUTED\n');
    chmodSync(join(outside,'run'), 0o755);
    b.addTool('highs', good); // regular in-place meta.sh passes identity + containment
    symlinkSync(join(outside,'run'), join(b.root,'tools','highs','run'));
    const p = b.exe('run', 'highs');
    assert.equal(p.status, 2, `rc=${p.status} out=${p.stdout} err=${p.stderr}`);
    assert.doesNotMatch(p.stdout, /SYMLINK_ESCAPE_EXECUTED/);
    assert.match(p.stderr, /invalid tool entry/, p.stderr);
  } finally { b.cleanup(); }
});

test('R13 P1: symlinked expect.sh that escapes tests/<id> is never sourced by verify', () => {
  const b = bundle();
  try {
    const outside = mkdtempSync(join(tmpdir(), 'ft-portal-out-'));
    writeFileSync(join(outside,'expect.sh'), 'echo EXPECT_SOURCED\n');
    b.addTool('highs', good, {run: '#!/bin/sh\nexit 0\n'});
    mkdirSync(join(b.root,'tests','highs'), {recursive:true});
    symlinkSync(join(outside,'expect.sh'), join(b.root,'tests','highs','expect.sh'));
    const p = b.exe('verify', 'highs');
    assert.notEqual(p.status, 0, `verify must fail closed: out=${p.stdout}`);
    const combined = String(p.stdout) + String(p.stderr);
    assert.doesNotMatch(combined, /EXPECT_SOURCED/, 'outside expect.sh was sourced');
    const receipt = readFileSync(join(b.root,'receipts','verify-highs.tsv'), 'utf8');
    assert.match(receipt, /verdict\tFAIL/);
    assert.doesNotMatch(receipt, /verdict\tPASS/);
  } finally { b.cleanup(); }
});

test('R13 P2: doctor fails closed when ldd probe errors or produces no dependency listing', () => {
  const meta = good + 'TOOL_MAIN_BIN=tools/highs/bin/highs\n';
  const mockLdd = [
    '#!/bin/sh',
    'if [ -n "${LDD_MODE:-}" ]; then',
    '  case "$LDD_MODE" in',
    '    fail42) exit 42;;',
    '    empty) exit 0;;',
    '  esac',
    'fi',
    'echo "libsolver.so => not found"',
    ''
  ].join('\n');
  const withMock = () => {
    const b = bundle();
    const dir = b.addTool('highs', meta, {run: '#!/bin/sh\nexit 0\n'});
    mkdirSync(join(dir,'bin'), {recursive:true});
    writeFileSync(join(dir,'bin','highs'), 'test-only binary placeholder');
    const mocks = join(b.root, 'mockbin');
    mkdirSync(mocks, {recursive:true});
    writeFileSync(join(mocks,'ldd'), mockLdd);
    chmodSync(join(mocks,'ldd'), 0o755);
    return { b, env: {PATH: mocks + ':' + process.env.PATH} };
  };
  try {
    { // ldd subprocess fails (exit 42) with no listing => FAIL, never OK
      const { b, env } = withMock();
      try {
        const p = b.exe('doctor', 'highs', {...env, LDD_MODE:'fail42'});
        assert.equal(p.status, 1, `rc=${p.status} out=${p.stdout}`);
        assert.match(p.stdout, /ldd probe FAILED \(rc=42/);
        assert.doesNotMatch(p.stdout, /verdict: OK/);
        assert.match(p.stdout, /verdict: FAIL/);
      } finally { b.cleanup(); }
    }
    { // ldd exits 0 with empty output => no dependency listing => FAIL
      const { b, env } = withMock();
      try {
        const p = b.exe('doctor', 'highs', {...env, LDD_MODE:'empty'});
        assert.equal(p.status, 1, `rc=${p.status} out=${p.stdout}`);
        assert.match(p.stdout, /ldd probe FAILED \(rc=0/);
        assert.doesNotMatch(p.stdout, /ldd: no missing libs OK/);
      } finally { b.cleanup(); }
    }
    { // private lib dir symlinked outside the tool directory => FAIL
      const { b, env } = withMock();
      try {
        const outside = mkdtempSync(join(tmpdir(), 'ft-portal-out-'));
        mkdirSync(join(outside,'lib'), {recursive:true});
        const dir = join(b.root,'tools','highs');
        rmSync(join(dir,'lib'), {recursive:true, force:true});
        symlinkSync(join(outside,'lib'), join(dir,'lib'));
        const p = b.exe('doctor', 'highs', env);
        assert.equal(p.status, 1, `rc=${p.status} out=${p.stdout}`);
        assert.match(p.stdout, /private lib dir escapes tools\/highs/);
        assert.doesNotMatch(p.stdout, /verdict: OK/);
      } finally { b.cleanup(); }
    }
  } finally { /* sub-bundles cleaned above */ }
});
