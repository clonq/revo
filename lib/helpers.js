var _ = require('underscore')
  , callingModulePath = module.parent.filename.substring(0, module.parent.filename.lastIndexOf('/'))
  , moduleName = callingModulePath.substring(callingModulePath.lastIndexOf('/')+1);
//  ^ this doesn't work

module.exports = {

    log: {
        info: function() {
            var message = '';
            for(var key in Object.keys(arguments)) { message = message + ' ' + arguments[key]; }
            console.log('[', moduleName, ']\t', message);
        }
        // msg: function(first, second) {
        //     console.log('   \x1b[36m',first,'\x1b[0m', (second != undefined) ? (': ' + second) : '');
        // },

        // nfo: function(message, indent) {
        //     indent = !isNaN(indent) ? indent : 0;
        //     console.log(_.times(indent, function(){ return ' ' }).join(''), message);
        // },

        // err: function(message, indent) {
        //     console.log(_.times(indent?indent:0, function(){ return ' ' }).join(''), '\x1b[35m',message,'\x1b[0m');
        // }
    },

    error: function(message) {
        console.log('[', moduleName, ']\t\x1b[31m', message, '\x1b[0m');
        process.emit(moduleName+':error', message);
    }

}