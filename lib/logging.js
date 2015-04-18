var fs = require('fs')
  , _ = require('underscore')

module.exports = {

    msg: function(first, second) {
        console.log('   \x1b[36m',first,'\x1b[0m', (second != undefined) ? (': ' + second) : '');
    },

    info: function(message, indent) {
        indent = !isNaN(indent) ? indent : 0;
        console.log(_.times(indent, function(){ return ' ' }).join(''), message);
    },

    err: function(message, indent) {
        console.log(_.times(indent?indent:0, function(){ return ' ' }).join(''), '\x1b[35m',message,'\x1b[0m');
    }

}
