/**
 * Issue #24 T4 gateway: one capability-linked portfolio, never 23 MCP servers.
 *
 * The original 13 native operations retain their existing executable catalog.
 * Candidate tools share this one registry/runner gateway. The generic candidate
 * execution remains a committed pos/neg/err fixture; the first typed candidate
 * operation is Highs 1.15.1 solve-lp. No raw argv, caller script, shell or
 * arbitrary file input crosses the MCP boundary. T3/T4/T5 stay independent.
 */
import { readFileSync } from "node:fs";
import { readFile, writeFile, lstat, mkdtemp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { join, resolve, isAbsolute } from "node:path";
import { tmpdir } from "node:os";
import { toolIds } from "./native-catalog.mjs";

const capabilityRegistry=JSON.parse(readFileSync(new URL("../../../registry/PROBLEM_CAPABILITIES.json",import.meta.url),"utf8"));
const dag=JSON.parse(readFileSync(new URL("../../../docs/tool-portfolio/r1/TOOL_PORTFOLIO_DAG.json",import.meta.url),"utf8"));
const oldIds=new Set(toolIds);
const allIds=capabilityRegistry.tools.map(t=>t.id);
const candidateIds=capabilityRegistry.tools.filter(t=>t.origin==="candidate").map(t=>t.id);
const toolById=new Map(capabilityRegistry.tools.map(t=>[t.id,t]));
const versionById=new Map(dag.tools.map(t=>[t.slug,t.version]));
if(allIds.length!==36||new Set(allIds).size!==36||
   candidateIds.length!==23||toolIds.length!==13||
   !toolIds.every(id=>toolById.get(id)?.origin==="native-ref")||
   !candidateIds.every(id=>!oldIds.has(id))||
   !allIds.every(id=>versionById.has(id)))
  throw new Error("portfolio catalog and lifecycle DAG must match 36 unique tools");

const digest=b=>createHash("sha256").update(b).digest("hex");
const maxBytes=1024*1024;
const maxMetadataBytes=65536;
const maxFixtureBytes=65536;
const maxRunnerBytes=1024*1024;
const highsSolveScriptSha256="506a0d9fc0665ab2fcc8cfe1df7c14cf08a449e7fc3b38d4402d4c665d8e728b";
function verifyOptionalPin(variable,actual) {
  const expected=process.env[variable];
  if(expected===undefined)return;
  if(!shaPattern.test(expected))throw new Error(variable+"_INVALID_PIN");
  if(expected!==actual)throw new Error(variable+"_MISMATCH");
}
const shaPattern=/^[a-f0-9]{64}$/;
function profile(id){
  const t=toolById.get(id);
  if(!t)throw new RangeError("unknown portfolio tool: "+String(id));
  return t;
}
function candidate(id){
  const t=profile(id);
  if(t.origin!=="candidate")throw new TypeError("Use the existing 13-tool native adapter for "+id);
  return t;
}
export function listPortfolioTools(){
  return capabilityRegistry.tools.map(t=>({
    id:t.id,origin:t.origin,expected_version:versionById.get(t.id),
    capability_ids:[...t.capability_ids],
    execution_adapter:t.origin==="native-ref"?"NATIVE_CATALOG_13":t.id==="highs"?"PORTABLE_TYPED_PYTHON_LIBRARY_CANDIDATE":"PORTABLE_FIXTURE_GATE_ONLY",
    t4_status:"NOT_QUALIFIED_NATIVE_REVIEW_REQUIRED",
    t5_status:"NOT_QUALIFIED"
  }));
}
export function describePortfolioTool(id){
  const t=profile(id);
  return {...listPortfolioTools().find(x=>x.id===id),official_url:t.official_url,
    operations:t.origin==="candidate"?(id==="highs"?["doctor","verify-fixture","solve-lp"]:["doctor","verify-fixture"]):["EXISTING_NATIVE_CATALOG"],
    raw_argv_allowed:false};
}
function context(){
  const root=process.env.FORMAL_PORTABLE_ROOT;
  const expected=process.env.FORMAL_PORTABLE_RUNNER_SHA256;
  if(process.platform!=="linux"||process.arch!=="x64")
    throw new Error("PORTABLE_HOST_UNSUPPORTED: Debian/Linux x86_64 only");
  if(typeof root!=="string"||!root||!isAbsolute(root))
    throw new Error("PORTABLE_ROOT_NOT_CONFIGURED");
  if(typeof expected!=="string"||!shaPattern.test(expected))
    throw new Error("PORTABLE_RUNNER_DIGEST_NOT_PINNED");
  return {root:resolve(root),expected,runner:join(resolve(root),"bin","tool-runner")};
}
async function regular(path,executable=false){
  const s=await lstat(path);
  if(!s.isFile()||s.isSymbolicLink()||(executable&&!(s.mode&0o111)))
    throw new Error("PORTABLE_FILE_NOT_REGULAR_OR_EXECUTABLE");
  return s;
}
async function installed(id){
  candidate(id);
  const ctx=context();
  const runnerStat=await regular(ctx.runner,true);
  if(runnerStat.size>maxRunnerBytes)throw new Error("PORTABLE_RUNNER_SIZE_LIMIT");
  const b=await readFile(ctx.runner);
  const actual=digest(b);
  if(actual!==ctx.expected)throw new Error("PORTABLE_RUNNER_SHA256_MISMATCH");
  const metaPath=join(ctx.root,"tools",id,"meta.json");
  const shim=join(ctx.root,"tools",id,"run");
  const contract=join(ctx.root,"tests",id,"expect.sh");
  const metaStat=await regular(metaPath);
  await regular(shim,true);
  const contractStat=await regular(contract);
  if(metaStat.size>maxMetadataBytes||contractStat.size>maxFixtureBytes)
    throw new Error("PORTABLE_META_OR_CONTRACT_SIZE_LIMIT");
  const metaBytes=await readFile(metaPath);
  const fixtureBytes=await readFile(contract);
  const metaHash=digest(metaBytes),fixtureHash=digest(fixtureBytes);
  verifyOptionalPin("FORMAL_PORTABLE_META_SHA256",metaHash);
  verifyOptionalPin("FORMAL_PORTABLE_FIXTURE_SHA256",fixtureHash);
  const meta=JSON.parse(metaBytes.toString("utf8"));
  if(meta.tool_id!==id)throw new Error("PORTABLE_META_TOOL_ID_MISMATCH");
  if(typeof meta.version!=="string"||meta.version!==String(versionById.get(id)))
    throw new Error("PORTABLE_VERSION_DRIFT_EXPECTED_"+versionById.get(id));
  if(typeof meta.kind!=="string"||!meta.kind||meta.unavailable===true)
    throw new Error("PORTABLE_META_KIND_OR_AVAILABILITY_INVALID");
  // Host operator must own a stable bundle root. lstat/readFile/spawn is
  // not a filesystem sandbox against an attacker mutating bundle paths.
  return {ctx,meta,meta_sha256:metaHash,
    fixture_contract_sha256:fixtureHash};
}
/** Read-only host discovery; a file hit never counts as an execution result. */
export async function inspectPortfolioTool(id){
  const t=profile(id);
  if(t.origin==="native-ref")return {...describePortfolioTool(id),status:"EXISTING_NATIVE_ADAPTER_NOT_PROBED"};
  try{
    const x=await installed(id);
    return {...describePortfolioTool(id),status:"FOUND_PINNED_NOT_EXECUTED",
      runner_sha256:x.ctx.expected,metadata_sha256:x.meta_sha256,
      fixture_contract_sha256:x.fixture_contract_sha256,
      packaged_kind:x.meta.kind??x.meta.tool_kind??"UNKNOWN",
      packaged_version:x.meta.version??"NOT_IN_META"};
  }catch(e){
    return {...describePortfolioTool(id),status:"NOT_AVAILABLE_FAIL_CLOSED",reason:String(e)};
  }
}
export function planPortfolioFixture(id){
  candidate(id);
  return {tool:id,operation:"verify-fixture",entry:"portable/bin/tool-runner",
    args:["verify",id],mode:"typed",scope:"COMMITTED_POS_NEG_ERR_ONLY"};
}
function exactRecordKeys(value,expected){
  return value!==null&&typeof value==="object"&&!Array.isArray(value)&&
    (Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null)&&
    Object.keys(value).sort().join("\\0")===expected.slice().sort().join("\\0");
}
function finiteModelNumber(value){return typeof value==="number"&&Number.isFinite(value);}
function validModelBound(value){return value===null||finiteModelNumber(value);}
function validateHighsModel(model){
  if(!exactRecordKeys(model,["sense","objective","variables","constraints"]))
    throw new TypeError("HIGHS_MODEL_SCHEMA_INVALID");
  if(!["min","max"].includes(model.sense))throw new TypeError("HIGHS_MODEL_SENSE_INVALID");
  if(!Array.isArray(model.objective)||model.objective.length<1||model.objective.length>64||
     !model.objective.every(finiteModelNumber))
    throw new TypeError("HIGHS_OBJECTIVE_INVALID");
  if(!Array.isArray(model.variables)||model.variables.length!==model.objective.length)
    throw new TypeError("HIGHS_VARIABLE_COUNT_MISMATCH");
  const variables=model.variables.map((v,i)=>{
    if(!exactRecordKeys(v,["lower","upper"])||!validModelBound(v.lower)||!validModelBound(v.upper)||
       (v.lower!==null&&v.upper!==null&&v.lower>v.upper))
      throw new TypeError("HIGHS_VARIABLE_BOUNDS_INVALID_"+i);
    return {lower:v.lower,upper:v.upper};
  });
  if(!Array.isArray(model.constraints)||model.constraints.length>128)
    throw new TypeError("HIGHS_CONSTRAINT_COUNT_INVALID");
  const constraints=model.constraints.map((c,i)=>{
    if(!exactRecordKeys(c,["lower","upper","coefficients"])||
       !validModelBound(c.lower)||!validModelBound(c.upper)||
       (c.lower!==null&&c.upper!==null&&c.lower>c.upper)||
       !Array.isArray(c.coefficients)||c.coefficients.length!==model.objective.length||
       !c.coefficients.every(finiteModelNumber))
      throw new TypeError("HIGHS_CONSTRAINT_INVALID_"+i);
    return {lower:c.lower,upper:c.upper,coefficients:[...c.coefficients]};
  });
  const normalized={sense:model.sense,objective:[...model.objective],variables,constraints};
  const bytes=Buffer.from(JSON.stringify(normalized));
  if(bytes.length>maxFixtureBytes)throw new RangeError("HIGHS_MODEL_SIZE_LIMIT");
  return {model:normalized,bytes,input_sha256:digest(bytes)};
}
export function planPortfolioOperation(id,operation,model){
  if(id!=="highs"||operation!=="solve-lp")
    throw new TypeError("unadmitted typed portfolio operation");
  const t=candidate(id),normalized=validateHighsModel(model);
  return {tool:id,operation,schema:"formal-tools/highs-solve-lp/1.0",
    capability_ids:[...t.capability_ids],model:normalized.model,
    input_sha256:normalized.input_sha256,mode:"typed",
    budget:{max_variables:64,max_constraints:128,max_input_bytes:maxFixtureBytes,max_timeout_s:30},
    raw_argv_allowed:false};
}
/** The first candidate typed operation: fixed Highs Python Library LP model, no argv or user paths. */
export async function runPortfolioOperation(id,operation,model,{timeoutS=30}={}){
  const plan=planPortfolioOperation(id,operation,model);
  if(!Number.isInteger(timeoutS)||timeoutS<1||timeoutS>30)
    throw new TypeError("timeoutS must be integer 1..30");
  let tmp=null;
  try{
    const x=await installed(id);
    tmp=await mkdtemp(join(tmpdir(),"formal-highs-operation-"));
    const script=join(x.ctx.root,"tests","highs","solve-lp.py");
    const scriptStat=await regular(script);
    if(scriptStat.size>maxFixtureBytes)throw new Error("HIGHS_OPERATION_SCRIPT_SIZE_LIMIT");
    const scriptBytes=await readFile(script);
    const scriptHash=digest(scriptBytes);
    if(scriptHash!==highsSolveScriptSha256)throw new Error("HIGHS_OPERATION_SCRIPT_SHA256_MISMATCH");
    if(digest(plan.model?Buffer.from(JSON.stringify(plan.model)):Buffer.alloc(0))!==plan.input_sha256)
      throw new Error("HIGHS_OPERATION_INPUT_HASH_MISMATCH");
    const inputPath=join(tmp,"model.json");
    await writeFile(inputPath,JSON.stringify(plan.model),{flag:"wx",mode:0o600});
    const solverTimeLimit=Math.max(0.1,timeoutS-0.5);
    const p=await capture([x.ctx.runner,"run","highs",script,inputPath],{
      ...process.env,FORMAL_PORTABLE_ROOT:x.ctx.root,FT_EVIDENCE_DIR:tmp,
      FORMAL_TOOLS_HIGHS_TIME_LIMIT_S:String(solverTimeLimit)
    },timeoutS);
    let solver=null,parseError=null;
    if(p.exit_code===0&&!p.timed_out&&!p.output_limit&&!p.error){
      try{
        solver=JSON.parse(p.stdout);
        const allowed=new Set(["kOptimal","kInfeasible","kUnbounded","kUnboundedOrInfeasible","kTimeLimit"]);
        if(solver.schema!=="formal-tools/highs-solve-lp/1.0"||solver.tool!=="highs"||
           solver.highspy_version!=="1.15.1"||solver.input_sha256!==plan.input_sha256||
           solver.solver_api_status!=="kOk"||!allowed.has(solver.model_status)||
           typeof solver.numpy_version!=="string"||typeof solver.python_version!=="string")
          throw new Error("HIGHS_RESULT_SCHEMA_OR_VERSION_INVALID");
        if(solver.model_status==="kOptimal"){
          if(!finiteModelNumber(solver.objective)||!Array.isArray(solver.variables)||
             solver.variables.length!==plan.model.objective.length||!solver.variables.every(finiteModelNumber))
            throw new Error("HIGHS_OPTIMAL_RESULT_INVALID");
        }else if(solver.objective!==null||!Array.isArray(solver.variables)||solver.variables.length!==0){
          throw new Error("HIGHS_NONOPTIMAL_RESULT_INVALID");
        }
      }catch(e){parseError=String(e);solver=null;}
    }
    const complete=p.exit_code===0&&!p.timed_out&&!p.output_limit&&!p.error&&!parseError&&solver!==null;
    return {schema:"formal-tools/portfolio-operation/0.1",tool:id,operation,
      status:complete?"T4_OPERATION_EXECUTED_UNREVIEWED":"PORTFOLIO_OPERATION_FAILED",
      qualification:"NOT_T4_ACCEPTED_INDEPENDENT_REVIEW_PENDING",
      capability_ids:plan.capability_ids,
      process:{exit_code:p.exit_code,signal:p.signal,timed_out:p.timed_out,
        output_limit:p.output_limit,elapsed_ms:p.elapsed_ms,error:p.error??parseError},
      runner_sha256:x.ctx.expected,metadata_sha256:x.meta_sha256,
      fixture_contract_sha256:x.fixture_contract_sha256,
      operation_script_sha256:scriptHash,input_sha256:plan.input_sha256,
      solver,streams:{stdout:p.stdout,stderr:p.stderr,
        stdout_sha256:p.stdout_sha256,stderr_sha256:p.stderr_sha256},
      budget:{timeout_s:timeoutS,solver_time_limit_s:solverTimeLimit,
        max_variables:64,max_constraints:128},
      scope:"T4_TECHNICAL_OPERATION_ONLY_T5_BUSINESS_SEMANTICS_NOT_EVALUATED"};
  }catch(e){
    return {schema:"formal-tools/portfolio-operation/0.1",tool:id,operation,
      status:"NOT_RUN_FAIL_CLOSED",qualification:"NOT_T4_ACCEPTED",
      reason:String(e),scope:"T3_T4_T5_NOT_QUALIFIED"};
  }finally{if(tmp)await rm(tmp,{recursive:true,force:true});}
}
function parseReceipt(id,tsv){
  if(Buffer.byteLength(tsv)>65536)throw new Error("PORTABLE_RECEIPT_TOO_LARGE");
  const rows=tsv.trimEnd().split(/\r?\n/).map(l=>l.split("\t"));
  if(rows[0]?.join("\t")!=="runner_schema\tformal-tools/portable-verify/0.2")
    throw new Error("PORTABLE_RECEIPT_SCHEMA_MISMATCH");
  if(rows.at(-1)?.join("\t")!=="verdict\tPASS")
    throw new Error("PORTABLE_VERDICT_NOT_PASS");
  const cases=rows.slice(1,-1);
  const phases=new Set();
  const evidence=[];
  for(const r of cases){
    if(r.length!==7||r[0]!==id||!["setup","pos","neg","err"].includes(r[1])||
       phases.has(r[1])||!/^-?\d+$/.test(r[2])||!/^\d+$/.test(r[3])||
       r[4]!=="1"||r[5]!=="1"||!r[6])
      throw new Error("PORTABLE_RECEIPT_INVALID_PHASE");
    phases.add(r[1]);
    evidence.push({phase:r[1],exit_code:Number(r[2]),duration_ms:Number(r[3]),
      semantic_pattern_matched:true,exit_contract_matched:true,label:r[6]});
  }
  if(!["pos","neg","err"].every(p=>phases.has(p)))
    throw new Error("PORTABLE_RECEIPT_MISSING_POS_NEG_ERR");
  return evidence;
}
async function capture(argv,env,timeoutS){
  return await new Promise(done=>{
    let outputBytes=0,stdout=[],stderr=[],timedOut=false,overLimit=false,error=null,finished=false;
    const start=Date.now();
    let timer;
    const child=spawn(argv[0],argv.slice(1),{
      shell:false,stdio:["ignore","pipe","pipe"],cwd:env.FORMAL_PORTABLE_ROOT,env,
      detached:process.platform==="linux"
    });
    const kill=()=>{try{if(child.pid&&process.platform==="linux")process.kill(-child.pid,"SIGKILL");
      else child.kill("SIGKILL");}catch{}};
    const push=(parts,b)=>{outputBytes+=b.length;
      if(outputBytes>maxBytes){overLimit=true;kill();}else parts.push(b);};
    child.stdout?.on("data",b=>push(stdout,b));
    child.stderr?.on("data",b=>push(stderr,b));
    const finish=(code,signal)=>{if(finished)return;finished=true;clearTimeout(timer);
      const out=Buffer.concat(stdout),err=Buffer.concat(stderr);
      done({exit_code:code,signal,timed_out:timedOut,output_limit:overLimit,
        elapsed_ms:Date.now()-start,error:error===null?null:String(error),
        stdout:out.toString("utf8"),stderr:err.toString("utf8"),
        stdout_sha256:digest(out),stderr_sha256:digest(err)});};
    child.on("error",e=>{error=e;finish(null,null);});
    child.on("close",finish);
    timer=setTimeout(()=>{timedOut=true;kill();},timeoutS*1000);
  });
}
/** A fixed, versioned portable runner fixture, never arbitrary external input. */
export async function runPortableGate(id,{mode="verify-fixture",timeoutS=120}={}){
  candidate(id);
  if(!["verify-fixture","doctor"].includes(mode))throw new TypeError("unadmitted portable operation");
  if(!Number.isInteger(timeoutS)||timeoutS<1||timeoutS>120)
    throw new TypeError("timeoutS must be integer 1..120");
  let tmp=null;
  try{
    const x=await installed(id);
    tmp=await mkdtemp(join(tmpdir(),"formal-portfolio-t4-"));
    const argv=[x.ctx.runner,mode==="doctor"?"doctor":"verify",id];
    const p=await capture(argv,{...process.env,FORMAL_PORTABLE_ROOT:x.ctx.root,
      FT_EVIDENCE_DIR:tmp},timeoutS);
    let cases=[],error=null,receiptSha256=null;
    if(mode==="verify-fixture"&&!p.timed_out&&!p.output_limit&&p.exit_code===0&&!p.error){
      try{
        const file=join(tmp,"verify-"+id+".tsv");
        await regular(file);
        const tsv=await readFile(file,"utf8");
        cases=parseReceipt(id,tsv);
        receiptSha256=digest(Buffer.from(tsv));
      }catch(e){error=String(e);}
    }
    const complete=mode==="verify-fixture"&&p.exit_code===0&&!p.timed_out&&
      !p.output_limit&&!p.error&&!error&&cases.length>=3;
    return {schema:"formal-tools/portfolio-t4-technical/0.1",tool:id,operation:mode,
      status:mode==="doctor"
        ?(p.exit_code===0&&!p.timed_out&&!p.output_limit&&!p.error?"DOCTOR_EXECUTED_NOT_T3":"DOCTOR_FAILED")
        :(complete?"FIXTURE_TECHNICAL_PASS_UNREVIEWED":"FIXTURE_NOT_QUALIFIED"),
      process:{exit_code:p.exit_code,signal:p.signal,timed_out:p.timed_out,
        output_limit:p.output_limit,elapsed_ms:p.elapsed_ms,error:p.error??error},
      runner_sha256:x.ctx.expected,metadata_sha256:x.meta_sha256,
      fixture_contract_sha256:x.fixture_contract_sha256,
      receipt_sha256:receiptSha256,
      streams:{stdout:p.stdout,stderr:p.stderr,
        stdout_sha256:p.stdout_sha256,stderr_sha256:p.stderr_sha256},
      cases,scope:"T4_TECHNICAL_ONLY_T3_NATIVE_REVIEW_AND_T5_SEMANTICS_NOT_EVALUATED"};
  }catch(e){
    return {schema:"formal-tools/portfolio-t4-technical/0.1",tool:id,operation:mode,
      status:"NOT_RUN_FAIL_CLOSED",reason:String(e),
      scope:"T3_T4_T5_NOT_QUALIFIED"};
  }finally{if(tmp)await rm(tmp,{recursive:true,force:true});}
}
