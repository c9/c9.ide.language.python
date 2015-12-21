define(function(require, exports, module) {

var baseHandler = require("plugins/c9.ide.language/base_handler");
var workerUtil = require("plugins/c9.ide.language/worker_util");

var KEYWORD_REGEX = new RegExp(
    "^(and|as|assert|break|class|continue|def|del|elif|else|except|exec|"
    + "finally|for|from|global|if|import|in|is|lambda|not|or|pass|print|"
    + "raise|return|try|while|with|yield)$"
);
var DAEMON_PORT = 7680;
var ERROR_PORT_IN_USE = 98;

var handler = module.exports = Object.create(baseHandler);
var pythonVersion = "python2";
var jediServer;
var showedJediError;
var daemon;

handler.init = function(callback) {
    handler.sender.on("set_python_version", function(e) {
        pythonVersion = e.data;
        if (daemon) {
            daemon.kill();
            daemon = null;
        }
    });
    handler.sender.on("set_python_server", function(e) {
        jediServer = e.data;
    });
    callback();
};

handler.handlesLanguage = function(language) {
    return language === "python";
};

handler.getCompletionRegex = function() {
    return (/^([\.]|\bimport )$/);
};

handler.complete = function(doc, fullAst, pos, currentNode, callback) {
    var start = Date.now();
    var line = doc.getLine(pos.row);
    callDaemon("completions", handler.path, pos, function(err, results) {
        if (err) return callback(err);
        
        results && results.forEach(function(r) {
            r.isContextual = true;
            r.guessTooltip = true;
            r.priority = r.name[0] === "_" ? 3 : 4;
            r.icon = r.name[0] === "_" ? r.icon.replace(/2?$/, "2") : r.icon;
            if (!r.doc)
                return;
            var docLines = r.doc.split(/\r\n|\n|\r/);
            var docBody = docLines.slice(2).join("\n");
            r.docHeadHtml = workerUtil.filterDocumentation(docLines[0]);
            r.doc = workerUtil.filterDocumentation(docBody.replace(/``/g, "'"));
        });
        console.log("[python_worker] Completed in " + (Date.now() - start) + "ms: " + line.substr(0, pos.column));
        callback(null, results);
    });
};

handler.predictNextCompletion = function(doc, fullAst, pos, options, callback) {
    var predicted = options.matches.filter(function(m) {
        return m.isContextual
            && m.icon !== "method"
            && !m.replaceText.match(KEYWORD_REGEX);
    });
    var line = doc.getLine(pos.row);
    if (predicted.length === 0 && "import".substr(0, line.length) === line)
        return callback("import ");
    if (predicted.length !== 1)
        return callback();
    if (/^\s+import /.test(line))
        return callback();
    console.log("[python_worker] Predicted our next completion will be for " + predicted[0].replaceText + ".");
    callback(null, { predicted: predicted[0].replaceText + "." });
};

handler.jumpToDefinition = function(doc, fullAst, pos, currentNode, callback) {
    callDaemon("goto_definitions", handler.path, pos, callback);
};

function ensureDaemon(callback) {
    if (daemon)
        return done(daemon.err);

    daemon = {
        err: new Error("Starting daemon"),
        kill: function() {
            this.killed = true;
        }
    };
    
    workerUtil.spawn(
        pythonVersion,
        { args: ["-c", jediServer, "daemon", "--port", DAEMON_PORT] },
        function(err, child) {
            var output = "";
            if (err)
                workerUtil.showError("Could not start python completion daemon. Please reload to try again.");
            if (child && daemon.killed)
                child.kill();
            daemon = child || daemon;
            daemon.err = err;
            child.stderr.on("data", function(data) {
                if (/Daemon listening/.test(data))
                    done();
                output += data;
            });
            child.on("exit", function(code) {
                if (code === ERROR_PORT_IN_USE)
                    return done();
                done(code && new Error("Command failed: " + output));
                if (!code || /Daemon listening/.test(output))
                    daemon = null;
            });
        }
    );
    
    function done(err) {
        callback && callback(err);
        callback = null;
    }
}

function callDaemon(command, path, pos, callback) {
    ensureDaemon(function(err) {
        if (err) return callback(err);
        
        workerUtil.execAnalysis(
            "curl",
            {
                mode: "stdin",
                args: [
                    "-s",
                    "--data-binary", "@-", // get input from stdin
                    "localhost:" + DAEMON_PORT + "?mode=" + command
                    + "&row=" + (pos.row + 1)
                    + "&column=" + pos.column
                    + "&path=",
                    
                ]
            },
            function onResult(err, stdout, stderr) {
                if (err) {
                    if (!showedJediError && /No module named jedi/.test(err.message)) {
                        workerUtil.showError("Jedi not found. Please run 'pip install jedi' or 'sudo pip install jedi' to enable Python code completion.");
                        showedJediError = true;
                    }
                    return done(err);
                }
                
                var result;
                try {
                    result = JSON.parse(stdout);
                }
                catch (err) {
                    return done(new Error("Couldn't parse python-jedi output: " + stdout));
                }
                done(null, result);
                
                function done(err, result) {
                    callback(err, result);
                }
            }
        );
    });
}

});