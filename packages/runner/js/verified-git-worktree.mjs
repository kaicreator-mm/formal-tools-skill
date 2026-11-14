/**
 * Issue #11 G6: fail closed on original DIS Git worktree drift.
 * In addition to ordinary status, reject assume-unchanged/skip-worktree flags
 * and ignored untracked source outside an explicit generated/dependency scope.
 * Does NOT attest ignored dependencies, generated output, trusted Host, or races.
 */
import {spawnSync} from 'node:child_process';
import {realpathSync} from 'node:fs';
import {isAbsolute,resolve} from 'node:path';

const fail=code=>{throw Object.assign(new Error(code),{code})};
export const sanitizedGitEnv=()=>Object.fromEntries(Object.entries(process.env).filter(([k])=>
  !k.startsWith('GIT_')));
const git=(root,args)=>{
  const r=spawnSync('git',['--no-optional-locks','-C',root,
    '-c','core.fsmonitor=false','-c','core.ignorestat=false',...args],{
    encoding:'utf8',timeout:30000,maxBuffer:64*1024*1024,env:sanitizedGitEnv()
  });
  if(r.error||r.status!==0||r.signal||typeof r.stdout!=='string'||r.stderr?.includes('fatal:'))
    fail('DIS_ORIGINAL_GIT_INSPECTION_FAILED');
  return r.stdout;
};
const entries=output=>output.split('\0').filter(Boolean);
// Explicit exclusions from the *scope of this proof*, not verified code.
// Those trees can contain executable bytes and MUST be independently pinned
// by any later supply-chain/Host qualification. Do not add source directories.
const ignoredAllowed=path=>{
  const segments=path.replace(/\\/g,'/').split('/');
  return segments.slice(0,-1).some(segment=>
    segment==='node_modules'||segment==='dist');
};
/**
 * Reject tracked index skip flags, all ordinary working-tree drift, and
 * ignored untracked files outside node_modules/dist. It does not attest
 * the contents of allowed ignored paths or their execution-time identity.
 * @param {string} root
 */
export function verifyCleanOriginalGitWorktree(root){
  if(typeof root!=='string'||!isAbsolute(root))fail('DIS_ORIGINAL_ROOT_INVALID');
  let canonical;try{canonical=realpathSync(root)}catch{fail('DIS_ORIGINAL_ROOT_INVALID')}
  const toplevel=git(canonical,['rev-parse','--show-toplevel']).trim();
  if(resolve(toplevel)!==resolve(canonical))fail('DIS_ORIGINAL_ROOT_NOT_TOPLEVEL');
  // Git's --assume-unchanged (h) and --skip-worktree (S) make porcelain
  // status falsely empty for altered tracked source files. H means cached
  // tracked file with neither flag. Fail even when the flagged file is clean.
  const tracked=entries(git(canonical,['ls-files','-v','-z','--cached']));
  if(tracked.some(line=>!line.startsWith('H ')))
    fail('DIS_ORIGINAL_TRACKED_INDEX_FLAG_UNTRUSTED');
  const status=git(canonical,['status','--porcelain=v1','--untracked-files=all',
    '--ignore-submodules=none']);
  if(status.length!==0)fail('DIS_ORIGINAL_WORKTREE_DRIFT');
  // Git status intentionally omits paths hidden by .git/info/exclude,
  // core.excludesfile and .gitignore. Enumerate these separately. Only the
  // explicitly identified dependency/generated boundaries are excluded.
  const ignored=entries(git(canonical,['ls-files','--others','--ignored',
    '--exclude-standard','-z']));
  if(ignored.some(path=>!ignoredAllowed(path)))
    fail('DIS_ORIGINAL_IGNORED_SOURCE_DRIFT');
  return Object.freeze({tracked_worktree_clean:true,
    tracked_index_flags_clean:true,
    nonignored_untracked_sources_absent:true,
    ignored_outside_dependency_generated_boundary_absent:true,
    ignored_dependencies_independently_attested:false,
    ignored_generated_outputs_independently_attested:false,
    race_free_execution_attested:false});
}

/** Use the same sanitized Git environment for HEAD as for worktree status. */
export function verifyOriginalGitHead(root){
  if(typeof root!=='string'||!isAbsolute(root))fail('DIS_ORIGINAL_ROOT_INVALID');
  let canonical;try{canonical=realpathSync(root)}catch{fail('DIS_ORIGINAL_ROOT_INVALID')}
  const head=git(canonical,['rev-parse','HEAD']).trim();
  if(!/^[a-f0-9]{40}$/.test(head))fail('DIS_ORIGINAL_HEAD_INVALID');
  return head;
}
