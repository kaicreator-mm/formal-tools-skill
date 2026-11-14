/**
 * Experimental, trusted-host formal-tools API. Types intentionally describe
 * only generic tool management and execution—not solver-selection/business claims.
 * Runtime validates tool IDs against the authoritative JS catalog.
 */
export type ToolSettings = Record<string, string | number | boolean>;
export interface ToolInvokeRequest {
  tool: string;
  operation: string;
  settings?: ToolSettings;
  timeoutS?: number;
  cwd?: string;
}
export interface ScanLimits {
  maxFiles?: number;
  maxDepth?: number;
  maxBytes?: number;
}
export interface StagedToolRequest extends Omit<ToolInvokeRequest, "cwd"> {
  sourceRoot: string;
  inputs: string[];
  workspaceOptions?: ScanLimits;
  artifactOptions?: ScanLimits & {maxDirectories?: number; maxEntries?: number; maxSkipped?: number};
}
export interface ToolArtifact {
  path: string;
  bytes: number;
  sha256: string;
}
export interface TechnicalProcess {
  run_status: string;
  status: "EXIT_ZERO" | "NONZERO_EXIT" | "NOT_STARTED" | "TIMEOUT" | "OUTPUT_LIMIT";
  exit_code: number | null;
  signal: string | null;
  elapsed_ms: number | null;
  timed_out: boolean;
  output_truncated: boolean;
  error: string | null;
}
export interface ToolExecutionResult {
  schema: "formal-tools/tool-execution/1";
  tool_id: string;
  operation: string;
  invocation: { entry: string; args: string[]; mode: "typed" };
  process: TechnicalProcess;
  tool_status: string;
  streams: {
    stdout: { text: string; sha256: string | null };
    stderr: { text: string; sha256: string | null };
  };
  artifacts: {
    status: "NOT_COLLECTED" | "COMPLETE" | "PARTIAL";
    items: ToolArtifact[];
    skipped?: {path: string; reason: string}[];
    scannedFiles?: number;
    hashedBytes?: number;
    unchanged?: number;
  };
  staging?: {
    status: "STAGED_IN_PRIVATE_WORKSPACE";
    inputs: ToolArtifact[];
    totalBytes: number;
  };
  scope: "UPSTREAM_TOOL_TECHNICAL_RESULT_ONLY";
}
export interface ToolPlan {
  tool: string;
  operation: string;
  entry: string;
  args: string[];
  mode: "typed";
  runtime: string;
}
export interface ToolRuntimeProfile {
  id: string;
  title: string;
  source: string;
  entries: string[];
  help: {entry: string; args: string[]};
  runtime: {
    kind: "binary" | "java-jar" | "alloy" | "python-module";
    command: string;
    probeArgs: string[];
    [key: string]: unknown;
  };
  operationCount: number;
}
export interface InstallationInspection {
  tool: string;
  status: string;
  launcher: string;
  probe_status: string;
  executable?: string;
  missing?: string[];
  diagnostics: string[];
  argv?: string[];
}
export function listTools(): string[];
export function toolDetails(tool: string): ToolRuntimeProfile;
export function whereTool(tool: string, options?: Record<string, unknown>): Promise<InstallationInspection>;
export function whereAll(options?: Record<string, unknown>): Promise<{
  status: string; tools: number; counts: Record<string, number>;
  checks: InstallationInspection[];
}>;
export function planTool(tool: string, operation: string, settings?: ToolSettings): ToolPlan;
export function invokeTool(request: ToolInvokeRequest): Promise<ToolExecutionResult>;
export function invokeStagedTool(request: StagedToolRequest): Promise<ToolExecutionResult>;

/** Issue #24 T4 portfolio is discovery + fixed-fixture only, not T5 semantics. */
export interface PortfolioTool {
  id: string;
  origin: "native-ref" | "candidate";
  expected_version: string;
  capability_ids: string[];
  execution_adapter: string;
  t4_status: string;
  t5_status: string;
}
export interface PortfolioFixturePlan {
  tool: string;
  operation: "verify-fixture";
  entry: "portable/bin/tool-runner";
  args: string[];
  mode: "typed";
  scope: string;
}
export interface PortfolioGateReceipt {
  schema: "formal-tools/portfolio-t4-technical/0.1";
  tool: string;
  operation: string;
  status: string;
  process?: { exit_code: number | null; signal: string | null; timed_out: boolean;
    output_limit: boolean; elapsed_ms: number; error: string | null };
  reason?: string;
  runner_sha256?: string;
  metadata_sha256?: string;
  fixture_contract_sha256?: string;
  receipt_sha256?: string | null;
  streams?: { stdout: string; stderr: string; stdout_sha256: string; stderr_sha256: string };
  cases?: { phase: string; exit_code: number; duration_ms: number;
    semantic_pattern_matched: boolean; exit_contract_matched: boolean; label: string }[];
  scope: string;
}
export function listPortfolioTools(): PortfolioTool[];
export function describePortfolioTool(tool: string): PortfolioTool & {
  official_url: string; operations: string[]; raw_argv_allowed: false };
export function inspectPortfolioTool(tool: string): Promise<PortfolioTool & {
  status: string; reason?: string; runner_sha256?: string;
  metadata_sha256?: string; fixture_contract_sha256?: string }>;
export function planPortfolioFixture(tool: string): PortfolioFixturePlan;
export function runPortableGate(tool: string, options?: {
  mode?: "verify-fixture" | "doctor"; timeoutS?: number
}): Promise<PortfolioGateReceipt>;


/** A bounded, typed linear program for the single admitted Highs 1.15.1 Python Library operation. */
export interface HighsLinearProgram {
  sense: "min" | "max";
  objective: number[];
  variables: { lower: number | null; upper: number | null }[];
  constraints: {
    lower: number | null;
    upper: number | null;
    coefficients: number[];
  }[];
}
export interface PortfolioOperationPlan {
  tool: "highs";
  operation: "solve-lp";
  schema: "formal-tools/highs-solve-lp/1.0";
  capability_ids: string[];
  model: HighsLinearProgram;
  input_sha256: string;
  mode: "typed";
  budget: {
    max_variables: 64;
    max_constraints: 128;
    max_input_bytes: number;
    max_timeout_s: 30;
  };
  raw_argv_allowed: false;
}
export interface PortfolioOperationReceipt {
  schema: "formal-tools/portfolio-operation/0.1";
  tool: "highs";
  operation: "solve-lp";
  status: "T4_OPERATION_EXECUTED_UNREVIEWED" | "PORTFOLIO_OPERATION_FAILED" | "NOT_RUN_FAIL_CLOSED";
  qualification: "NOT_T4_ACCEPTED_INDEPENDENT_REVIEW_PENDING" | "NOT_T4_ACCEPTED";
  capability_ids?: string[];
  process?: {
    exit_code: number | null;
    signal: string | null;
    timed_out: boolean;
    output_limit: boolean;
    elapsed_ms: number;
    error: string | null;
  };
  runner_sha256?: string;
  metadata_sha256?: string;
  fixture_contract_sha256?: string;
  operation_script_sha256?: string;
  input_sha256?: string;
  solver?: {
    schema: "formal-tools/highs-solve-lp/1.0";
    tool: "highs";
    highspy_version: "1.15.1";
    numpy_version: string;
    python_version: string;
    input_sha256: string;
    model_status: "kOptimal" | "kInfeasible" | "kUnbounded" | "kUnboundedOrInfeasible" | "kTimeLimit";
    objective: number | null;
    variables: number[];
    solver_api_status: "kOk";
  } | null;
  streams?: { stdout: string; stderr: string; stdout_sha256: string; stderr_sha256: string };
  budget?: { timeout_s: number; solver_time_limit_s: number; max_variables: 64; max_constraints: 128 };
  reason?: string;
  scope: string;
}
export function planPortfolioOperation(tool: "highs", operation: "solve-lp", model: HighsLinearProgram): PortfolioOperationPlan;
export function runPortfolioOperation(tool: "highs", operation: "solve-lp", model: HighsLinearProgram, options?: {
  timeoutS?: number;
}): Promise<PortfolioOperationReceipt>;
