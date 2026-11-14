/** Issue #11: cross-check the versioned Task DAG against immutable G3-G6
 * receipts. This is an engineering-evidence index check, NOT a professional
 * Oracle or qualified Replay/Effect assertion.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root=new URL('../',import.meta.url);
const bytes=rel=>Buffer.from(readFileSync(new URL(rel,root)).toString('utf8')
  .replace(/\r\n/g,'\n'),'utf8');
const json=rel=>JSON.parse(bytes(rel).toString('utf8'));
const gitBlob=rel=>{
  const b=bytes(rel);
  return createHash('sha1').update(Buffer.concat([
    Buffer.from('blob '+b.length+'\0'),b])).digest('hex');
};
const dag=json('docs/experiments/llm-methods/r0/TASK_DAG.json');
const rec=dag.reconciliation;
const tasks=Object.fromEntries(dag.tasks.map(t=>[t.id,t]));
const gates=Object.fromEntries(dag.gates.map(g=>[g.id,g]));

test('R21 DAG follows actual native, A/B and DIS engineering evidence, not old NOT_STARTED',()=>{
  assert.equal(dag.status,'G0_G2_ACCEPTED_G3_G6_ENGINEERING_SCOPED_FULL_QUALIFICATION_BLOCKED');
  assert.equal(rec.controller_issue,11);
  assert.match(rec.reconciled_against_main_sha,/^[a-f0-9]{40}$/);
  for(const id of ['G3','G4','G5','G6']){
    assert.match(gates[id].status,/SCOPED/);
    assert.match(gates[id].status,/BLOCKED/);
  }
  for(const [id,t] of Object.entries({
    'T-G3-01':rec.g3_native_receipt.path,
    'T-G4-01':rec.g4_store_receipt.path,
    'T-G5-01':rec.g5_real_ab.path,
    'T-G6-01':rec.g6_dis_r20.path
  })){
    assert.notEqual(tasks[id].status,'NOT_STARTED');
    assert.ok(tasks[id].evidence.includes(t),id+' lacks original receipt');
  }
});
test('R21 listed Git Blobs refer to actual frozen file bytes',()=>{
  for(const item of [rec.g3_native_receipt,rec.g4_store_receipt,
    rec.g4_product_trust_registry,rec.g5_real_ab,rec.g6_dis_r20])
    assert.equal(gitBlob(item.path),item.git_blob,item.path);
});
test('R21 exact native and G4 candidate evidence cannot claim professional Solution',()=>{
  const native=json(rec.g3_native_receipt.path);
  assert.deepEqual(native.solvers.map(s=>s.id).sort(),['cvc5','z3']);
  assert.equal(native.observations.length,24);
  const store=json(rec.g4_store_receipt.path);
  assert.equal(store.g4_reusable,false);
  assert.equal(store.claim_result,'UNVERIFIED');
  const anchors=json(rec.g4_product_trust_registry.path);
  assert.equal(anchors.status,'NOT_CONFIGURED');
  assert.deepEqual(anchors.anchors,[]);
  assert.equal(rec.g4_product_trust_registry.anchors,0);
  assert.equal(dag.execution.solution_reuse,
    'DURABLE_CANDIDATE_VALIDATED_POSITIVE_QUALIFIED_REPLAY_BLOCKED');
});
test('R21 G5 actual 20x2 frozen A/B remains measurement, not business Oracle',()=>{
  const a=json(rec.g5_real_ab.path);
  assert.equal(a.traces_reviewed,40);
  for(const arm of [a.summary.baseline,a.summary.augmented]){
    assert.equal(arm.cases,20);
    assert.equal(arm.correct,20);
    assert.equal(arm.false_pass,0);
    assert.equal(arm.unknown,0);
    assert.equal(arm.coverage,1);
    assert.ok(arm.cost_usd>0&&arm.latency_ms>0);
  }
  assert.equal(a.summary.deltas.accuracy_all_cases,0);
  assert.equal(rec.g5_real_ab.qualified_business_oracle,false);
});
test('R21 G6 real DIS execution is 3+9 PASS but qualified replay/effect BLOCK',()=>{
  const c=json(rec.g6_dis_r20.path);
  assert.equal(c.status,'PASSED_ENGINEERING_ONLY');
  assert.equal(c.driver_git_blob,rec.g6_dis_r20.driver_git_blob);
  assert.equal(c.original_chain.consumer_test.tests.passed,3);
  assert.equal(c.original_chain.selected_build_test.tests.passed,9);
  assert.equal(c.original_chain.consumer_test.exit_code,0);
  assert.equal(c.original_chain.selected_build_test.exit_code,0);
  assert.equal(c.witness_result.reason,'PRODUCT_TRUST_ROOTS_NOT_APPROVED');
  assert.equal(c.qualified_solution,false);
  assert.equal(c.qualified_replay,false);
  assert.equal(c.dis_effects,0);
  assert.equal(c.technical_execution.host_independently_attested,false);
  assert.equal(rec.g6_dis_r20.qualified_solution,false);
  assert.equal(rec.g6_dis_r20.qualified_replay,false);
});
