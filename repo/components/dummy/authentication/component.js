module.exports = function(){
    
    var _ = require('underscore');

    this.init = function(config) {
        var that = this;
        this.params = _.defaults(config||{}, defaults)
        process.on('authenticate', function(data){
        	console.log('authenticating:', data);
            process.emit('success');
        });
    }

}

var defaults = module.exports.defaults = {
	emit: 'success',
    models: ['user']
}
