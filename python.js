/**
 * Cloud9 Python support
 *
 * @copyright 2015, Ajax.org B.V.
 */
define(function(require, exports, module) {
    main.consumes = ["Plugin", "language", "jsonalyzer"];
    main.provides = ["language.python"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var language = imports.language;
        var jsonalyzer = imports["jsonalyzer"];
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        plugin.on("load", function() {
            language.registerLanguageHandler("plugins/c9.ide.language.python/worker/python_worker");
            jsonalyzer.registerWorkerHandler("plugins/c9.ide.language.python/worker/python_jsonalyzer_worker");
            jsonalyzer.registerServerHandler("plugins/c9.ide.language.python/server/python_jsonalyzer_server_worker");
        });
        
        /** @ignore */
        register(null, {
            "language.python": plugin
        });
    }
});