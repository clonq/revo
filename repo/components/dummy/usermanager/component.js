module.exports = function(){
    
    var _ = require('underscore');

    this.init = function(config) {
        var that = this;
        this.params = _.defaults(config||{}, defaults)
        process.on('login', function(data){
        	console.log('login:', data);
        });
    }

}

var defaults = module.exports.defaults = {
	emit: 'dummy',//todo: this should not be mandatory
    models: ['user']
}
