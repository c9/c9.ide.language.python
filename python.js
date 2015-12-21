/**
 * Cloud9 Python support
 *
 * @copyright 2015, Ajax.org B.V.
 */
define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "language", "jsonalyzer", "settings",
        "preferences", "preferences.experimental"
    ];
    main.provides = ["language.python"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var language = imports.language;
        var jsonalyzer = imports["jsonalyzer"];
        var experimental = imports["preferences.experimental"];
        var prefs = imports.preferences;
        var settings = imports.settings;
        var plugin = new Plugin("Ajax.org", main.consumes);
        var jediServer = require("text!./server/jedi_server.py").replace(/ {4}/g, " ");
        
        var enabled = experimental.addExperiment("python_worker", false, "Language/Python Code Completion");
        
        plugin.on("load", function() {
            jsonalyzer.registerWorkerHandler("plugins/c9.ide.language.python/worker/python_jsonalyzer_worker");
            jsonalyzer.registerServerHandler("plugins/c9.ide.language.python/server/python_jsonalyzer_server_worker");
            
            prefs.add({
                "Project": {
                    "Language Support" : {
                        position: 800,
                        "Python Version" : {
                            position: 300,
                            type: "dropdown",
                            path: "project/python/@version",
                            items: [
                                { caption: "Python 2", value: "python2" },
                                { caption: "Python 3", value: "python3" },
                            ]
                        },
                    }
                }
            }, plugin);
            
            settings.on("read", function(e) {
                settings.setDefaults("project/python", [
                    ["version", "python2"]
                ]);
            });
            
            if (!enabled)
                return;
                
            settings.on("project/python", function(e) {
                language.getWorker(function(err, worker) {
                    if (err) return console.error(err);
                    var version = settings.get("project/python/@version");
                    worker.emit("set_python_version", { data: version });
                });
            });
            
            language.registerLanguageHandler("plugins/c9.ide.language.python/worker/python_worker", function(err, worker) {
                if (err) return console.error(err);
                var version = settings.get("project/python/@version");
                worker.emit("set_python_version", { data: version });
                worker.emit("set_python_server", { data: jediServer });
            });
        });
        
        /** @ignore */
        register(null, {
            "language.python": plugin
        });
    }
});