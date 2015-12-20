define(function(require, exports, module) {
module.exports = '\n\
import jedi\n\
import json\n\
import sys\n\
\n\
row = int(sys.argv[1])\n\
column = int(sys.argv[2])\n\
script = jedi.Script(sys.stdin.read(), row, column, "name.py")\n\
\n\
def to_json(d):\n\
    return {\n\
        "description": d.description,\n\
        "line": d.line,\n\
        "column": d.column,\n\
    }\n\
\n\
print(json.dumps(script.call_signatures(), default = to_json))\n\
';
});