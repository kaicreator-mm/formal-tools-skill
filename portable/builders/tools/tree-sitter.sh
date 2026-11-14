# builders/tools/tree-sitter.sh — tree-sitter CLI (official static release binary) +
# python language-pack grammars (tree-sitter-language-pack) kept for the --py shim branch.
# Verification exercises the real CLI route: `generate --js-runtime native` (native
# QuickJS in the CLI) turns the fixture grammar.js into parser.c, which the CLI compiles
# with the build host's gcc — non-hermetic; provenance (Debian gcc 14.2.0, ft-builder:deb13)
# is recorded in docs/tool-portfolio/r14/TREE_SITTER_CLI_NATIVE.json — then `parse` runs
# the committed POS/NEG/ERR cases. The python binding itself is NOT the verification route
# (python_binding_available=false in the r14 receipt).
FT_TOOL_ID=tree-sitter
FT_TOOL_VERSION=0.27.2
FT_TOOL_KIND=binary
FT_MAIN_BIN="tools/tree-sitter/bin/tree-sitter"
FT_UPSTREAM_URL="https://github.com/tree-sitter/tree-sitter/releases/download/v0.27.2/tree-sitter-linux-x64.gz"
FT_PROBE=(bin/tree-sitter --version)

ft_tool_build() {
  local gz; gz=$(ft::fetch "$FT_UPSTREAM_URL")
  mkdir -p "$FT_TOOL_DIR/bin"
  gunzip -c "$gz" > "$FT_TOOL_DIR/bin/tree-sitter"
  chmod +x "$FT_TOOL_DIR/bin/tree-sitter"
  "$FT_TOOL_DIR/bin/tree-sitter" --version >/dev/null || ft::die "tree-sitter CLI not runnable"
  # prefetch grammars for OFFLINE use into the shipped cache (language pack would
  # otherwise hit the network at use time). Locate where it actually lands and
  # normalize to runtimes/py-cache/tree-sitter-language-pack/<ver>/libs/
  local PY="$FT_OUT/runtimes/python313/bin/python3.13"
  export PYTHONHOME="$FT_OUT/runtimes/python313" PYTHONNOUSERSITE=1
  export XDG_CACHE_HOME="$FT_OUT/runtimes/py-cache" HOME=/root
  mkdir -p "$XDG_CACHE_HOME"
  "$PY" -s -c "import tree_sitter_language_pack as t; t.get_parser('c'); t.get_parser('python')" >>"$FT_LOG" 2>&1 \
    || ft::die "tree-sitter grammar prefetch failed"
  local found
  found=$(find "$FT_OUT/runtimes/py-cache" /tmp -name "libtree_sitter_c.so" 2>/dev/null | head -1)
  [ -n "$found" ] || ft::die "grammar cache file not found after prefetch"
  local base; base=$(dirname "$(dirname "$found")")   # .../tree-sitter-language-pack/<ver>
  # copy to staging FIRST (source may live inside py-cache), then replace py-cache
  local stage="$FT_OUT/.ts-stage"; rm -rf "$stage"; mkdir -p "$stage/tree-sitter-language-pack"
  cp -a "$base" "$stage/tree-sitter-language-pack/"
  rm -rf "$FT_OUT/runtimes/py-cache"
  mv "$stage" "$FT_OUT/runtimes/py-cache"
  # pack runs as a non-root host user — grant read access to the root-owned cache
  chmod -R a+rX "$FT_OUT/runtimes/py-cache"
  ft::note ts_grammar_cache "$(find "$FT_OUT/runtimes/py-cache" -name '*.so' | wc -l) grammars"
  ft::make_shim 'export PYTHONHOME="$FT_ROOT/runtimes/python313" PYTHONNOUSERSITE=1 PYTHONDONTWRITEBYTECODE=1
export LD_LIBRARY_PATH="$FT_ROOT/runtimes/python313/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
case "$1" in
  --py)
    export XDG_CACHE_HOME="$FT_ROOT/runtimes/py-cache"
    shift; exec "$FT_ROOT/runtimes/python313/bin/python3.13" -s "$@" ;;
  *)
    # CLI parser build writes to XDG cache. The installed portable bundle is
    # read-only, so redirect to the Runner invocation cache when available.
    if [ -n "${FT_TMP:-}" ]; then
      export XDG_CACHE_HOME="$FT_TMP/tree-sitter-cache"
    elif [ -z "${XDG_CACHE_HOME:-}" ]; then
      export XDG_CACHE_HOME="${HOME:-/tmp}/.cache"
    fi
    mkdir -p "$XDG_CACHE_HOME" || exit 2
    exec "$TOOL_DIR/bin/tree-sitter" "$@" ;;
esac'
}
