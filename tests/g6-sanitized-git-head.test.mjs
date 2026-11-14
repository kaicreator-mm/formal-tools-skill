import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,appendFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {verifyCleanOriginalGitWorktree,verifyOriginalGitHead,sanitizedGitEnv}
  from '../packages/runner/js/verified-git-worktree.mjs';

const git=(root,...args)=>{
  const result=spawnSync('git',['-C',root,...args],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  return result.stdout.trim();
};
const repo=()=>{
  const root=mkdtempSync(join(tmpdir(),'ft-i11-head-env-'));
  git(root,'init','-q');
  writeFileSync(join(root,'pinned.mjs'),'export const reference=true;\n');
  writeFileSync(join(root,'transitive.mjs'),'export const trusted=true;\n');
  git(root,'add','.');
  git(root,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid',
    'commit','-qm','fixture');
  return root;
};

test('G6 original HEAD uses sanitized Git env, not caller-controlled GIT_DIR',()=>{
  const trusted=repo(),target=repo();
  const keys=['GIT_DIR','GIT_WORK_TREE','GIT_INDEX_FILE'];
  const saved=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  try{
    appendFileSync(join(target,'transitive.mjs'),'export const forged=true;\n');
    git(target,'add','transitive.mjs');
    git(target,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid',
      'commit','-qm','different-clean-source');
    const trustedHead=git(trusted,'rev-parse','HEAD');
    const actualHead=git(target,'rev-parse','HEAD');
    assert.notEqual(trustedHead,actualHead);
    assert.equal(verifyCleanOriginalGitWorktree(target).tracked_worktree_clean,true);
    const hostileEnv={...process.env,GIT_DIR:join(trusted,'.git'),GIT_WORK_TREE:target};
    const spoof=spawnSync('git',['-C',target,'rev-parse','HEAD'],
      {encoding:'utf8',env:hostileEnv});
    assert.equal(spoof.status,0,spoof.stderr);
    assert.equal(spoof.stdout.trim(),trustedHead,
      'unisolated Git HEAD is attacker-redirectable');
    process.env.GIT_DIR=join(trusted,'.git');
    process.env.GIT_WORK_TREE=target;
    process.env.GIT_INDEX_FILE=join(trusted,'.git','index');
    assert.equal(verifyOriginalGitHead(target),actualHead,
      'guard and head must see the identical real checkout');
    const childEnv=sanitizedGitEnv();
    for(const key of keys)assert.equal(childEnv[key],undefined);
  }finally{
    for(const key of keys){
      if(saved[key]===undefined)delete process.env[key];
      else process.env[key]=saved[key];
    }
    rmSync(trusted,{force:true,recursive:true});
    rmSync(target,{force:true,recursive:true});
  }
});

test('G6 original HEAD refuses invalid or non-Git roots',()=>{
  assert.throws(()=>verifyOriginalGitHead('relative-path'),/DIS_ORIGINAL_ROOT_INVALID/);
  const root=mkdtempSync(join(tmpdir(),'ft-i11-head-no-git-'));
  try{
    assert.throws(()=>verifyOriginalGitHead(root),/DIS_ORIGINAL_GIT_INSPECTION_FAILED/);
  }finally{rmSync(root,{force:true,recursive:true})}
});
