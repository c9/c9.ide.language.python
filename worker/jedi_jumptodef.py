import jedi
import json
import sys

row = int(sys.argv[1])
column = int(sys.argv[2])
script = jedi.Script(sys.stdin.read(), row, column, "name.py")

def to_json(d):
    return {
        "path": d.module_path,
        "line": d.line,
        "column": d.column,
    }

print json.dumps(script.goto_definitions(), default = to_json)