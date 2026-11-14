# builders/tools/why3.sh — Why3 verification platform via the OFFICIAL Debian trixie
# package (why3 1.8.0-2), pulled from the USTC Debian mirror with its dependency closure.
# glibc baseline is Debian 13 by construction.
FT_TOOL_ID=why3
FT_TOOL_VERSION=1.8.0
FT_TOOL_KIND=binary
FT_MAIN_BIN="tools/why3/usr/bin/why3"
FT_UPSTREAM_URL="deb:mirrors.ustc.edu.cn/debian trixie main (why3 1.8.0-2 + dep closure)"
FT_PROBE=(usr/bin/why3 --version)

ft_tool_build() {
  mkdir -p /tmp/why3debs
  apt-get update -qq >>"$FT_LOG" 2>&1
  apt-get install -y --no-install-recommends --download-only -o Dir::Cache::archives=/tmp/why3debs \
      why3 >>"$FT_LOG" 2>&1 || ft::die "why3 deb download failed"
  local n=$(ls /tmp/why3debs/*.deb 2>/dev/null | wc -l)
  [ "$n" -gt 0 ] || ft::die "no debs downloaded"
  ft::note deb_closure "$n packages"
  mkdir -p /tmp/why3root
  local d
  for d in /tmp/why3debs/*.deb; do dpkg-deb -x "$d" /tmp/why3root; done
  cp -a /tmp/why3root/. "$FT_TOOL_DIR/"
  # Debian dependency closures contain host-directed absolute symlinks
  # (/etc/environment, /dev/null, /usr/share/*); they must NOT enter
  # portable tool archives. Remove links themselves, never their targets.
  local badlink abs_removed=0
  while IFS= read -r -d '' badlink; do
    [ -L "$badlink" ] || ft::die "Why3 unsafe-link preflight changed"
    rm -- "$badlink" || ft::die "Why3 unsafe absolute symlink could not be removed"
    abs_removed=$((abs_removed+1))
  done < <(find "$FT_TOOL_DIR" -type l -lname '/*' -print0)
  ft::note why3_absolute_symlinks_removed "$abs_removed"
  if [ -n "$(find "$FT_TOOL_DIR" -type l -lname '/*' -print -quit)" ]; then
    ft::die "Why3 absolute symlinks remain after pruning"
  fi
  [ -x "$FT_TOOL_DIR/usr/bin/why3" ] || ft::die "why3 binary missing after extraction"
  local share
  share=$(find "$FT_TOOL_DIR" -type d -name drivers | head -1 | xargs dirname)
  [ -n "$share" ] || ft::die "why3 drivers dir not found"
  ft::note why3_share_rel "${share#$FT_TOOL_DIR/}"
  # probe relocated
  ( export LD_LIBRARY_PATH="$FT_TOOL_DIR/usr/lib/x86_64-linux-gnu:$FT_TOOL_DIR/lib" \
      OCAMLLIB="$FT_TOOL_DIR/usr/lib/x86_64-linux-gnu/ocaml/5.3.0" \
      WHY3DATA="$FT_TOOL_DIR/share/why3"; "$FT_TOOL_DIR/usr/bin/why3" --version >/dev/null 2>&1 ) \
    || ft::die "why3 not runnable after relocation"
  ft::make_shim 'export LD_LIBRARY_PATH="$TOOL_DIR/usr/lib/x86_64-linux-gnu:$TOOL_DIR/lib:${LD_LIBRARY_PATH:-}"
export WHY3DATA="$TOOL_DIR/usr/share/why3"
# Debian trixie ocaml stdlib lives in the multiarch dir; why3 resolves why3/commands under it
export OCAMLLIB="$TOOL_DIR/usr/lib/x86_64-linux-gnu/ocaml/5.3.0:${OCAMLLIB:-}"
export PATH="$TOOL_DIR/usr/bin:$FT_ROOT/tools/z3/bin:$PATH"
# The Debian Why3 1.8.0 binary uses an absolute *compiled-in* OCaml
# command-plugin directory. Setting WHY3LIB alone does not relocate early
# command lookup. NEVER rm/mkdir/ln into host /usr, even when run as root.
export WHY3LIB="$TOOL_DIR/usr/lib/x86_64-linux-gnu/ocaml/5.3.0/why3"
case "${1:-}" in
  --version|--print-libdir|--print-datadir)
    exec "$TOOL_DIR/usr/bin/why3" "$@" ;;
  *)
    echo "WHY3_RELOCATION_NOT_QUALIFIED: proof commands require isolated root or relocatable build" >&2
    exit 2 ;;
esac'
}
