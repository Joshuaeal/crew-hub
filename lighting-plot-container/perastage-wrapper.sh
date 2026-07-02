#!/bin/bash
# Wrapper around Perastage. If /tmp/perastage-open-file exists, opens that file
# then removes the marker so subsequent restarts open the default project.
OPEN_FILE="/tmp/perastage-open-file"
if [ -f "$OPEN_FILE" ]; then
    FILE_PATH="$(cat "$OPEN_FILE")"
    rm -f "$OPEN_FILE"
    exec /opt/perastage/AppRun "$FILE_PATH"
else
    exec /opt/perastage/AppRun
fi
