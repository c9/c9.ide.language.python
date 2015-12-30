/**
 * jsonalyzer Python code completion
 *
 * @copyright 2015, Ajax.org B.V.
 * @author Lennart Kats <lennart add c9.io>
 */
define(function(require, exports, module) {

var baseHandler = require("plugins/c9.ide.language/base_handler");
var workerUtil = require("plugins/c9.ide.language/worker_util");

var KEYWORD_REGEX = new RegExp(
    "^(and|as|assert|break|class|continue|def|del|elif|else|except|exec|"
    + "finally|for|from|global|if|import|in|is|lambda|not|or|pass|print|"
    + "raise|return|try|while|with|yield)$"
);
var DAEMON_PORT = 10880;
var ERROR_PORT_IN_USE = 98;
var ERROR_NO_SERVER = 7;

var handler = module.exports = Object.create(baseHandler);
var pythonVersion = "python2";
var pythonPath = "";
var jediServer;
var launchCommand;
var showedJediError;
var daemon;

handler.handlesLanguage = function(language) {
    return language === "python";
};

handler.init = function(callback) {
    var emitter = handler.sender;
    emitter.on("set_python_config", function(e) {
        pythonVersion = e.data.pythonVersion;
        pythonPath = e.data.pythonPath;
        if (daemon) {
            daemon.kill();
            daemon = null;
        }
    });
    emitter.on("set_python_scripts", function(e) {
        jediServer = e.data.jediServer;
        launchCommand = e.data.launchCommand;
    });
    callback();
};

handler.getCompletionRegex = function() {
    return (/^([\.]|\bimport )$/);
};

/**
 * Complete code at the current cursor position.
 */
handler.complete = function(doc, fullAst, pos, currentNode, callback) {
    callDaemon("completions", handler.path, doc, pos, function(err, results, meta) {
        if (err) return callback(err);
        
        results && results.forEach(function beautifyCompletion(r) {
            r.isContextual = true;
            r.guessTooltip = true;
            r.priority = r.name[0] === "_" ? 3 : 4;
            r.icon = r.icon || "property";
            r.icon = r.name[0] === "_" ? r.icon.replace(/2?$/, "2") : r.icon;
            if (!r.doc)
                return;
            var docLines = r.doc.split(/\r\n|\n|\r/);
            var docBody = docLines.slice(2).join("\n");
            r.docHeadHtml = workerUtil.filterDocumentation(docLines[0]);
            r.doc = workerUtil.filterDocumentation(docBody.replace(/``/g, "'"));
        });
        callback(null, results);
    });
};

/**
 * Jump to the definition of what's under the cursor.
 */
handler.jumpToDefinition = function(doc, fullAst, pos, currentNode, callback) {
    callDaemon("goto_definitions", handler.path, doc, pos, callback);
};

/**
 * Predict how to complete code next. Did the user just type 'mat'?
 * Then we probably only have a completion 'math'. So we can predict
 * that the user may type 'math.' next and precompute completions.
 */
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
    callback(null, {
        predicted: predicted[0].replaceText + ".",
        showEarly: predicted[0].replaceText === "self" || predicted[0].icon === "package"
    });
};

/**
 * Invoke a function on our jedi python daemon. It runs as an HTTP daemon
 * so we use curl to send a request.
 */
function callDaemon(command, path, doc, pos, callback) {
    var line = doc.getLine(pos.row);
    ensureDaemon(function(err, dontRetry) {
        if (err) return callback(err);
        
        var start = Date.now();
        workerUtil.execAnalysis(
            "curl",
            {
                mode: "stdin",
                json: true,
                args: [
                    "-s", "--data-binary", "@-", // get input from stdin
                    "localhost:" + DAEMON_PORT + "?mode=" + command
                    + "&row=" + (pos.row + 1) + "&column=" + pos.column
                    + "&path=" + path.replace(/^\//, ""),
                ],
            },
            function onResult(err, stdout, stderr, meta) {
                if (err) {
                    if (err.code === ERROR_NO_SERVER && !dontRetry) {
                        daemon = null;
                        return callDaemon(command, path, doc, pos, callback);
                    }
                    return callback(err);
                }
                
                if (typeof stdout !== "object")
                    return callback(new Error("Couldn't parse python-jedi output: " + stdout));
                
                console.log("[python_worker] " + command + " in " + (Date.now() - start)
                    + "ms (jedi: " + meta.serverTime + "ms, transferred: " + meta.size + "b): "
                    + line.substr(0, pos.column));

                callback(null, stdout, meta);
            }
        );
    });
}

/**
 * Make sure we're running a jedi daemon (../server/jedi_server.py).
 * It listens on a port in the workspace container or host.
 */
function ensureDaemon(callback) {
    if (daemon)
        return done(daemon.err);

    daemon = {
        err: new Error("Still starting daemon, enhance your calm"),
        kill: function() {
            this.killed = true;
        }
    };
    
    workerUtil.spawn(
        "bash",
        {
            args: [
                "-c", launchCommand, "--", pythonVersion, pythonPath,
                "$PYTHON -c '" + jediServer + "' daemon --port " + DAEMON_PORT
            ],
        },
        function(err, child) {
            var output = "";
            if (err) {
                daemon.err = err;
                return workerUtil.showError("Could not start python completion daemon. Please reload to try again.");
            }
            daemon = child;
            daemon.err = null;
            
            if (daemon.killed)
                daemon.kill();
            
            // We (re)start the daemon after 10 minutes to conserve memory
            var killTimer = setTimeout(daemon.kill.bind(daemon), 10 * 60 * 1000);
            
            child.stderr.on("data", function(data) {
                output += data;
                if (/Daemon listening/.test(data))
                    done();
            });
            child.on("exit", function(code) {
                if (code === ERROR_PORT_IN_USE) // someone else running daemon?
                    return done(null, true);
                if (!code || /Daemon listening/.test(output)) // everything ok, try again later
                    daemon = null;
                clearTimeout(killTimer);
                done(code && new Error("[python_worker] Daemon failed: " + output));
            });
        }
    );
    
    function done(err) {
        if (err && /No module named jedi/.test(err.message) && !showedJediError) {
            workerUtil.showError("Jedi not found. Please run 'pip install jedi' or 'sudo pip install jedi' to enable Python code completion.");
            showedJediError = true;
        }
        callback && callback(err);
        callback = null;
    }
}

});