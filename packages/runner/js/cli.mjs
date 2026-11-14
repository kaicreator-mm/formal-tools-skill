#!/usr/bin/env node
/** Node ESM CLI. Native external tools require Node host process permissions. */
import { readFile, open } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { verifyPure } from "../../core/src/finite.mjs";
import { knownTools, inspectTool, validateSource, doctor, runFixture, executeNativePlan } from "./native.mjs";
import { describeNativeTool, planNative, planRawNative, planNativeHelp, toolIds } from "./native-catalog.mjs";
import { toolInfo, inspectInstallation, inspectAllInstallations } from "./tool-manager.mjs";
import { invokeTool } from "./sdk.mjs";
import { listPortfolioTools, describePortfolioTool, inspectPortfolioTool, runPortableGate, runPortfolioOperation } from "./tool-portfolio-t4.mjs";

function localParams(args) {
  /** @type {{[key:string]:string|number|boolean}} */
  const out={};
  for(let i=0;i<args.length;i++) {
    const token=args[i];
    if(!token.startsWith("--")||token==="--")throw new TypeError("expected --option value: "+token);
    const key=token.slice(2);
    if(!/^[a-z][a-z0-9_-]*$/i.test(key)||Object.hasOwn(out,key))throw new TypeError("invalid or repeated option "+key);
    const next=args[i+1];
    if(next===undefined||next.startsWith("--")){out[key]=true;continue;}
    if(/^-?\d+$/.test(next)){out[key]=Number(next);}else out[key]=next;
    i++;
  }
  return out;
}
function flag(args,key,defaultValue) {
  const i=args.indexOf(key);
  return i<0?defaultValue:args[i+1];
}
function optNumber(v,fallback) {
  if(v===undefined)return fallback;
  if(typeof v!=="number")throw new TypeError("option must be a number: "+String(v));
  return v;
}
function optString(v,fallback) {
  if(v===undefined)return fallback;
  if(typeof v!=="string")throw new TypeError("option must be a string: "+String(v));
  return v;
}
const print=x=>process.stdout.write(JSON.stringify(x,null,2)+"\n");
export async function main(args=process.argv.slice(2)) {
  const [action,arg,...rest]=args;
  try {
    let result;
    if (action==="list") {
      result={native_tools:knownTools(),pure_engines:["dag","writers","cnf","states"]};
    } else if (action==="validate") {
      result=await validateSource();
    } else if (action==="inspect") {
      result=await inspectTool(arg);
    } else if (action==="doctor") {
      result=await doctor(arg,Number(flag(rest,"--timeout",15)));
    } else if (action==="run") {
      result=await runFixture(arg,flag(rest,"--case"),Number(flag(rest,"--timeout",30)));
    } else if (action==="suite") {
      const timeout=Number(flag(args,"--timeout",30));
      const results=[];
      for(const tool of knownTools()) for(const which of ["positive","negative"])
        results.push(await runFixture(tool,which,timeout));
      result={cases:results.length,results};
    } else if (action==="info") {
      if(!arg||rest.length)throw new TypeError("info requires exactly one tool ID");
      result=toolInfo(arg);
    } else if (action==="where") {
      if(!arg||rest.length)throw new TypeError("where requires exactly one tool ID");
      result=await inspectInstallation(arg);
    } else if (action==="doctor-all") {
      const opts=localParams([arg,...rest].filter(v=>v!==undefined));
      if(Object.keys(opts).some(k=>!["probe","timeout"].includes(k)))
        throw new TypeError("doctor-all accepts only --probe and --timeout");
      if(opts.probe!==undefined&&opts.probe!==true)
        throw new TypeError("--probe must be a standalone switch");
      const timeout=optNumber(opts.timeout,12);
      if(!Number.isInteger(timeout)||timeout<1||timeout>120)
        throw new TypeError("--timeout must be in 1..120 seconds");
      result=await inspectAllInstallations();
      if(opts.probe===true) {
        const probes=[];
        for(const item of result.checks){
          probes.push(item.status==="FOUND_NOT_PROBED"
            ? await doctor(item.tool,timeout)
            : {tool:item.tool,run_status:"NOT_RUN",reason:item.status});
        }
        result={...result,probes,probe_status:"REAL_NATIVE_ATTEMPT"};
      }
    } else if (action==="catalog") {
      result=arg?describeNativeTool(arg):toolIds.map(describeNativeTool);
    } else if (action==="plan") {
      const [op,...opts]=rest;
      result=planNative(arg,op,localParams(opts));
    } else if (action==="exec") {
      const [op,...opts]=rest;
      const params=localParams(opts);
      const timeout=optNumber(params.timeout,30);
      const cwd=optString(params.cwd,process.cwd());
      delete params.timeout;delete params.cwd;
      result=await executeNativePlan(planNative(arg,op,params),{cwd,timeout});
    } else if (action==="invoke") {
      const [op,...opts]=rest;
      const params=localParams(opts);
      const timeoutS=optNumber(params.timeout,30);
      const cwd=optString(params.cwd,process.cwd());
      delete params.timeout;delete params.cwd;
      result=await invokeTool({tool:arg,operation:op,settings:params,timeoutS,cwd});
    } else if (action==="native-help") {
      const opts=localParams(rest);
      if(Object.keys(opts).some(k=>!["entry","timeout","cwd"].includes(k)))throw new TypeError("invalid help options");
      result=await executeNativePlan(planNativeHelp(arg,opts.entry),{timeout:optNumber(opts.timeout,15),cwd:optString(opts.cwd,process.cwd())});
    } else if (action==="native") {
      const split=rest.indexOf("--");
      if(split<0)throw new TypeError("raw local native CLI requires -- before native argv");
      const opts=localParams(rest.slice(0,split));
      if(Object.keys(opts).some(k=>!["entry","timeout","cwd"].includes(k)))throw new TypeError("invalid raw options");
      const entry=opts.entry??describeNativeTool(arg).entries[0];
      result=await executeNativePlan(planRawNative(arg,entry,rest.slice(split+1)),
        {allowRaw:true,cwd:optString(opts.cwd,process.cwd()),timeout:optNumber(opts.timeout,30)});
    } else if (action==="portfolio") {
      if(arg==="list"&&rest.length===0)result={tools:listPortfolioTools(),status:"DISCOVERY_NOT_T4_QUALIFIED"};
      else if(arg==="describe"&&rest.length===1)result=describePortfolioTool(rest[0]);
      else if(arg==="inspect"&&rest.length===1)result=await inspectPortfolioTool(rest[0]);
      else if(["doctor","verify"].includes(arg)&&rest.length===1)
        result=await runPortableGate(rest[0],{mode:arg==="doctor"?"doctor":"verify-fixture"});
      else if(arg==="invoke"&&rest.length>=3){
        const [tool,operation,...options]=rest;
        const params=localParams(options);
        if(Object.keys(params).some(k=>!["model","timeout"].includes(k)))
          throw new TypeError("portfolio invoke accepts only --model and --timeout");
        const modelFile=optString(params.model,"");
        if(!modelFile)throw new TypeError("portfolio invoke requires --model <JSON-file>");
        const modelPath=resolve(modelFile);
        if(fsConstants.O_NOFOLLOW===undefined)throw new Error("NOFOLLOW_UNAVAILABLE");
        const modelHandle=await open(modelPath,fsConstants.O_RDONLY|fsConstants.O_NOFOLLOW);
        let model;
        try{
          const fileStat=await modelHandle.stat();
          if(!fileStat.isFile()||fileStat.size>65536)
            throw new TypeError("model file must be a regular non-symlink file <=64KiB");
          model=JSON.parse(await modelHandle.readFile("utf8"));
        }finally{await modelHandle.close();}
        result=await runPortfolioOperation(tool,operation,model,{timeoutS:optNumber(params.timeout,30)});
      }
      else throw new TypeError("portfolio usage: list | describe TOOL | inspect TOOL | doctor CANDIDATE | verify CANDIDATE | invoke highs solve-lp --model model.json [--timeout N]");
    } else if (action==="pure") {
      const path=flag(rest,"--input");
      if (!path) throw new TypeError("pure requires --input <JSON-file>");
      const model=JSON.parse(await readFile(path,"utf8"));
      result=verifyPure(/** @type {import("../../core/src/finite.mjs").PureEngine} */(arg),model);
    } else {
      throw new TypeError("Usage: cli.mjs <list|validate|info TOOL|where TOOL|doctor-all [--probe --timeout N]|catalog [TOOL]|plan TOOL OP --option value|exec TOOL OP --option value|invoke TOOL OP --option value|native-help TOOL|native TOOL -- [official args]|inspect TOOL|doctor TOOL|run TOOL --case positive|negative|suite|pure KIND --input file.json>");
    }
    print(result);
    if(action==="validate")return result.status==="STATIC_PASS"?0:2;
    if(action==="run")return result.test_verdict==="PASS"?0:2;
    if(action==="suite")return result.results.every(x=>x.test_verdict==="PASS")?0:2;
    // Doctor and native-help fingerprint the installed binary: success = executed with captured
    // output. Some official CLIs exit non-zero for --help/--version (TLC 2.19, cvc5, apalache),
    // so the observed exit code stays in the receipt instead of gating these probes.
    if(action==="doctor")return result.run_status==="EXECUTED"?0:2;
    if(action==="native-help")return result.run_status==="EXECUTED"&&(result.executions?.[0]?.stdout||result.executions?.[0]?.stderr)?0:2;
    if(action==="where")return result.status==="FOUND_NOT_PROBED"?0:2;
    if(action==="doctor-all"){
      if(result.probes)return result.probes.every(x=>x.run_status==="EXECUTED")?0:2;
      return result.checks.every(x=>x.status==="FOUND_NOT_PROBED")?0:2;
    }
    if(action==="portfolio"){
      if(arg==="inspect")return result.status==="FOUND_PINNED_NOT_EXECUTED"||result.status==="EXISTING_NATIVE_ADAPTER_NOT_PROBED"?0:2;
      if(arg==="doctor")return result.status==="DOCTOR_EXECUTED_NOT_T3"?0:2;
      if(arg==="verify")return result.status==="FIXTURE_TECHNICAL_PASS_UNREVIEWED"?0:2;
      if(arg==="invoke")return result.status==="T4_OPERATION_EXECUTED_UNREVIEWED"?0:2;
      return 0;
    }
    if(action==="pure")return result.tool_outcome==="UNKNOWN"?2:0;
    if(action==="invoke")return result.process.status==="EXIT_ZERO"?0:2;
    if(["exec","native"].includes(action))return result.process_outcome==="EXIT_ZERO"?0:2; // counterexample is a meaningful observation
    return 0;
  } catch(e) {
    process.stderr.write(JSON.stringify({status:"ERROR",message:String(e)})+"\n");
    return 2;
  }
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
  process.exitCode=await main();
