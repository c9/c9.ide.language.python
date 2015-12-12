import jedi
import json
import sys

row = int(sys.argv[1])
column = int(sys.argv[2])
script = jedi.Script(sys.stdin.read(), row, column, "name.py")

def to_json(c):
    return {
        "name": c.name + ("()" if c.type == "function" else ""),
        "replaceText": c.name + ("(^^)" if c.type == "function" else ""),
        "doc": abbrev(c.docstring()),
        "icon": {
            "function": "method",
            "module": "package",
            "class": "property",
            "instance": "property"
        }.get(c.type, "property"),                                                         
    }

def abbrev(s):
    return s if len(s) < 2500 else s[:2500] + "..."

print json.dumps(script.completions(), default = to_json)