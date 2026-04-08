#!/usr/bin/env bash
set -euo pipefail

Extension_UUID="pop-shell@system76.com"
NESTED_DISPLAY="wayland-nested-$RANDOM"
WORKDIR="$(pwd)"
EXT_SRC="$WORKDIR/_build"
DUMMY_MONITORS="${DUMMY_MONITORS:-1}"
DUMMY_MODE_SPECS="${DUMMY_MODE_SPECS:-1920x1080@60}"

if ! [[ "$DUMMY_MONITORS" =~ ^[0-9]+$ ]] || (( DUMMY_MONITORS < 1 )); then
  echo "DUMMY_MONITORS must be a positive integer." >&2
  exit 1
fi

if [[ ! -d "$EXT_SRC" ]]; then
  echo "Missing $EXT_SRC (build the extension first)." >&2
  exit 1
fi

if [[ -z "${WAYLAND_DISPLAY:-}" && -z "${DISPLAY:-}" ]]; then
  echo "No parent display detected. Run this from an existing graphical session." >&2
  exit 1
fi

TMP_ROOT="$(mktemp -d)"
cleanup() { rm -rf "$TMP_ROOT"; }
trap cleanup EXIT

export XDG_DATA_HOME="$TMP_ROOT/data"
export XDG_CONFIG_HOME="$TMP_ROOT/config"
mkdir -p "$XDG_DATA_HOME/gnome-shell/extensions"
ln -s "$EXT_SRC" "$XDG_DATA_HOME/gnome-shell/extensions/$Extension_UUID"

dbus-run-session -- bash -euxc "
  set -o pipefail

  export GNOME_SHELL_EXTENSIONS_PATH='$XDG_DATA_HOME/gnome-shell/extensions'

  export MUTTER_DEBUG_DUMMY_MODE_SPECS='$DUMMY_MODE_SPECS'
  export MUTTER_DEBUG_NUM_DUMMY_MONITORS='$DUMMY_MONITORS'
  export SHELL_DEBUG=all
  unset XDG_SESSION_ID

  echo \"Nested shell dummy monitors requested: \$MUTTER_DEBUG_NUM_DUMMY_MONITORS (\$MUTTER_DEBUG_DUMMY_MODE_SPECS)\"
  echo \"Note: gnome-shell --devkit may still expose only one visible monitor in nested mode.\"

  # Keep parent WAYLAND_DISPLAY intact so nested shell can connect to host compositor.
  # --wayland-display sets only the socket name exposed by the nested shell.
  gnome-shell --devkit --wayland-display='$NESTED_DISPLAY' &
  SHELL_PID=\$!

  eval_shell() {
    gdbus call --session \
      --dest org.gnome.Shell \
      --object-path /org/gnome/Shell \
      --method org.gnome.Shell.Eval \"\$1\"
  }

  # A) Wait for org.gnome.Shell bus name (max ~20s)
  ok=0
  for i in \$(seq 1 100); do
    if gdbus call --session \
         --dest org.freedesktop.DBus \
         --object-path /org/freedesktop/DBus \
         --method org.freedesktop.DBus.NameHasOwner \
         org.gnome.Shell 2>/dev/null | grep -q true; then
      ok=1
      break
    fi
    sleep 0.2
  done
  [ \$ok -eq 1 ] || { echo 'Timed out waiting for org.gnome.Shell name owner' >&2; kill \$SHELL_PID; exit 1; }

  # B) Wait for Eval to work (max ~20s)
  ok=0
  for i in \$(seq 1 100); do
    if eval_shell '\"\"' >/dev/null 2>&1; then
      ok=1
      break
    fi
    sleep 0.2
  done
  [ \$ok -eq 1 ] || { echo 'Timed out waiting for org.gnome.Shell.Eval' >&2; kill \$SHELL_PID; exit 1; }

  # Optional: small settle time
  sleep 1

  # Optional: disable everything else, then enable only Pop Shell
  #gnome-extensions disable --all || true
  gnome-extensions enable '$Extension_UUID'

  wait \$SHELL_PID
"
