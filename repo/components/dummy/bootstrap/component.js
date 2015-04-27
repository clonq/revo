module.exports = function(){
    
    var _ = require('underscore');

    this.init = function(config) {
console.log('bootstrap:', config)    	
        var that = this;
        this.params = _.defaults(config||{}, defaults)
        setTimeout(function() { process.emit(that.params.emit, that.params.payload); }, that.params.delay);
    }

}

var defaults = module.exports.defaults = {
    emit: "bootstrap",
    delay: 100,//ms
    payload: {}
}
