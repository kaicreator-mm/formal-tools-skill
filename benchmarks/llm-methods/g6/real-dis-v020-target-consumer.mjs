/**
 * Issue #11 G6 R15: consume the ORIGINAL kaicreator-mm/domain-harness DIS
 * v0.2.0 SDK/KDP target at its pinned draft HEAD — never a reimplementation.
 *
 * The driver runs ON a real Linux/x64 Node24 host next to a byte-verified
 * original checkout and executes the original repo's own consumer tests
 * (child processes, unmodified original bytes), while formal-tools in-process
 * stages seal the pinned G3 candidate, prove the Owner/Oracle/Host witness is
 * strictly BLOCKED (no real credentials exist), and revalidate the durable G4
 * store/expiry/tombstone boundary before and after the original DIS chain.
 *
 * Technical-only: an OBSERVATION receipt or KDP admission is not business
 * authority; positive Replay stays BLOCK; effects stay forbidden. No result
 * of this driver is a Product PASS, Host attestation or qualified Solution.
 */
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {resolve, isAbsolute} from "node:path";
import {pathToFileURL} from "node:url";
import {assessMethod} from "../../../packages/runner/js/method-planner.mjs";
import {persistSolutionCandidate, inspectStoredReplay, revokeStoredCandidate}
  from "../../../packages/runner/js/solution-store.mjs";
import {inspectQualificationPreflight} from "../../../packages/runner/js/qualification-witness.mjs";
import {inspectDisV020Consumption, DIS_V020_REFERENCE}
  from "../../../packages/runner/js/dis-v020-consumer-preflight.mjs";
import {buildRealLifecycleCandidate} from "../g4/real-provenance.mjs";
import {verifyCleanOriginalGitWorktree}
  from "../../../packages/runner/js/verified-git-worktree.mjs";

const SHA40=/^[a-f0-9]{40}$/;
const gitBlob=b=>createHash("sha1").update(Buffer.concat([
  Buffer.from("blob "+b.length+"\0"),b])).digest("hex");
const scriptGitBlob=url=>gitBlob(Buffer.from(readFileSync(url).toString("utf8")
  .replace(/\r\n/g,"\n"),"utf8"));
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const rawBlob=(root,rel)=>gitBlob(readFileSync(resolve(root,rel)));

/**
 * Byte-verify the original target: HEAD and every selected source pin must
 * match the re-pinned reference. No network, no build, no source edits.
 */
function verifyOriginalTarget(root){
  const head=spawnSync("git",["-C",root,"rev-parse","HEAD"],
    {encoding:"utf8",timeout:15000,maxBuffer:8192});
  assert(head.status===0&&SHA40.test(head.stdout.trim()),
    "original target checkout has no resolvable exact HEAD");
  const verified_head=head.stdout.trim();
  assert(verified_head===DIS_V020_REFERENCE.source_head,
    "original target HEAD drifted from the pinned DIS reference");
  const pins={
    consumer_test:[DIS_V020_REFERENCE.example_path,DIS_V020_REFERENCE.example_blob],
    selected_build:["examples/dis-v020-cross-project/selected-build.mjs",
      "450f16affdd91071ae104da64fa10e1c0a162c48"],
    selected_build_test:["examples/dis-v020-cross-project/selected-build.test.mjs",
      "620b34d10ab4dd2bcf0cd28afd88f7485acc9086"],
    build_entry:["tooling/build/dis-v020.mjs","e747c332f4c3e59b07ee702035fbf9309651fa3a"],
    contracts_entry:["packages/contracts/dis-v020.mjs","d4e75b2b55c410bac030638734ea761bd5448d9e"],
    microkernel_entry:["packages/microkernel/dis-v020.mjs","55c2d0e88964ec3a90d19d7bc48b2b651054b28d"],
    native_fixture:["examples/dis-v020-native-sdk/native-fixture.mjs","181d62da108762b0b0bdf987c6083889d2bbefa5"],
    cross_project_consumer:["examples/dis-v020-cross-project/consumer.mjs","28bd62fbdfd89ba488656f95d48b2b3595444392"],
    cross_project_manifest:["examples/dis-v020-cross-project/manifest.json","39e14468723c4211d1e55d6a7c3aa1a16204c5a8"],
    tally_snapshot:["examples/dis-v020-cross-project/snapshots/tally/business.mjs",
      "54015fb63ffb13b4f4e562f660d2172098b5f7f4"],
  };
  const verified=[];
  for(const [role,[rel,blob]] of Object.entries(pins)){
    const actual=rawBlob(root,rel);
    assert(actual===blob,role+" source drifted: "+rel);
    verified.push(Object.freeze({role,path:rel,git_blob:actual}));
  }
  return Object.freeze({verified_head,pins_verified:verified});
}

/** Run one ORIGINAL test file as an unmodified child process of the target. */
function runOriginalTest(root,rel,label,expectPass){
  const started=Date.now();
  const run=spawnSync(process.execPath,["--import","tsx","--test",rel],
    {cwd:root,encoding:"utf8",timeout:180000,maxBuffer:4194304});
  assert(!run.error,"original test spawn failed: "+String(run.error?.message??run.error));
  assert(run.status===0,label+" original chain did not exit clean");
  const tap=run.stdout;
  const count=re=>{const m=tap.match(re);assert(m,label+" TAP summary missing "+re);return Number(m[1]);};
  const total=count(/^ℹ tests (\d+)/m),passed=count(/^ℹ pass (\d+)/m),
    failed=count(/^ℹ fail (\d+)/m);
  assert(total===expectPass&&passed===expectPass&&failed===0,
    label+" original chain result drifted from "+expectPass+" passing tests");
  return Object.freeze({
    file:rel,exit_code:run.status,
    tests:Object.freeze({total,passed,failed}),
    duration_ms:Date.now()-started,
    stdout_sha256:createHash("sha256").update(tap,"utf8").digest("hex"),
  });
}

/** Build a structurally exact witness bundle for the pinned candidate. The
 * signatures are placeholder bytes: the shipped trust registry denies every
 * bundle before any signature is ever examined. */
function witnessBundleFor(source,now_ms){
  const c=source.candidate,p=source.provenance;
  const subject={
    schema:"formal-tools/qualification-subject/0.1",
    candidate_sha256:c.candidate_sha256,
    problem_sha256:c.problem_sha256,
    method_sha256:c.method_sha256,
    source_id:p.source_id,source_sha256:p.source_sha256,
    oracle_id:p.oracle_id,oracle_sha256:p.oracle_sha256,
    model_sha256:p.model_sha256,tool_id:p.tool_id,
    tool_version:p.tool_version,tool_binary_sha256:p.tool_binary_sha256,
    evidence_sha256:p.evidence_sha256,
    claim_ref:"ads.real-lifecycle/claim_r1..r6",
    scope:"formal-tools/engineering-consumption-only",
    valid_from_ms:now_ms-1000,valid_until_ms:now_ms+3600000,
  };
  const signatures=["SOURCE_OWNER","INDEPENDENT_ORACLE","TRUSTED_HOST"].map(role=>({
    role,key_id:"placeholder-"+role.toLowerCase(),
    signature_b64:Buffer.from("no real credential exists").toString("base64")}));
  return JSON.stringify({schema:"formal-tools/qualification-witnesses/0.1",
    subject,signatures});
}

/**
 * @param {{store_dir?:string,formal_head?:string,dis_original_root?:string}} [args]
 */
export async function runRealDisV020TargetConsumption({store_dir,formal_head,
  dis_original_root}={}){
  assert(typeof store_dir==="string"&&store_dir.startsWith("/")&&
    typeof formal_head==="string"&&SHA40.test(formal_head)&&
    typeof dis_original_root==="string"&&isAbsolute(dis_original_root)&&
    dis_original_root.length>1,
    "must provide a POSIX store, exact formal HEAD and absolute original root");
  assert(process.platform==="linux"&&process.arch==="x64",
    "the pinned DIS v0.2 Target is linux/x64/node; refusing other platforms");
  // Stage 1 — enforce a clean tracked original checkout: ten selected blobs
  // alone cannot cover imported helper modules. Not an attested npm/Host root.
  const checkoutBefore=verifyCleanOriginalGitWorktree(dis_original_root);
  const target=verifyOriginalTarget(dis_original_root);
  // Stage 2 — real pinned G3 Method/Solution candidate.
  const source=buildRealLifecycleCandidate();
  const method=assessMethod(JSON.parse(source.problem_json),JSON.parse(source.method_json));
  assert(method.status==="STRUCTURALLY_VALID"&&
    source.candidate.status==="CANDIDATE"&&
    source.candidate.claim_result==="UNVERIFIED",
    "pinned G3 candidate or Method drifted outside its frozen scope");
  const candidate_json=JSON.stringify(source.candidate);
  const current_provenance_json=JSON.stringify(source.provenance);
  const candidate_sha256=source.candidate.candidate_sha256;
  // Stage 3 — durable G4 store at the Host boundary: persist + inspect.
  const persisted=await persistSolutionCandidate({store_dir,
    problem_json:source.problem_json,method_json:source.method_json,
    provenance_json:current_provenance_json});
  assert(persisted.status==="CANDIDATE_PERSISTED"&&
    persisted.candidate_sha256===candidate_sha256&&
    persisted.replay_allowed===false&&persisted.solution_promotable===false,
    "durable store did not persist the unqualified candidate fail-closed");
  const inspected=await inspectStoredReplay({store_dir,candidate_sha256,
    current_provenance_json});
  assert(inspected.status==="REPLAY_BLOCKED_UNQUALIFIED",
    "stored candidate replay gate is not the unqualified refusal");
  // Stage 4 — Owner/Oracle/Host witness: strictly BLOCKED. The shipped
  // registry has no PRODUCT_APPROVED anchors, so no signature is even read.
  const now_ms=Date.now();
  const witness_json=witnessBundleFor(source,now_ms);
  const witness=await inspectQualificationPreflight({store_dir,candidate_sha256,
    candidate_json,current_provenance_json,witness_json});
  assert(witness.status==="BLOCKED"&&
    witness.reason==="PRODUCT_TRUST_ROOTS_NOT_APPROVED"&&
    witness.independent_professional_oracle===false&&
    witness.qualified_solution===false&&witness.replay_allowed===false&&
    witness.solution_promotable===false&&witness.dis_host_executed===false&&
    witness.effect_dispatched===false,
    "witness preflight must strictly BLOCK without real credentials");
  // Stage 5 — store adversarial revalidation: STALE then tombstone dominates.
  const drifted=JSON.parse(current_provenance_json);
  drifted.model_sha256="f".repeat(64);
  const stale=await inspectStoredReplay({store_dir,candidate_sha256,
    current_provenance_json:JSON.stringify(drifted)});
  assert(stale.status==="STALE","drifted provenance must be STALE, not reusable");
  const revoked=await revokeStoredCandidate({store_dir,candidate_sha256,
    reason:"OPERATOR_REVOKED"});
  assert(revoked.status==="INVALIDATED",expected("revocation",revoked.status));
  const tombstoned=await inspectStoredReplay({store_dir,candidate_sha256,
    current_provenance_json});
  assert(tombstoned.status==="INVALIDATED"&&
    tombstoned.reason==="EXPLICIT_REVOCATION",
    "tombstone must dominate an otherwise identical candidate");
  const resurrect=await persistSolutionCandidate({store_dir,
    problem_json:source.problem_json,method_json:source.method_json,
    provenance_json:current_provenance_json});
  assert(resurrect.status==="INVALIDATED",
    "append-only tombstone must forbid resurrection of identical bytes");
  // Stage 6 — ORIGINAL DIS AOT/SDK/KDP/Host chain, executed as unmodified
  // child processes of the byte-verified original checkout. The original
  // tests observe authority NONE, OBSERVATION receipts, KDP ADMITTED with
  // execution NOT_PROVEN, forged-claim refusal, stale-pin boot denial and a
  // declared external Effect that cannot be invoked through the adapter.
  const consumer_test=runOriginalTest(dis_original_root,
    "examples/dis-v020-native-sdk/b05-target-consumer.test.mjs",
    "consumer",3);
  const selected_build_test=runOriginalTest(dis_original_root,
    "examples/dis-v020-cross-project/selected-build.test.mjs",
    "selected build",9);
  // Another check after both children catches any persistent source mutation;
  // it cannot prove there was no concurrent swap-and-restore during execution.
  const checkoutAfter=verifyCleanOriginalGitWorktree(dis_original_root);
  // Stage 7 — the DIS preflight envelope against the re-pinned reference for
  // the same unqualified candidate (typed refusal, no Host invocation).
  const preflight=inspectDisV020Consumption({candidate_json,
    current_provenance_json,target_head:DIS_V020_REFERENCE.source_head});
  assert(preflight.status==="REPLAY_BLOCKED_UNQUALIFIED"&&
    preflight.kind==="UNKNOWN"&&preflight.authority==="NONE"&&
    preflight.effect_dispatched===false&&preflight.host_invocations===0,
    "DIS preflight envelope must refuse the unqualified candidate");
  return Object.freeze({
    schema:"formal-tools/i11-real-dis-v020-target-consumption/0.1",
    source_head:formal_head,
    driver_git_blob:scriptGitBlob(new URL(import.meta.url)),
    technical_execution:Object.freeze({
      driver_git_blob:scriptGitBlob(new URL(import.meta.url)),
      original_chain_executed:true,
      original_chain_in_process:false,
      source_commit_independently_attested:false,
      host_independently_attested:false,
    }),
    dis_target_reference:DIS_V020_REFERENCE,
    original_target:Object.freeze({...target,
      clean_checkout_before:checkoutBefore,clean_checkout_after:checkoutAfter}),
    execution_platform:Object.freeze({node:process.version,
      platform:process.platform,architecture:process.arch,
      runtime_target:"linux/x64/node"}),
    candidate_sha256,
    method:{status:method.status,problem_sha256:method.problem_sha256,
      method_sha256:method.method_sha256},
    witness_result:Object.freeze({
      status:witness.status,reason:witness.reason,
      independent_professional_oracle:false,qualified_solution:false,
      claim_result:witness.claim_result,replay_allowed:false,
      solution_promotable:false,dis_host_executed:false,effect_dispatched:false,
      positive_replay:"BLOCK",
      product_owner_credential:"ABSENT",independent_oracle_credential:"ABSENT",
      trusted_host_credential:"ABSENT"}),
    store_lifecycle:Object.freeze({
      persist:{status:persisted.status,record_write:persisted.record_write},
      inspect:{status:inspected.status},
      stale_probe:{status:stale.status},
      revoke:{status:revoked.status,reason:revoked.reason},
      tombstone_dominates:{status:tombstoned.status,reason:tombstoned.reason},
      no_resurrection:{status:resurrect.status}}),
    original_chain:Object.freeze({
      consumer_test,selected_build_test,
      observed_semantics:Object.freeze({
        business_function:"tally.assessTaskEvidence",
        kinds:"OBSERVATION",authority:"NONE",attested:false,
        kdp_admission:"ADMITTED",execution:"NOT_PROVEN",
        business_attested:false,
        forged_claim_task_pass:false,
        stale_pin_boot:"DIS_SOURCE_ANCHOR_STALE",
        missing_pin_coverage:"DIS_SOURCE_ANCHOR_COVERAGE_INCOMPLETE",
        external_effect:"FORBIDDEN_WITHOUT_KDP_PERMIT"}),
    }),
    dis_preflight_envelope:Object.freeze({status:preflight.status,
      kind:preflight.kind,authority:preflight.authority,
      claim_result:preflight.claim_result,effect_dispatched:false,
      host_invocations:0}),
    qualification:Object.freeze({positive_replay:"BLOCK",
      g4_qualified_replay:"BLOCK",g5_formal_accepted:"BLOCK",
      g6_dis_host:"TECHNICAL_ONLY_NOT_ATTESTED"}),
    original_claim:"UNVERIFIED",
    independent_professional_oracle:false,
    qualified_solution:false,qualified_replay:false,
    dis_effects:0,
    status:"PASSED_ENGINEERING_ONLY",
  });
}
const expected=(phase,actual)=>phase+" produced "+actual+", expected INVALIDATED";
async function main(args){
  assert(args.length===3,
    "usage: node real-dis-v020-target-consumer.mjs STORE_DIR FORMAL_HEAD DIS_ORIGINAL_ROOT");
  const result=await runRealDisV020TargetConsumption({store_dir:args[0],
    formal_head:args[1],dis_original_root:args[2]});
  process.stdout.write(JSON.stringify(result,null,2)+"\n");
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)
  main(process.argv.slice(2)).catch(e=>{
    console.error("REAL_DIS_V020_TARGET_CONSUMPTION_BLOCKED: "+String(e?.message??e));
    process.exitCode=1;
  });
