module.exports = function(){
	var _ = require('underscore');
	this.init = function(config) {
		var self = this;
		this.params = _.defaults(config||{}, defaults)
		process.on('web:load', function(pin){
			console.log('web:load >', pin);
		});
	}
}

var defaults = module.exports.defaults = {
}
