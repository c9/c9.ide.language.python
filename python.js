/**
 * Cloud9 python support
 *
 * @copyright 2015, Ajax.org B.V.
 */
define(function(require, exports, module) {
    main.consumes = ["language.python"];
    main.provides = [];
    return main;

    function main(options, imports, register) {
        var language = imports.language;

        language.registerLanguageHandler("plugins/c9.ide.language.python/worker/python_worker");
        
        register(null, {});
    }
});