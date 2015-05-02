var debug = require('debug')('revo:models:webComponent');

function webComponent(opts){
    var self = this;
    this.name = opts.name;
    this.type = opts.type;
    this.scripts = function() {
    	var fake = {name:'main.js'}
    	var ret = [fake];
    	return ret;
    }
	return self;
}

function parse(definition) {
	debug('parsing', definition);
    var name = Object.keys(definition)[0];
    var opts = {
        name: name,
        type: definition[name].type || 'common'
    };
	return new webComponent(opts);
}

module.exports = webComponent;
module.exports.parse = parse;

