var debug = require('debug')('revo:models:component');

function component(opts){
    var self = this;
    this.opts = opts;
    this.name = opts.name;
    this.type = opts.type;
	return self;
}

function parse(definition) {
	// debug('parsing', definition);
    var name = Object.keys(definition)[0];
    var opts = definition[name] || {};
	opts.name = name;
	opts.safename = name.replace('\/', '_');
    opts.type = definition[name].type || 'common';
	return new component(opts);
}

module.exports = component;
module.exports.parse = parse;

