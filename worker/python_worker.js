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
    invoke(jediComplete, pos, callback);
};

handler.jumpToDefinition = function(doc, fullAst, pos, currentNode, callback) {
    invoke(jediJumpToDef, pos, callback);
};

function invoke(tool, pos, callback) {
    workerUtil.execAnalysis("python", {
        args: [
            "-c",
            tool,
            String(pos.row),
            String(pos.column),
        ],
        useStdin: true
    }, function onResult(err, stdout, stderr) {
        if (err) return done(err);
        
        var result;
        try {
            result = JSON.parse(result);
        }
        catch (err) {
            return done(err);
        }
        done(result);
        
        function done(err, result) {
            if (err) {
                console.warn("Warning: could not invoke python-jedi: ", err.message, stderr);
                return callback();
            }
            callback(result);
        }
    });
}

});