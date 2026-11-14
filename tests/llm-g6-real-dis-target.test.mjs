import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {DIS_V020_REFERENCE,inspectDisV020Consumption}
  from "../packages/runner/js/dis-v020-consumer-preflight.mjs";
import {inspectQualificationPreflight}
  from "../packages/runner/js/qualification-witness.mjs";
import {persistSolutionCandidate,inspectStoredReplay,revokeStoredCandidate}
  from "../packages/runner/js/solution-store.mjs";
import {assessMethod} from "../packages/runner/js/method-planner.mjs";
import {buildRealLifecycleCandidate}
  from "../benchmarks/llm-methods/g4/real-provenance.mjs";
import {G6_TALLY_SOURCE} from "../benchmarks/llm-methods/g6/real-tally-business-consumer.mjs";

const RECEIPT=new URL("../validation/g6-dis-target-real-2026-11-14/RECEIPT.json",import.meta.url);
const sha40=/^[a-f0-9]{40}$/;
// Identity is the git-object (LF) byte form: EOL-only normalization keeps
// verification checkout-agnostic while real content edits still mismatch.
const gitBlobOf=url=>{
  const b=Buffer.from(readFileSync(url).toString("utf8").replace(/\r\n/g,"\n"),"utf8");
  return createHash("sha1").update(Buffer.concat([
    Buffer.from("blob "+b.length+"\0"),b])).digest("hex");
};

test("G6 real DIS target: committed receipt verifies on any checkout",()=>{
  const r=JSON.parse(readFileSync(RECEIPT,"utf8"));
  assert.equal(r.schema,"formal-tools/i11-real-dis-v020-target-consumption/0.1");
  assert.match(r.source_head,sha40);
  assert.equal(r.driver_git_blob,r.technical_execution.driver_git_blob);
  // This receipt is a historical REAL execution at the R16 source bytes.
  // Never retroactively bind newly repaired driver code to the old Host run.
  assert.equal(r.driver_git_blob,"3b8f6045247dc8819da3a85068668147d64840ad");
  const currentDriver=gitBlobOf(new URL("../benchmarks/llm-methods/g6/real-dis-v020-target-consumer.mjs",import.meta.url));
  assert.notEqual(currentDriver,r.driver_git_blob,
    "R17 guarded driver cannot be mislabeled as the original R16 actual execution");
  // The re-pinned reference in the production preflight module is the exact
  // target this receipt consumed (R15 re-pin, one source of truth).
  assert.deepEqual(r.dis_target_reference,DIS_V020_REFERENCE);
  assert.equal(r.dis_target_reference.source_head,"90afefa81ef9ad0d42087ffc8a0dbaa32757811f");
  // Original target pins: 10 distinct sources, Tally snapshot is the exact
  // original blob already consumed by merged formal-tools G6 (#78).
  assert.equal(r.original_target.verified_head,r.dis_target_reference.source_head);
  assert.equal(r.original_target.pins_verified.length,10);
  const blobs=r.original_target.pins_verified.map(x=>x.git_blob);
  assert.equal(new Set(blobs).size,10);
  assert.ok(blobs.every(x=>sha40.test(x)));
  const tallyPin=r.original_target.pins_verified.find(x=>x.role==="tally_snapshot");
  assert.equal(tallyPin.git_blob,G6_TALLY_SOURCE.git_blob);
  // Real platform: Node24 linux/x64, exactly the pinned DIS v0.2 Target.
  assert.deepEqual(r.execution_platform,{node:"v24.21.0",platform:"linux",
    architecture:"x64",runtime_target:"linux/x64/node"});
  // The pinned candidate is reproducible from the committed frozen fixture.
  const source=buildRealLifecycleCandidate();
  assert.equal(r.candidate_sha256,source.candidate.candidate_sha256);
  const method=assessMethod(JSON.parse(source.problem_json),JSON.parse(source.method_json));
  assert.deepEqual(r.method,{status:"STRUCTURALLY_VALID",
    problem_sha256:method.problem_sha256,method_sha256:method.method_sha256});
  // Witness: strictly BLOCKED — no real Product Owner / independent Oracle /
  // trusted Host credentials exist, so no signature is even read.
  const w=r.witness_result;
  assert.equal(w.status,"BLOCKED");
  assert.equal(w.reason,"PRODUCT_TRUST_ROOTS_NOT_APPROVED");
  assert.equal(w.positive_replay,"BLOCK");
  assert.equal(w.independent_professional_oracle,false);
  assert.equal(w.qualified_solution,false);
  assert.equal(w.claim_result,"UNVERIFIED");
  assert.equal(w.replay_allowed,false);
  assert.equal(w.solution_promotable,false);
  assert.equal(w.dis_host_executed,false);
  assert.equal(w.effect_dispatched,false);
  assert.deepEqual([w.product_owner_credential,w.independent_oracle_credential,
    w.trusted_host_credential],["ABSENT","ABSENT","ABSENT"]);
  // Durable store boundary revalidation at the Host boundary.
  assert.deepEqual(r.store_lifecycle,{persist:{status:"CANDIDATE_PERSISTED",record_write:"NEW"},
    inspect:{status:"REPLAY_BLOCKED_UNQUALIFIED"},stale_probe:{status:"STALE"},
    revoke:{status:"INVALIDATED",reason:"OPERATOR_REVOKED"},
    tombstone_dominates:{status:"INVALIDATED",reason:"EXPLICIT_REVOCATION"},
    no_resurrection:{status:"INVALIDATED"}});
  // Original chain: unmodified original bytes, clean exits, exact counts.
  assert.equal(r.technical_execution.original_chain_executed,true);
  assert.equal(r.technical_execution.original_chain_in_process,false);
  assert.equal(r.technical_execution.host_independently_attested,false);
  assert.equal(r.technical_execution.source_commit_independently_attested,false);
  const c=r.original_chain.consumer_test,s=r.original_chain.selected_build_test;
  assert.equal(c.exit_code,0);assert.deepEqual(c.tests,{total:3,passed:3,failed:0});
  assert.equal(c.file,DIS_V020_REFERENCE.example_path);
  assert.match(c.stdout_sha256,/^[a-f0-9]{64}$/);
  assert.equal(s.exit_code,0);assert.deepEqual(s.tests,{total:9,passed:9,failed:0});
  assert.match(s.stdout_sha256,/^[a-f0-9]{64}$/);
  // Observed original semantics: observation without authority, KDP
  // admission without proven execution, forbidden external effect.
  assert.deepEqual(r.original_chain.observed_semantics,{business_function:"tally.assessTaskEvidence",
    kinds:"OBSERVATION",authority:"NONE",attested:false,kdp_admission:"ADMITTED",
    execution:"NOT_PROVEN",business_attested:false,forged_claim_task_pass:false,
    stale_pin_boot:"DIS_SOURCE_ANCHOR_STALE",
    missing_pin_coverage:"DIS_SOURCE_ANCHOR_COVERAGE_INCOMPLETE",
    external_effect:"FORBIDDEN_WITHOUT_KDP_PERMIT"});
  assert.deepEqual(r.dis_preflight_envelope,{status:"REPLAY_BLOCKED_UNQUALIFIED",
    kind:"UNKNOWN",authority:"NONE",claim_result:"UNVERIFIED",
    effect_dispatched:false,host_invocations:0});
  assert.deepEqual(r.qualification,{positive_replay:"BLOCK",
    g4_qualified_replay:"BLOCK",g5_formal_accepted:"BLOCK",
    g6_dis_host:"TECHNICAL_ONLY_NOT_ATTESTED"});
  assert.equal(r.original_claim,"UNVERIFIED");
  assert.equal(r.independent_professional_oracle,false);
  assert.equal(r.qualified_solution,false);
  assert.equal(r.qualified_replay,false);
  assert.equal(r.dis_effects,0);
  assert.equal(r.status,"PASSED_ENGINEERING_ONLY");
});

test("G6 real DIS target: re-pinned preflight refuses the same candidate with zero Host invocation",()=>{
  const source=buildRealLifecycleCandidate();
  const v=inspectDisV020Consumption({candidate_json:JSON.stringify(source.candidate),
    current_provenance_json:JSON.stringify(source.provenance),
    target_head:DIS_V020_REFERENCE.source_head});
  assert.equal(v.status,"REPLAY_BLOCKED_UNQUALIFIED");
  assert.equal(v.reason,"SOURCE_MODEL_ORACLE_HOST_TOOL_NOT_QUALIFIED");
  assert.equal(v.authority,"NONE");
  assert.equal(v.host_invocations,0);
  assert.equal(v.effect_dispatched,false);
});

test("G6 real DIS target: witness against shipped registry stays strictly BLOCKED",{skip:process.platform!=="linux"?"POSIX durable directory required":false},
 async()=>{
  const dir=mkdtempSync(join(tmpdir(),"ft-g6-dis-witness-"));
  try{
    const source=buildRealLifecycleCandidate();
    const now=Date.now(),p=source.provenance,c=source.candidate;
    const subject={schema:"formal-tools/qualification-subject/0.1",
      candidate_sha256:c.candidate_sha256,problem_sha256:c.problem_sha256,
      method_sha256:c.method_sha256,source_id:p.source_id,
      source_sha256:p.source_sha256,oracle_id:p.oracle_id,
      oracle_sha256:p.oracle_sha256,model_sha256:p.model_sha256,
      tool_id:p.tool_id,tool_version:p.tool_version,
      tool_binary_sha256:p.tool_binary_sha256,evidence_sha256:p.evidence_sha256,
      claim_ref:"ads.real-lifecycle/claim_r1..r6",
      scope:"formal-tools/engineering-consumption-only",
      valid_from_ms:now-1000,valid_until_ms:now+3600000};
    const bundle=JSON.stringify({schema:"formal-tools/qualification-witnesses/0.1",
      subject,signatures:["SOURCE_OWNER","INDEPENDENT_ORACLE","TRUSTED_HOST"].map(role=>({
        role,key_id:"placeholder-"+role.toLowerCase(),
        signature_b64:Buffer.from("no real credential exists").toString("base64")}))});
    const persisted=await persistSolutionCandidate({store_dir:dir,
      problem_json:source.problem_json,method_json:source.method_json,
      provenance_json:JSON.stringify(p)});
    assert.equal(persisted.status,"CANDIDATE_PERSISTED");
    const witness=await inspectQualificationPreflight({store_dir:dir,
      candidate_sha256:c.candidate_sha256,
      candidate_json:JSON.stringify(c),
      current_provenance_json:JSON.stringify(p),witness_json:bundle});
    assert.equal(witness.status,"BLOCKED");
    assert.equal(witness.reason,"PRODUCT_TRUST_ROOTS_NOT_APPROVED");
    assert.equal(witness.replay_allowed,false);
    assert.equal(witness.dis_host_executed,false);
    assert.equal(witness.effect_dispatched,false);
    // Tombstone after witness: the same store refuses everything further.
    const revoked=await revokeStoredCandidate({store_dir:dir,
      candidate_sha256:c.candidate_sha256,reason:"OPERATOR_REVOKED"});
    assert.equal(revoked.status,"INVALIDATED");
    const after=await inspectStoredReplay({store_dir:dir,
      candidate_sha256:c.candidate_sha256,
      current_provenance_json:JSON.stringify(p)});
    assert.equal(after.status,"INVALIDATED");
    assert.equal(after.reason,"EXPLICIT_REVOCATION");
  }finally{rmSync(dir,{recursive:true,force:true});}
});
