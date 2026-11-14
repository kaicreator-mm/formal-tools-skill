import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, mkdirSync, writeFileSync, chmodSync, existsSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const source=readFileSync(resolve('portable/builders/tools/why3.sh'),'utf8');
const linux=process.platform==='linux';
function shimBody() {
  const start="ft::make_shim '";
  const i=source.indexOf(start);
  const j=source.lastIndexOf("'\n}");
  assert.ok(i>=0&&j>i,'Why3 shim must have a bounded literal body');
  return source.slice(i+start.length,j);
}

test('Why3 builder never deletes, creates or links host /usr directories',()=>{
  assert.doesNotMatch(source,/\brm\s+-rf\s+\/usr\b/);
  assert.doesNotMatch(source,/\bmkdir\s+-p\s+\/usr\b/);
  assert.doesNotMatch(source,/\bln\s+-sfn\b[^\n]*\s\/usr\b/);
  assert.match(source,/find "\$FT_TOOL_DIR" -type l -lname '\/\*' -print0/);
  assert.match(source,/why3_absolute_symlinks_removed/);
  assert.match(source,/WHY3_RELOCATION_NOT_QUALIFIED/);
});

test('safe generated Why3 shim allows version but rejects compiled-in command plugins without host writes',{skip:!linux},()=>{
  const root=mkdtempSync(join(tmpdir(),'ft-why3-r17-safety-'));
  try{
    const tool=join(root,'tools','why3');
    const bin=join(tool,'usr','bin');
    mkdirSync(bin,{recursive:true});
    mkdirSync(join(tool,'usr','share','why3'),{recursive:true});
    const run=join(tool,'run'), log=join(root,'actual-binary-invocations.txt');
    writeFileSync(run,
      '#!/bin/sh\nFT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)\n'
      +'TOOL_DIR="$FT_ROOT/tools/why3"\n'+shimBody()+'\n');
    chmodSync(run,0o755);
    writeFileSync(join(bin,'why3'),
      '#!/bin/sh\nprintf "%s\\n" "$1" >> "$FAKE_WHY3_LOG"\n'
      +'printf "%s\\n" "Why3 platform, version 1.8.0"\n');
    chmodSync(join(bin,'why3'),0o755);
    const exec=(...args)=>spawnSync('sh',[run,...args],{
      encoding:'utf8',timeout:5000,
      env:{...process.env,FAKE_WHY3_LOG:log}
    });
    const good=exec('--version');
    assert.equal(good.status,0,good.stderr);
    assert.match(good.stdout,/Why3 platform, version 1\.8\.0/);
    for(const args of [['config','detect'],['prove','-P','z3','some.mlw'],[]]){
      const bad=exec(...args);
      assert.equal(bad.status,2,JSON.stringify(args)+': '+bad.stderr);
      assert.match(bad.stderr,/WHY3_RELOCATION_NOT_QUALIFIED/);
      assert.doesNotMatch(bad.stdout,/Valid|Why3 platform/);
    }
    assert.equal(readFileSync(log,'utf8'),'--version\n',
      'unrelocated commands must never reach the original binary');
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('Why3 builder source syntax is valid Bash',{skip:!linux},()=>{
  const p=spawnSync('bash',['-n','portable/builders/tools/why3.sh'],{encoding:'utf8'});
  assert.equal(p.status,0,p.stderr);
});
