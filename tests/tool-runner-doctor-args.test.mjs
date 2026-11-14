import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, copyFileSync, chmodSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const source = resolve('portable/packaging/bundle-template/bin/tool-runner');
const linux = process.platform === 'linux';
function fixture(testCase) {
  const root=mkdtempSync(join(tmpdir(),'ft-doctor-empty-r14-'));
  try {
    const bin=join(root,'bin'), tool=join(root,'tools','mock');
    mkdirSync(bin,{recursive:true}); mkdirSync(tool,{recursive:true});
    copyFileSync(source,join(bin,'tool-runner'));
    chmodSync(join(bin,'tool-runner'),0o755);
    writeFileSync(join(tool,'meta.sh'),'TOOL_ID=mock\nTOOL_KIND=binary\nTOOL_VERSION=1.0\n');
    const run=(...args)=>spawnSync('bash',[join(bin,'tool-runner'),...args],{
      encoding:'utf8',timeout:5000,env:{...process.env, FT_EVIDENCE_DIR:join(root,'receipts')}
    });
    testCase(run);
  } finally {rmSync(root,{recursive:true,force:true});}
}

test('doctor without argument and explicit all retain healthy aggregate behavior',{skip:!linux},()=>{
  fixture(run=>{
    for (const args of [['doctor'],['doctor','all'],['doctor','mock']]) {
      const p=run(...args);
      assert.equal(p.status,0,JSON.stringify(args)+': '+p.stderr);
      assert.match(p.stdout,/doctor: mock kind=binary version=1\.0/);
      assert.match(p.stdout,/verdict: OK/);
    }
  });
});

test('explicit empty doctor ID must be rejected, never invoke doctor-all',{skip:!linux},()=>{
  fixture(run=>{
    const p=run('doctor','');
    assert.equal(p.status,2,p.stderr+'\n'+p.stdout);
    assert.match(p.stderr,/invalid tool id: empty/);
    assert.doesNotMatch(p.stdout,/doctor: mock|verdict: OK/);
  });
});

test('doctor rejects ignored trailing arguments and unknown tool IDs',{skip:!linux},()=>{
  fixture(run=>{
    for(const args of [['doctor','all','unexpected'],['doctor','mock','unexpected']]){
      const p=run(...args);
      assert.equal(p.status,2,JSON.stringify(args)+': '+p.stderr);
      assert.match(p.stderr,/usage: tool-runner doctor/);
      assert.doesNotMatch(p.stdout,/verdict: OK/);
    }
    const missing=run('doctor','unknown');
    assert.equal(missing.status,2,missing.stderr);
    assert.doesNotMatch(missing.stdout,/verdict: OK/);
  });
});
