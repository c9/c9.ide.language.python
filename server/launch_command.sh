#!/usr/bin/env bash
# Helper script to launch jedi/pylint in a python2/3 virtualenv
set -e

PYTHON=$1
COMMAND=$2

SHAREDENV="/mnt/shared/lib/$PYTHON"
FALLBACKENV="$HOME/.c9/$PYTHON"

if [[ -d $SHAREDENV ]]; then
    source $SHAREDENV/bin/activate
    PYTHON="$SHAREDENV/bin/$PYTHON"
elif which virtualenv &>/dev/null; then
    if ! [[ -d $FALLBACKENV ]]; then
        virtualenv --python=$PYTHON $FALLBACKENV
    fi

    source $FALLBACKENV/bin/activate

    if ! python -c 'import jedi' &>/dev/null; then
        pip install jedi >&2
    fi

    PYTHON=$FALLBACKENV/bin/$PYTHON
else
    echo 'Unable to run python script: virtualenv not installed'
    exit 1
fi

eval "${COMMAND/python/$PYTHON}"