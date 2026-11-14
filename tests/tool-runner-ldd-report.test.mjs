import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, copyFileSync, chmodSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const source = resolve('portable/packaging/bundle-template/bin/tool-runner');
const isLinux=process.platform==='linux';
function doctorWithLdd(body, expectedStatus, expectedText) {
  const root=mkdtempSync(join(tmpdir(),'ft-r14-ldd-contract-'));
  try {
    const bin=join(root,'bin'), tool=join(root,'tools','mock'), mock=join(root,'mockbin');
    mkdirSync(bin,{recursive:true});mkdirSync(join(tool,'bin'),{recursive:true});mkdirSync(mock,{recursive:true});
    copyFileSync(source,join(bin,'tool-runner'));
    chmodSync(join(bin,'tool-runner'),0o755);
    writeFileSync(join(tool,'meta.sh'), 'TOOL_ID=mock\nTOOL_KIND=binary\nTOOL_VERSION=1.0\nTOOL_MAIN_BIN=tools/mock/bin/native\n');
    writeFileSync(join(tool,'bin','native'),'#!/bin/sh\nexit 0\n');
    chmodSync(join(tool,'bin','native'),0o755);
    writeFileSync(join(mock,'ldd'),'#!/bin/sh\n'+body+'\n');
    chmodSync(join(mock,'ldd'),0o755);
    const p=spawnSync('bash',[join(bin,'tool-runner'),'doctor','mock'],{
      encoding:'utf8',timeout:7000,env:{...process.env,PATH:mock+':'+process.env.PATH,FT_EVIDENCE_DIR:join(root,'receipts')}
    });
    assert.equal(p.status,expectedStatus,p.stderr+'\n'+p.stdout);
    assert.match(p.stdout,expectedText);
    if(expectedStatus!==0)assert.doesNotMatch(p.stdout,/verdict: OK/);
    return p;
  }finally{rmSync(root,{recursive:true,force:true});}
}
const healthy=/ldd: no missing libs OK[\s\S]*verdict: OK/;
const unhealthy=/ldd (?:probe FAILED|missing libs: 1 FAIL)[\s\S]*verdict: FAIL/;

test('ldd real dynamic-loader report with addresses remains healthy',{skip:!isLinux},()=>{
  doctorWithLdd("printf '%s\\n' '  linux-vdso.so.1 (0x00007fff1234)' '  libstdc++.so.6 => /usr/lib/libstdc++.so.6 (0x00007fffbeef)' '  /lib64/ld-linux-x86-64.so.2 (0x00007fffabcd)'",0,healthy);
});
test('ldd explicitly static ELF report is accepted',{skip:!isLinux},()=>{
  doctorWithLdd("echo '  statically linked'",0,healthy);
});
test('ldd rc0 with malformed diagnostic fails closed',{skip:!isLinux},()=>{
  doctorWithLdd("echo 'ldd: synthetic diagnostic, no dependency table emitted'; exit 0",1,unhealthy);
});
test('ldd valid entry plus diagnostic fails closed',{skip:!isLinux},()=>{
  doctorWithLdd("printf '%s\\n' 'libc.so.6 => /lib/libc.so.6 (0x7f00)' 'ldd: suspicious warning'; exit 0",1,unhealthy);
});
test('ldd rc0 with blank output fails closed',{skip:!isLinux},()=>{
  doctorWithLdd("printf '  \\n'; exit 0",1,unhealthy);
});
test('ldd process errors fail closed even with valid output',{skip:!isLinux},()=>{
  doctorWithLdd("echo 'libc.so.6 => /lib/libc.so.6 (0x7f00)'; exit 42",1,unhealthy);
});
test('ldd truly missing dependency fails closed',{skip:!isLinux},()=>{
  doctorWithLdd("echo 'libmissing.so => not found'; exit 0",1,unhealthy);
});
