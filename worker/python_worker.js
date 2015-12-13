define(function(require, exports, module) {

var baseHandler = require("plugins/c9.ide.language/base_handler");
var workerUtil = require("plugins/c9.ide.language/worker_util");
var jediComplete = require("./jedi_complete.py.js");
var jediJumpToDef = require("./jedi_jumptodef.py.js");

var handler = module.exports = Object.create(baseHandler);

handler.handlesLanguage = function(language) {
    return language === "python";
};

handler.getCompletionRegex = function() {
    return (/^([\.]|\bimport )$/);
};

handler.complete = function(doc, fullAst, pos, currentNode, callback) {
    invoke(jediComplete, pos, function(err, results) {
        results && results.forEach(function(r) {
            r.isContextual = true;
            r.guessTooltip = true;
            r.priority = 3;
        });
        callback(err, results);
    });
};

// TODO: change all similar signature to this form?
handler.predictNextCompletion = function(doc, fullAst, pos, options, callback) {
    return options.predictedIdentifier + ".";
};

handler.jumpToDefinition = function(doc, fullAst, pos, currentNode, callback) {
    invoke(jediJumpToDef, pos, callback);
};

function invoke(tool, pos, callback) {
    workerUtil.execAnalysis("python", {
        args: [
            "-c",
            tool,
            String(pos.row + 1),
            String(pos.column),
        ]
    }, function onResult(err, stdout, stderr) {
        if (err) return done(err);
        
        var result;
        try {
            result = JSON.parse(stdout);
        }
        catch (err) {
            return done(new Error("Couldn't parse python-jedi output: " + stdout));
        }
        done(null, result);
        
        function done(err, result) {
            if (err) {
                console.warn("Warning: could not invoke python-jedi: ", err.message, stderr);
                return callback();
            }
            callback(err, result);
        }
    });
}

});