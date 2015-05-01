module.exports = function(){
    
    var _ = require('underscore');
    var EventEmitter2 = require('eventemitter2').EventEmitter2,
	ee = new EventEmitter2({
		wildcard: true
	});

    this.init = function(config) {
        var that = this;
        this.params = _.defaults(config||{}, defaults)
        setTimeout(function() { ee.emit(that.params.emit, that.params.payload); }, that.params.delay);
    }

}

var defaults = module.exports.defaults = {
    emit: "bootstrap",
    delay: 100,//ms
    payload: {}
}
