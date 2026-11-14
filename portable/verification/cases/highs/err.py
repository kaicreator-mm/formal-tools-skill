import highspy

# Exact highspy 1.15.1 rejected model-read status is an error boundary.
# Convert typed solver kError to an explicit nonzero process outcome.
h = highspy.Highs()
h.setOptionValue("output_flag", False)
status = h.readModel("/definitely-not-present/highs-invalid-input.lp")
if status != highspy.HighsStatus.kError:
    raise AssertionError(f"unexpected missing-model status: {status!r}")
print("HIGHS_INPUT_REJECTED status=kError", flush=True)
raise SystemExit(3)
