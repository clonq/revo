var debug = require('debug')('revo:models:component');

function component(opts){
    var self = this;
    this.name = opts.name;
    this.scripts = function() {
    	var fake = {name:'main.js'}
    	var ret = [fake];
    	return ret;
    }
	return self;
}

function parse(definition) {
	debug('parsing', definition);
	var opts = {
		name: Object.keys(definition)[0]
	};
	return new component(opts);
}

module.exports = component;
module.exports.parse = parse;

