#!/usr/bin/env python
import argparse
import jedi
import json
import sys

def to_json(c, template):
    try:
        paramList = { p.description for p in c.params }
        params = ", ".join([p for p in paramList if p != None])
    except:
        params = ""

    return remove_nulls({
        "name": c.name + ("(" + params + ")" if c.type == "function" else ""),
        "replaceText": c.name + ("(^^)" if c.type == "function" else ""),
        "row": (c.line if c.line else None),
        "column": (c.column if c.column else None),
        "module_path": (c.module_path if c.module_path else None),
        "in_builtin_module": c.in_builtin_module(),
        "doc": c.type != "module" and # module docs dont work
            c.name + ":" + abbrev(c.docstring()),
        "icon": {
            "function": "method",
            "module": "package",
            "class": "property",
            "instance": "property"
        }.get(c.type, "property"),
    })

def remove_nulls(d):
    for key, value in d.items():
        if value is None:
            del d[key]
        elif isinstance(value, dict):
            remove_nulls(value)
    return d

def abbrev(s):
    return s if len(s) < 2500 else s[:2500] + "..."

def main(args):
    script = jedi.Script(sys.stdin.read(), args.row, args.column)
    try:
        if args.function == 'completions':
            data = script.completions()
        if args.function == 'goto_definitions':
            data = script.goto_definitions()
        if args.function == 'goto_assignments':
            data = script.goto_assignments()
        if args.function == 'call_signatures':
            data = script.call_signatures()
    except:
        data = []
    print(json.dumps(data, default=to_json))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Run jedi functions over a script provided via stdin')
    parser.add_argument('function', help='Which jedi function you want to call', choices=['completions', 'goto_definitions', 'goto_assignments'])
    parser.add_argument('row', type=int, help='The row to read from')
    parser.add_argument('column', type=int, help='The column to read from')

    args = parser.parse_args()
    main(args)
