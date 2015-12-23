/**
 * jsonalyzer Python code completion
 *
 * @copyright 2015, Ajax.org B.V.
 * @author Lennart Kats <lennart add c9.io>
 */
define(function(require, exports, module) {

var baseHandler = require("plugins/c9.ide.language/base_handler");
var workerUtil = require("plugins/c9.ide.language/worker_util");

var handler = module.exports = Object.create(baseHandler);
var pythonVersion = "python2";
var launchCommand;
var ssh;
var daemon;
var PYLINT_OPTIONS = [
    "-d", "all",
    "-e", "E", 
    "-e", "F", 
    "-e", "W0101", // Unreachable code
    "-e", "W0109", // Duplicate key in dictionary
    "-e", "W0199", // Assert called on a 2-tuple. Did you mean \'assert x,y\'?
    "-e", "W0612", // Unused variable
    "-e", "W0602", // Used global without assignment
    "-r", "n", 
    "--msg-template={line}:{column}:\\ [{msg_id}]\\ {msg}"
];

handler.handlesLanguage = function(language) {
    return language === "python";
};

handler.init = function(callback) {
    handler.sender.on("set_python_version", function(e) {
        pythonVersion = e.data;
        if (daemon) {
            daemon.kill();
            daemon = null;
        }
    });
    handler.sender.on("set_python_scripts", function(e) {
        launchCommand = e.data.launchCommand;
        ssh = e.data.ssh;
    });
    callback();
};

handler.analyze = function(docValue, fullAst, callback) {
    // Get a copy of pylint. For ssh workspaces we need to use a helper script,
    // in other cases we have the "pylint2" and "pylint3" commands.
    var commands = ssh
        ? ["-c", launchCommand, "--", pythonVersion, "$ENV/bin/pylint"]
        : ["-c", pythonVersion === "python2" ? "pylint2" : "pylint3"];
    commands[commands.length - 1] += " " + PYLINT_OPTIONS.join(" ") + " $FILE";

    // TODO: optimize - use a pylint daemon?
    var starImport = /from\s+[^\s]+\s+import\s+\*/.test(docValue);
    var markers = [];
    workerUtil.execAnalysis(
        "bash",
        {
            mode: "tempfile",
            args: commands,
            cwd: handler.path.replace(/^\//, "").replace(/[\/\\][^\/\\]+$/, ""),
            maxCallInterval: 1200,
        },
        function(err, stdout, stderr) {
            if (err) return callback(err);

            stdout.split("\n").forEach(function(line) {
                var match = line.match(/(\d+):(\d+): \[([^\]]+)\] (.*)/);
                if (!match)
                    return;
                var row = match[1];
                var column = match[2];
                var code = match[3];
                var message = match[4];
                var level = getLevel(code);
                
                if (/print statement used/.test(message))
                    return;
                if (starImport && /undefined variable/i.test(message)) {
                    level = "info";
                    message += "?";
                }
                    
                markers.push({
                    pos: {
                        sl: parseInt(row, 10) - 1,
                        sc: parseInt(column, 10)
                    },
                    message: message,
                    code: code,
                    level: level
                });
            });
            
            callback(null, markers);
        }
    );
};

function getLevel(code) {
    if (code[0] === "E" || code[0] === "F")
        return "error";
    if (code === "W0612") // unused variable
        return "info";
    if (code === "W0602") // global without assignment
        return "info";
    return "warning";
}

});