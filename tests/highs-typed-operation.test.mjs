import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { describePortfolioTool, planPortfolioOperation, runPortfolioOperation } from "../packages/runner/js/tool-portfolio-t4.mjs";
import * as sdk from "../packages/runner/js/sdk.mjs";

const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const model={
  sense:"max",objective:[3,2],
  variables:[{lower:0,upper:null},{lower:0,upper:null}],
  constraints:[{lower:null,upper:1,coefficients:[1,1]}]
};
const sha=bytes=>createHash("sha256").update(bytes).digest("hex");

async function fixtureBundle(){
  const root=await mkdtemp(join(tmpdir(),"ft-highs-typed-test-"));
  await mkdir(join(root,"bin"),{recursive:true});
  await mkdir(join(root,"tools","highs"),{recursive:true});
  await mkdir(join(root,"tests","highs"),{recursive:true});
  await writeFile(join(root,"tools","highs","meta.json"),JSON.stringify({
    tool_id:"highs",version:"1.15.1",kind:"python-library",unavailable:false
  })+"\n");
  await writeFile(join(root,"tools","highs","run"),"#!/bin/sh\nexit 0\n");
  await chmod(join(root,"tools","highs","run"),0o755);
  await copyFile(join(repoRoot,"portable/verification/cases/highs/expect.sh"),join(root,"tests","highs","expect.sh"));
  await copyFile(join(repoRoot,"portable/verification/cases/highs/solve-lp.py"),join(root,"tests","highs","solve-lp.py"));
  const runner=join(root,"bin","tool-runner");
  const source=`#!/usr/bin/env node
const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const root=path.resolve(__dirname,"..");
const [command,id,script,input]=process.argv.slice(2);
if(command!=="run"||id!=="highs"||script!==path.join(root,"tests","highs","solve-lp.py")||process.argv.length!==6)process.exit(2);
if(!process.env.FORMAL_TOOLS_HIGHS_TIME_LIMIT_S)process.exit(3);
const raw=fs.readFileSync(input);
const model=JSON.parse(raw.toString("utf8"));
const input_sha256=crypto.createHash("sha256").update(raw).digest("hex");
process.stdout.write(JSON.stringify({
  schema:"formal-tools/highs-solve-lp/1.0",tool:"highs",highspy_version:"1.15.1",
  numpy_version:"2.2.4",python_version:"3.13.5",input_sha256,
  model_status:"kOptimal",objective:3,variables:[1,0],solver_api_status:"kOk"
})+"\\n");
`;
  await writeFile(runner,source);
  await chmod(runner,0o755);
  const runnerBytes=await readFile(runner);
  return {root,runnerSha:sha(runnerBytes),cleanup:()=>rm(root,{recursive:true,force:true})};
}

test("Highs candidate exposes one bounded typed Python Library operation, never raw argv",()=>{
  const description=describePortfolioTool("highs");
  assert.ok(description.operations.includes("solve-lp"));
  assert.equal(description.raw_argv_allowed,false);
  const plan=planPortfolioOperation("highs","solve-lp",model);
  assert.equal(plan.schema,"formal-tools/highs-solve-lp/1.0");
  assert.equal(plan.raw_argv_allowed,false);
  assert.equal(plan.budget.max_variables,64);
  assert.equal(plan.budget.max_constraints,128);
  assert.match(plan.input_sha256,/^[a-f0-9]{64}$/);
  assert.throws(()=>planPortfolioOperation("highs","raw",model),/unadmitted/);
  assert.throws(()=>planPortfolioOperation("nuXmv","solve-lp",model),/unadmitted/);
  assert.throws(()=>planPortfolioOperation("highs","solve-lp",{...model,argv:["sh"]}),/HIGHS_MODEL_SCHEMA_INVALID/);
  assert.throws(()=>planPortfolioOperation("highs","solve-lp",{...model,constraints:[{lower:null,upper:1,coefficients:[1]}]}),/HIGHS_CONSTRAINT_INVALID/);
});

test("SDK and CLI use the same pinned typed operation; CLI opens model with O_NOFOLLOW",{skip:process.platform!=="linux"||process.arch!=="x64"},async()=>{
  assert.equal(typeof sdk.planPortfolioOperation,"function");
  assert.equal(typeof sdk.runPortfolioOperation,"function");
  const bundle=await fixtureBundle();
  const oldRoot=process.env.FORMAL_PORTABLE_ROOT,oldPin=process.env.FORMAL_PORTABLE_RUNNER_SHA256;
  const modelPath=join(bundle.root,"model.json");
  await writeFile(modelPath,JSON.stringify(model));
  try{
    process.env.FORMAL_PORTABLE_ROOT=bundle.root;
    process.env.FORMAL_PORTABLE_RUNNER_SHA256=bundle.runnerSha;
    const receipt=await runPortfolioOperation("highs","solve-lp",model,{timeoutS:10});
    assert.equal(receipt.status,"T4_OPERATION_EXECUTED_UNREVIEWED");
    assert.equal(receipt.qualification,"NOT_T4_ACCEPTED_INDEPENDENT_REVIEW_PENDING");
    assert.equal(receipt.solver.highspy_version,"1.15.1");
    assert.equal(receipt.solver.model_status,"kOptimal");
    assert.equal(receipt.solver.objective,3);
    assert.deepEqual(receipt.solver.variables,[1,0]);
    assert.equal(receipt.process.exit_code,0);
    assert.match(receipt.operation_script_sha256,/^[a-f0-9]{64}$/);
    assert.equal(receipt.input_sha256,receipt.solver.input_sha256);
    const cli=spawnSync(process.execPath,[
      join(repoRoot,"packages/runner/js/cli.mjs"),
      "portfolio","invoke","highs","solve-lp","--model",modelPath,"--timeout","10"
    ],{cwd:repoRoot,encoding:"utf8",timeout:15000,env:{...process.env}});
    assert.equal(cli.status,0,cli.stderr);
    const cliReceipt=JSON.parse(cli.stdout);
    assert.equal(cliReceipt.status,"T4_OPERATION_EXECUTED_UNREVIEWED");
    assert.equal(cliReceipt.solver.model_status,"kOptimal");
  }finally{
    if(oldRoot===undefined)delete process.env.FORMAL_PORTABLE_ROOT;else process.env.FORMAL_PORTABLE_ROOT=oldRoot;
    if(oldPin===undefined)delete process.env.FORMAL_PORTABLE_RUNNER_SHA256;else process.env.FORMAL_PORTABLE_RUNNER_SHA256=oldPin;
    await bundle.cleanup();
  }
});

test("MCP exposes the same typed operation with a closed schema and no argv field",async()=>{
  const mcp=await readFile(join(repoRoot,"packages/runner/js/mcp.mjs"),"utf8");
  assert.match(mcp,/registerTool\("run_portfolio_operation"/);
  assert.match(mcp,/tool:z\.literal\("highs"\)/);
  assert.match(mcp,/operation:z\.literal\("solve-lp"\)/);
  assert.match(mcp,/model:highsModelSchema/);
  assert.doesNotMatch(mcp,/raw_argv_allowed:z|argv:z\.array/);
});
