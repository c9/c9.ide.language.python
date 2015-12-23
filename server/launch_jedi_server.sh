#!/bin/bash
VERSION=$(basename $0 | grep -o '[23]')
VERSION=${VERSION:-2}
set -e

SHAREDENV="/mnt/shared/lib/python$VERSION"
FALLBACKENV="$HOME/.c9/python$VERSION"

if [[ -d $SHAREDENV ]]; then
    source $SHAREDENV/bin/activate
    PYTHON="$SHAREDENV/bin/python$VERSION"
    JEDI="jediServer"
elif which virtualenv &>/dev/null; then
    if ! [[ -d $FALLBACKENV ]]; then
        virtualenv --python=python$VERSION $FALLBACKENV
    fi

    source $FALLBACKENV/bin/activate

    if ! python -c 'import jedi' &>/dev/null; then
        pip install jedi 1>&2
    fi

    JEDI=jediServer
    PYTHON=$FALLBACKENV/bin/python$VERSION
else
    echo 'Unable to find jedi!'
    exit 1
fi

$PYTHON $JEDI "$@"