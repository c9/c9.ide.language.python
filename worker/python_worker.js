define(function(require, exports, module) {

var baseHandler = require("plugins/c9.ide.language/base_handler");
var workerUtil = require("plugins/c9.ide.language/worker_util");
var jediComplete = require("./jedi_complete.py.js").replace(/ {4}/g, " ");
var jediJumpToDef = require("./jedi_jumptodef.py.js").replace(/ {4}/g, " ");

var KEYWORD_REGEX = new RegExp(
    "^(and|as|assert|break|class|continue|def|del|elif|else|except|exec|"
    + "finally|for|from|global|if|import|in|is|lambda|not|or|pass|print|"
    + "raise|return|try|while|with|yield)$"
);

var handler = module.exports = Object.create(baseHandler);


handler.handlesLanguage = function(language) {
    return language === "python";
};

handler.getCompletionRegex = function() {
    return (/^([\.]|\bimport )$/);
};

handler.complete = function(doc, fullAst, pos, currentNode, callback) {
    var start = Date.now();
    var line = doc.getLine(pos.row);
    invoke(jediComplete, pos, function(err, results) {
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
        callback(err, results);
    });
};

handler.predictNextCompletion = function(doc, fullAst, pos, options, callback) {
    var predicted = options.matches.filter(function(m) {
        return m.isContextual
            && m.icon !== "method"
            && !m.replaceText.match(KEYWORD_REGEX);
    });
    if (predicted.length !== 1)
        return callback();
    console.log("[python_worker] Predicted our next completion will be for " + predicted[0].replaceText + ".");
    callback(null, { predicted: predicted[0].replaceText + "." });
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
                console.warn("[python_worker] Warning: could not invoke python-jedi: ", err.message, stderr);
                return callback();
            }
            callback(err, result);
        }
    });
}

});