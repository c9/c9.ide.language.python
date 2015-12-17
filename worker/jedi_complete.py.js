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
def to_json(c):\n\
    try:\n\
      paramList = { p.description for p in c.params }\n\
      params = ", ".join([p for p in paramList if p != None])\n\
    except:\n\
      params = ""\n\
    return {\n\
        "name": c.name + ("(" + params + ")" if c.type == "function" else ""),\n\
        "replaceText": c.name + ("(^^)" if c.type == "function" else ""),\n\
        "doc": abbrev(c.docstring()),\n\
        "icon": {\n\
            "function": "method",\n\
            "module": "package",\n\
            "class": "property",\n\
            "instance": "property"\n\
        }.get(c.type, "property"),\n\
    }\n\
\n\
def abbrev(s):\n\
    return s if len(s) < 2500 else s[:2500] + "..."\n\
\n\
print json.dumps(script.completions(), default = to_json)\n\
';
});