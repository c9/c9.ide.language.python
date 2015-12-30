#!/usr/bin/env bash
# Helper script to launch jedi/pylint in a python2/3 virtualenv
set -e

PYTHON=$1
PYTHONPATH=$2
COMMAND=$3
export PYTHONPATH

SHAREDENV="/mnt/shared/lib/$PYTHON"
FALLBACKENV="$HOME/.c9/$PYTHON"

if [[ -d $SHAREDENV ]]; then
    ENV=$SHAREDENV
    source $ENV/bin/activate
    PYTHON="$ENV/bin/$PYTHON"
elif which virtualenv &>/dev/null; then
    ENV=$FALLBACKENV
    if ! [[ -d $ENV ]]; then
        virtualenv --python=$PYTHON $ENV
    fi

    source $ENV/bin/activate

    if ! python -c 'import jedi' &>/dev/null; then
        echo "Installing python support dependencies"
        pip install jedi >&2
        pip install pylint >&2
    fi

    PYTHON=$ENV/bin/$PYTHON
else
    echo 'Python support fatal error: virtualenv not installed'
    exit 1
fi

COMMAND=${COMMAND/\$PYTHON/$PYTHON}
COMMAND=${COMMAND/\$ENV/$ENV}
eval "$COMMAND"