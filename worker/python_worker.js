define(function(require, exports, module) {

var baseHandler = require("plugins/c9.ide.language/base_handler");
var workerUtil = require("plugins/c9.ide.language/worker_util");
var jediComplete = require("text!./jedi_complete.py");
var jediJumpToDef = require("text!./jedi_jumptodef.py");

var handler = module.exports = Object.create(baseHandler);

handler.handlesLanguage = function(language) {
    return language === "python";
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
            pos.row,
            pos.column
        ],
        useStdin: true
    }, function onResult(err, stdout, stderr) {
        if (err) {
            console.warn("Warning: could not invoke python-jedi: ", err.message, stderr);
            return callback();
        }
        var result;
        try {
            result = JSON.parse(result);
        }
        catch (e) {
            return onResult(err);
        }
        
        callback(result);
    });
}

});