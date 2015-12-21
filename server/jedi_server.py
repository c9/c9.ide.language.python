#!/usr/bin/env python
import argparse
import jedi
import json
import sys
from BaseHTTPServer import BaseHTTPRequestHandler
import urlparse

def main(args):
    if args.mode != "daemon":
        print(run(sys.stdin.read(), args.__dict__))
        return

    jedi.preload_module('os', 'sys', 'math')
    from BaseHTTPServer import HTTPServer
    server = HTTPServer(('localhost', 7680), Daemon)
    print 'Starting daemon at :7680'
    server.serve_forever()

def run(source, args):
    print "run %s" % args
    script = jedi.Script(source, int(args.get("row")), int(args.get("column")), args.get("path"))
    try:
        mode = args.get("mode")
        if mode == 'completions':
            result = script.completions()
        elif mode == 'goto_definitions':
            result = script.goto_definitions()
        elif mode == 'goto_assignments':
            result = script.goto_assignments()
        elif mode == 'call_signatures':
            result = script.call_signatures()
        else:
            raise
    except:
        result = []
    return json.dumps(result, default=to_json)

class Daemon(BaseHTTPRequestHandler):
    def do_POST(self):
        query = urlparse.urlparse(self.path).query
        args = urlparse.parse_qsl(query)
        
        length = int(self.headers.getheader('content-length', 0))
        source = self.rfile.read(length)
        
        self.send_response(200)
        self.end_headers()
        self.wfile.write(run(source, dict(args)))

def to_json(c):
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

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Run jedi functions over a script provided via stdin')
    parser.add_argument('mode', help='Mode of operation', choices=['daemon', 'completions', 'goto_definitions', 'goto_assignments'])
    parser.add_argument('--row', type=int, help='The row to read from')
    parser.add_argument('--column', type=int, help='The column to read from')
    parser.add_argument('--path', type=int, help='The path of the script')

    args = parser.parse_args()
    main(args)