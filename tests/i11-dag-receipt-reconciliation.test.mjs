/** Issue #11: cross-check the versioned Task DAG against immutable G3-G6
 * receipts. Engineering evidence only: never a Product, Oracle, Host or
 * qualified Solution/Replay/Effect authorization.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root=new URL('../',import.meta.url);
const bytes=rel=>Buffer.from(readFileSync(new URL(rel,root)).toString('utf8')
  .replace(/\r\n/g,'\n'),'utf8');
const json=rel=>JSON.parse(bytes(rel).toString('utf8'));
const sha256=b=>createHash('sha256').update(b).digest('hex');
const gitBlob=rel=>{
  const b=bytes(rel);
  return createHash('sha1').update(Buffer.concat([
    Buffer.from('blob '+b.length+'\0'),b])).digest('hex');
};
const dag=json('docs/experiments/llm-methods/r0/TASK_DAG.json');
const rec=dag.reconciliation;

const expectedGates=Object.freeze({
  G3:'NATIVE_SOLVE_VERIFY_SCOPED_PROFESSIONAL_ORACLE_BLOCKED',
  G4:'DURABLE_CANDIDATE_CRYPTO_PREFLIGHT_SCOPED_QUALIFIED_REPLAY_BLOCKED',
  G5:'REAL_PAIRED_AB_SCOPED_BUSINESS_ORACLE_BLOCKED',
  G6:'REAL_DIS_CONSUMPTION_SCOPED_QUALIFIED_EFFECT_BLOCKED'
});
const expectedTasks=Object.freeze({
  'T-G3-01':'Z3_CVC5_NATIVE_24_EACH_SCOPED_PROFESSIONAL_ORACLE_BLOCKED',
  'T-G4-01':'DURABLE_CANDIDATE_AND_THREE_ROLE_PREFLIGHT_SCOPED_QUALIFIED_REPLAY_BLOCKED',
  'T-G5-01':'REAL_FROZEN_20X2_AB_SCOPED_BUSINESS_ORACLE_BLOCKED',
  'T-G6-01':'REAL_DIS_NODE24_3_AND_9_ENGINEERING_SCOPED_QUALIFIED_EFFECT_BLOCKED'
});
// Preserve all eight historical gate dependencies and all thirteen task edges.
// An executable assertion guards them; this list is NOT a new planning DAG.
const expectedGateDeps={
  G0:[],G1:['G0'],'RESEARCH-R0':['G0','G1'],
  G2:['G0','G1','RESEARCH-R0'],G3:['G2'],G4:['G3'],
  G5:['G1','G3'],G6:['G4','G5']
};
const expectedTaskDeps={
  'T-G0-01':[],'T-G0-02':['T-G0-01'],'T-G0-03':['T-G0-02'],
  'T-G1-01':['T-G0-01'],'T-G1-02':['T-G1-01'],
  'T-G1-03':['T-G1-01','T-G1-02'],
  'T-R0-01':['T-G0-02','T-G1-02'],
  'T-G2-01':['T-G1-02','T-R0-01'],'T-G2-02':['T-G2-01'],
  'T-G3-01':['T-G2-02'],'T-G4-01':['T-G3-01'],
  'T-G5-01':['T-G3-01'],'T-G6-01':['T-G4-01','T-G5-01']
};
const index=items=>Object.fromEntries(items.map(item=>[item.id,item]));
const checkDag=d=>{
  assert.equal(d.status,'G0_G2_ACCEPTED_G3_G6_ENGINEERING_SCOPED_FULL_QUALIFICATION_BLOCKED');
  assert.equal(d.reconciliation.controller_issue,11);
  assert.match(d.reconciliation.reconciled_against_main_sha,/^[a-f0-9]{40}$/);
  // Raw array cardinality/uniqueness MUST be checked before Object.fromEntries.
  // Otherwise last-wins can erase a forged first G6 FULL_ACCEPTED or rewired edge.
  assert.equal(d.gates.length,8,'raw gate count must be exactly 8');
  assert.equal(d.tasks.length,13,'raw task count must be exactly 13');
  const gateIds=d.gates.map(g=>g.id);
  const taskIds=d.tasks.map(t=>t.id);
  assert.equal(new Set(gateIds).size,gateIds.length,'duplicate raw gate ID');
  assert.equal(new Set(taskIds).size,taskIds.length,'duplicate raw task ID');
  const gates=index(d.gates),tasks=index(d.tasks);
  assert.deepEqual(Object.keys(gates).sort(),Object.keys(expectedGateDeps).sort());
  assert.deepEqual(Object.keys(tasks).sort(),Object.keys(expectedTaskDeps).sort());
  for(const [id,status] of Object.entries(expectedGates)){
    assert.equal(gates[id].status,status,id+' gate must remain scoped, not FULL_ACCEPTED');
    assert.match(gates[id].status,/SCOPED/);
    assert.match(gates[id].status,/BLOCKED/);
  }
  for(const [id,status] of Object.entries(expectedTasks)){
    assert.equal(tasks[id].status,status,id+' task must remain scoped, not FULL_ACCEPTED');
    assert.match(tasks[id].status,/SCOPED/);
    assert.match(tasks[id].status,/BLOCKED/);
  }
  for(const [id,deps] of Object.entries(expectedGateDeps))
    assert.deepEqual(gates[id].depends_on,deps,id+' historical gate edges changed');
  for(const [id,deps] of Object.entries(expectedTaskDeps))
    assert.deepEqual(tasks[id].depends_on,deps,id+' historical task edges changed');
  assert.equal(gates.G0.status,'ACCEPTED_INTEGRATED');
  assert.equal(gates.G1.status,'ACCEPTED_INTEGRATED');
  assert.equal(gates['RESEARCH-R0'].status,'ACCEPTED_INTEGRATED');
  assert.equal(gates.G2.status,'ACCEPTED_INTEGRATED_STATIC');
  for(const [id,path] of Object.entries({
    'T-G3-01':d.reconciliation.g3_native_receipt.path,
    'T-G4-01':d.reconciliation.g4_store_receipt.path,
    'T-G5-01':d.reconciliation.g5_real_ab.path,
    'T-G6-01':d.reconciliation.g6_dis_r20.path
  }))assert.ok(tasks[id].evidence.includes(path),id+' original receipt missing');
};
test('R21 DAG is scoped, not stale, and all original dependency edges are intact',()=>{
  checkDag(dag);
});
test('R21 adversarial false qualification and hidden DAG rewiring fail closed',()=>{
  for(const mutate of [
    d=>{index(d.tasks)['T-G6-01'].status='FULL_ACCEPTED';},
    d=>{index(d.tasks)['T-G3-01'].status='QUALIFIED';},
    d=>{index(d.gates).G5.status='FULL_ACCEPTED';},
    d=>{index(d.gates).G6.status='NOT_STARTED';},
    d=>{index(d.tasks)['T-G6-01'].depends_on=[];},
    d=>{index(d.gates).G6.depends_on=[];},
    // Three independent duplicate-ID adversarial mutants from R22 review:
    // last-wins map would silently overwrite these forged first raw entries.
    d=>{d.tasks.unshift({...structuredClone(index(d.tasks)['T-G6-01']),
      status:'FULL_ACCEPTED'});},
    d=>{d.gates.unshift({...structuredClone(index(d.gates).G6),
      status:'FULL_ACCEPTED'});},
    d=>{d.tasks.unshift({...structuredClone(index(d.tasks)['T-G6-01']),
      depends_on:[]});}
  ]){
    const corrupted=structuredClone(dag);mutate(corrupted);
    assert.throws(()=>checkDag(corrupted));
  }
});
test('R21 receipt and Product-root Git Blobs match actual frozen files',()=>{
  for(const item of [rec.g3_native_receipt,rec.g4_store_receipt,
    rec.g4_product_trust_registry,rec.g5_real_ab,rec.g6_dis_r20])
    assert.equal(gitBlob(item.path),item.git_blob,item.path);
});
test('R21 G3 native 24x2 statuses, upstream source and UNQUALIFIED flags are bound',()=>{
  const native=json(rec.g3_native_receipt.path);
  assert.deepEqual(native.solvers.map(s=>s.id).sort(),['cvc5','z3']);
  for(const s of native.solvers){
    assert.equal(s.all_24_exit_zero,true,s.id);
    assert.equal(s.all_24_stderr_empty,true,s.id);
    assert.match(s.executable_sha256,/^[a-f0-9]{64}$/);
  }
  assert.equal(native.source_fixture_git_blob,
    gitBlob('benchmarks/llm-methods/r0/spec-fidelity-cases.json'));
  assert.equal(native.source_generator_git_blob,
    gitBlob('benchmarks/llm-methods/g3/ads-native-matrix.mjs'));
  assert.equal(native.original_js_runner_replay.source_git_blob,
    gitBlob('benchmarks/llm-methods/g3/ads-native-replay.mjs'));
  assert.equal(native.original_js_runner_replay.z3_cases,24);
  assert.equal(native.original_js_runner_replay.cvc5_cases,24);
  assert.equal(native.original_js_runner_replay.paired_status_agreement,24);
  assert.equal(native.original_js_runner_replay.claim_verdict,'UNVERIFIED');
  assert.equal(native.original_js_runner_replay.host_process_attested,false);
  assert.equal(native.original_js_runner_replay.independent_semantic_oracle,'NOT_RUN');
  assert.equal(native.observations.length,24);
  const ids=new Set(),counts={z3:{SAT:0,UNSAT:0},cvc5:{SAT:0,UNSAT:0}};
  for(const row of native.observations){
    assert.ok(!ids.has(row.id),'duplicate native observation');
    ids.add(row.id);
    assert.equal(row.exit_code,0,row.id);
    assert.ok(['SAT','UNSAT'].includes(row.status),row.id);
    for(const s of ['z3','cvc5']){
      assert.equal(row[s+'_status'],row.status,row.id+': '+s+' common status');
      counts[s][row[s+'_status']]++;
    }
  }
  assert.deepEqual(counts,{z3:{SAT:6,UNSAT:18},cvc5:{SAT:6,UNSAT:18}});
  assert.equal(native.summary.cross_solver_agree,24);
  assert.deepEqual(native.summary.z3,counts.z3);
  assert.deepEqual(native.summary.cvc5,counts.cvc5);
  assert.equal(native.scope.actual_native_processes_executed,true);
  assert.equal(native.scope.synthetic_oracle_independently_certified,false);
  assert.equal(native.scope.binary_supplier_or_process_independently_attested,false);
  assert.equal(native.scope.original_business_claim,'UNVERIFIED');
  assert.equal(native.scope.solution_promotable,false);
  assert.equal(native.scope.full_G3_qualification,false);
});
test('R21 G4 durable candidate and real trust-root absence never grant Replay',()=>{
  const store=json(rec.g4_store_receipt.path);
  assert.equal(store.g4_reusable,false);
  assert.equal(store.claim_result,'UNVERIFIED');
  assert.deepEqual(store.phases.map(p=>p.phase),[
    'persist','re-persist','inspect','drift','revoke','inspect-after-revoke','no-resurrection'
  ]);
  assert.ok(store.phases.every(p=>p.ok===true));
  const anchors=json(rec.g4_product_trust_registry.path);
  assert.equal(anchors.status,'NOT_CONFIGURED');
  assert.deepEqual(anchors.anchors,[]);
  assert.equal(rec.g4_product_trust_registry.anchors,0);
  assert.equal(dag.execution.solution_reuse,
    'DURABLE_CANDIDATE_VALIDATED_POSITIVE_QUALIFIED_REPLAY_BLOCKED');
});
test('R21 G5 20x2 raw DeepSeek traces are byte-pinned to independent analysis',()=>{
  const a=json(rec.g5_real_ab.path);
  assert.equal(a.traces_reviewed,40);
  assert.deepEqual(a.findings,['none']);
  assert.equal(a.status_check.scorer_g5_accepted,false);
  const traceRoot='validation/g5-hard-r1-llm-real-2026-11-14/traces/';
  const files=readdirSync(new URL(traceRoot,root)).filter(f=>f.endsWith('.json'));
  assert.equal(files.length,40);
  const seen=new Set();
  for(const [arm,label] of [['baseline','LLM_ONLY'],['augmented','LLM_TOOLS']]){
    const result=a.summary[arm];
    assert.equal(result.cases,20);
    assert.equal(result.per_case.length,20);
    assert.equal(result.correct,20);
    assert.equal(result.false_pass,0);
    assert.equal(result.unknown,0);
    assert.equal(result.coverage,1);
    assert.ok(result.cost_usd>0&&result.latency_ms>0);
    for(const row of result.per_case){
      const file=label+'__'+row.case_id+'.json';
      assert.ok(!seen.has(file),'duplicate G5 trace');
      seen.add(file);
      assert.ok(files.includes(file),'unlisted raw trace');
      const traceBytes=bytes(traceRoot+file);
      assert.equal(sha256(traceBytes),row.trace_sha256,file+' SHA drift');
      const trace=JSON.parse(traceBytes.toString('utf8'));
      assert.equal(trace.verdict_parse.prediction,row.prediction,file);
      assert.equal(row.match,true,file);
      assert.equal(row.prediction,row.expected,file);
      assert.equal(trace.served_model,'deepseek-flash',file);
      assert.equal(trace.http_status,200,file);
    }
  }
  assert.equal(seen.size,40);
  assert.equal(a.summary.deltas.accuracy_all_cases,0);
  assert.equal(rec.g5_real_ab.qualified_business_oracle,false);
});
test('R21 G6 real original DIS remains engineering-only with all ten pins and absent credentials',()=>{
  const c=json(rec.g6_dis_r20.path);
  assert.equal(c.status,'PASSED_ENGINEERING_ONLY');
  assert.equal(c.driver_git_blob,rec.g6_dis_r20.driver_git_blob);
  assert.equal(c.dis_target_reference.source_head,
    '90afefa81ef9ad0d42087ffc8a0dbaa32757811f');
  assert.equal(c.original_target.verified_head,c.dis_target_reference.source_head);
  const pins={
    consumer_test:'242930c5b10f629a13115a45069f2814f6042316',
    selected_build:'450f16affdd91071ae104da64fa10e1c0a162c48',
    selected_build_test:'620b34d10ab4dd2bcf0cd28afd88f7485acc9086',
    build_entry:'e747c332f4c3e59b07ee702035fbf9309651fa3a',
    contracts_entry:'d4e75b2b55c410bac030638734ea761bd5448d9e',
    microkernel_entry:'55c2d0e88964ec3a90d19d7bc48b2b651054b28d',
    native_fixture:'181d62da108762b0b0bdf987c6083889d2bbefa5',
    cross_project_consumer:'28bd62fbdfd89ba488656f95d48b2b3595444392',
    cross_project_manifest:'39e14468723c4211d1e55d6a7c3aa1a16204c5a8',
    tally_snapshot:'54015fb63ffb13b4f4e562f660d2172098b5f7f4'
  };
  assert.equal(c.original_target.pins_verified.length,10);
  assert.deepEqual(Object.fromEntries(c.original_target.pins_verified.map(p=>[p.role,p.git_blob])),pins);
  assert.equal(c.original_chain.consumer_test.tests.passed,3);
  assert.equal(c.original_chain.selected_build_test.tests.passed,9);
  assert.equal(c.original_chain.consumer_test.exit_code,0);
  assert.equal(c.original_chain.selected_build_test.exit_code,0);
  assert.equal(c.witness_result.status,'BLOCKED');
  assert.equal(c.witness_result.reason,'PRODUCT_TRUST_ROOTS_NOT_APPROVED');
  assert.equal(c.witness_result.independent_professional_oracle,false);
  assert.equal(c.independent_professional_oracle,false);
  assert.equal(c.witness_result.product_owner_credential,'ABSENT');
  assert.equal(c.witness_result.independent_oracle_credential,'ABSENT');
  assert.equal(c.witness_result.trusted_host_credential,'ABSENT');
  assert.equal(c.witness_result.claim_result,'UNVERIFIED');
  assert.equal(c.original_claim,'UNVERIFIED');
  assert.equal(c.qualified_solution,false);
  assert.equal(c.qualified_replay,false);
  assert.equal(c.dis_effects,0);
  assert.equal(c.technical_execution.host_independently_attested,false);
  assert.equal(c.technical_execution.source_commit_independently_attested,false);
  assert.equal(c.dis_preflight_envelope.host_invocations,0);
  assert.equal(c.witness_result.replay_allowed,false);
  assert.equal(rec.g6_dis_r20.qualified_solution,false);
  assert.equal(rec.g6_dis_r20.qualified_replay,false);
  assert.equal(rec.g6_dis_r20.dis_effects,0);
});
