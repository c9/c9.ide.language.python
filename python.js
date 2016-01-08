/**
 * Cloud9 Python support
 *
 * @copyright 2015, Ajax.org B.V.
 */
define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "language", "jsonalyzer", "settings",
        "preferences", "preferences.experimental", "c9"
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
        var c9 = imports.c9;
        var plugin = new Plugin("Ajax.org", main.consumes);
        var jediServer = require("text!./server/jedi_server.py").replace(/ {4}/g, " ");
        var launchCommand = require("text!./server/launch_command.sh").replace(/ +/g, " ");
        
        var enabled = experimental.addExperiment("python_worker", false, "Language/Python Code Completion");
        
        plugin.on("load", function() {
            jsonalyzer.registerWorkerHandler("plugins/c9.ide.language.python/worker/python_jsonalyzer");
            
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
                        "Pylint command-line options" : {
                            position: 310,
                            type: "textbox",
                            path: "project/python/@pylintFlags",
                        },
                        "PYTHONPATH" : {
                            position: 320,
                            type: "textbox",
                            path: "project/python/@path",
                        }
                    }
                }
            }, plugin);
            
            settings.on("read", function(e) {
                settings.setDefaults("project/python", [
                    ["version", "python2"],
                    ["path", options.pythonPath || "/usr/local/lib/python2.7/dist-packages:/usr/local/lib/python3.4/dist-packages"]
                ]);
            }, plugin);
            
            language.registerLanguageHandler("plugins/c9.ide.language.python/worker/python_linter", function(err, handler) {
                if (err) return console.error(err);
                setupHandler(handler);
            });
            
            if (!enabled)
                return;
            
            language.registerLanguageHandler("plugins/c9.ide.language.python/worker/python_completer", function(err, handler) {
                if (err) return console.error(err);
                setupHandler(handler);
            });
        });
            
        function setupHandler(handler) {
            handler.emit("set_python_scripts", { jediServer: jediServer, launchCommand: launchCommand, ssh: c9.ssh });
            settings.on("project/python", sendSettings.bind(null, handler), plugin);
            sendSettings(handler);
        }
        
        function sendSettings(handler) {
            handler.emit("set_python_config", {
                pythonVersion: settings.get("project/python/@version"),
                pythonPath: settings.get("project/python/@path"),
                pylintFlags: settings.get("project/python/@pylintFlags"),
            });
        }
        
        plugin.on("unload", function() {
            jsonalyzer.unregisterWorkerHandler("plugins/c9.ide.language.python/worker/python_jsonalyzer");
            language.unregisterLanguageHandler("plugins/c9.ide.language.python/worker/python_completer");
            language.unregisterLanguageHandler("plugins/c9.ide.language.python/worker/python_linter");
        });
        
        /** @ignore */
        register(null, {
            "language.python": plugin
        });
    }
});