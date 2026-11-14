#!/usr/bin/env python3
"""Fixed, typed HiGHS LP operation. No shell, argv passthrough or arbitrary code."""
import hashlib
import json
import math
import os
import pathlib
import stat
import sys

SCHEMA = "formal-tools/highs-solve-lp/1.0"
MAX_INPUT_BYTES = 65536
MAX_VARIABLES = 64
MAX_CONSTRAINTS = 128

def fail(message, code=2):
    print("HIGHS_TYPED_OPERATION_ERROR: " + message, file=sys.stderr, flush=True)
    raise SystemExit(code)

def finite_number(value):
    return type(value) in (int, float) and math.isfinite(value)

def exact_keys(value, expected):
    return type(value) is dict and set(value.keys()) == set(expected)

def bound(value):
    return value is None or finite_number(value)

if len(sys.argv) != 2:
    fail("EXPECTED_ONE_PRIVATE_JSON_REQUEST")
request_path = pathlib.Path(sys.argv[1])
try:
    resolved = request_path.resolve(strict=True)
    tmp_root = pathlib.Path(os.path.realpath(os.getenv("TMPDIR", "/tmp")))
    if os.path.commonpath((str(tmp_root), str(resolved))) != str(tmp_root):
        fail("REQUEST_OUTSIDE_PRIVATE_TMP")
    st = os.lstat(request_path)
    if not stat.S_ISREG(st.st_mode) or stat.S_ISLNK(st.st_mode) or st.st_size > MAX_INPUT_BYTES:
        fail("REQUEST_NOT_REGULAR_OR_SIZE_LIMIT")
    raw = request_path.read_bytes()
except SystemExit:
    raise
except Exception as exc:
    fail("REQUEST_READ_FAILED:" + type(exc).__name__)
if len(raw) > MAX_INPUT_BYTES:
    fail("REQUEST_SIZE_LIMIT")
input_sha256 = hashlib.sha256(raw).hexdigest()
try:
    model = json.loads(raw.decode("utf-8"), parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)))
except Exception:
    fail("REQUEST_JSON_INVALID")
if not exact_keys(model, ("sense", "objective", "variables", "constraints")):
    fail("MODEL_SCHEMA_INVALID")
if model["sense"] not in ("min", "max"):
    fail("MODEL_SENSE_INVALID")
objective = model["objective"]
variables = model["variables"]
constraints = model["constraints"]
if type(objective) is not list or not (1 <= len(objective) <= MAX_VARIABLES):
    fail("OBJECTIVE_SIZE_INVALID")
if any(not finite_number(x) for x in objective):
    fail("OBJECTIVE_COEFFICIENT_INVALID")
if type(variables) is not list or len(variables) != len(objective):
    fail("VARIABLE_COUNT_MISMATCH")
for item in variables:
    if not exact_keys(item, ("lower", "upper")) or not bound(item["lower"]) or not bound(item["upper"]):
        fail("VARIABLE_BOUNDS_INVALID")
    if item["lower"] is not None and item["upper"] is not None and item["lower"] > item["upper"]:
        fail("VARIABLE_BOUNDS_REVERSED")
if type(constraints) is not list or len(constraints) > MAX_CONSTRAINTS:
    fail("CONSTRAINT_COUNT_INVALID")
for item in constraints:
    if not exact_keys(item, ("lower", "upper", "coefficients")) or not bound(item["lower"]) or not bound(item["upper"]):
        fail("CONSTRAINT_SCHEMA_INVALID")
    if item["lower"] is not None and item["upper"] is not None and item["lower"] > item["upper"]:
        fail("CONSTRAINT_BOUNDS_REVERSED")
    if type(item["coefficients"]) is not list or len(item["coefficients"]) != len(objective):
        fail("CONSTRAINT_COEFFICIENT_COUNT_MISMATCH")
    if any(not finite_number(x) for x in item["coefficients"]):
        fail("CONSTRAINT_COEFFICIENT_INVALID")
try:
    solver_time_limit = float(os.environ.get("FORMAL_TOOLS_HIGHS_TIME_LIMIT_S", "20"))
    if not math.isfinite(solver_time_limit) or not (0.1 <= solver_time_limit <= 30.0):
        fail("SOLVER_TIME_LIMIT_INVALID")
    import numpy as np
    import highspy
except SystemExit:
    raise
except Exception as exc:
    fail("DEPENDENCY_IMPORT_FAILED:" + type(exc).__name__, 3)

actual_version = highspy.Highs().version()
if actual_version != "1.15.1":
    fail("HIGHS_VERSION_MISMATCH_EXPECTED_1.15.1_ACTUAL_" + str(actual_version), 3)
h = highspy.Highs()
def must_ok(label, status):
    if status != highspy.HighsStatus.kOk:
        fail("HIGHS_API_ERROR_" + label + ":" + str(status), 3)
must_ok("OUTPUT_FLAG", h.setOptionValue("output_flag", False))
must_ok("THREADS", h.setOptionValue("threads", 1))
must_ok("TIME_LIMIT", h.setOptionValue("time_limit", solver_time_limit))
inf = highspy.kHighsInf
for index, variable in enumerate(variables):
    lower = -inf if variable["lower"] is None else float(variable["lower"])
    upper = inf if variable["upper"] is None else float(variable["upper"])
    must_ok("ADD_VAR_" + str(index), h.addVar(lower, upper))
    must_ok("CHANGE_COST_" + str(index), h.changeColCost(index, float(objective[index])))
for index, constraint in enumerate(constraints):
    lower = -inf if constraint["lower"] is None else float(constraint["lower"])
    upper = inf if constraint["upper"] is None else float(constraint["upper"])
    indices = np.arange(len(objective), dtype=np.int32)
    values = np.asarray(constraint["coefficients"], dtype=np.float64)
    must_ok("ADD_ROW_" + str(index), h.addRow(lower, upper, len(objective), indices, values))
sense = highspy.ObjSense.kMaximize if model["sense"] == "max" else highspy.ObjSense.kMinimize
must_ok("OBJECTIVE_SENSE", h.changeObjectiveSense(sense))
must_ok("RUN", h.run())
model_status = h.getModelStatus()
status_name = model_status.name
result = {"schema": SCHEMA, "tool": "highs", "highspy_version": actual_version,
          "numpy_version": np.__version__, "python_version": sys.version.split()[0],
          "input_sha256": input_sha256, "model_status": status_name,
          "objective": None, "variables": [], "solver_api_status": "kOk"}
if model_status == highspy.HighsModelStatus.kOptimal:
    solution = h.getSolution()
    values = list(solution.col_value)
    objective_value = h.getObjectiveValue()
    if len(values) != len(objective) or any(not math.isfinite(float(x)) for x in values) or not math.isfinite(float(objective_value)):
        fail("OPTIMAL_SOLUTION_INVALID", 3)
    result["objective"] = float(objective_value)
    result["variables"] = [float(x) for x in values]
elif model_status in (highspy.HighsModelStatus.kInfeasible,
                      highspy.HighsModelStatus.kUnbounded,
                      highspy.HighsModelStatus.kUnboundedOrInfeasible,
                      highspy.HighsModelStatus.kTimeLimit):
    pass
else:
    fail("UNSUPPORTED_MODEL_STATUS_" + status_name, 3)
print(json.dumps(result, sort_keys=True, separators=(",", ":")), flush=True)
