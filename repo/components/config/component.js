var fs = require('fs');
var configFilename = '../../config.json';
var oldConfig = require(configFilename);

module.exports = function() {

// 	this.init = function(config){
// console.log('....init....')
// 	}

	var ret = {};
	for(key in oldConfig) {
		ret[key] = oldConfig[key];
	}
    // this.init = function() {
		for(key in oldConfig) {
			process.emit('config.'+key+'.new', oldConfig[key])
		}
		fs.watchFile(configFilename, function (curr, prev) {
			oldConfig = require(configFilename);
			delete require.cache[require.resolve(configFilename)]
			var newConfig = require(configFilename);
			for(key in oldConfig) {
				if(!newConfig[key] && oldConfig[key]) {
					process.emit('config.'+key+'.remove')
				}
			}
			for(key in newConfig) {
				if(newConfig[key] && !oldConfig[key]) {
					process.emit('config.'+key+'.new', newConfig[key])
				} else {
					if(JSON.stringify(newConfig[key]) != JSON.stringify(oldConfig[key])) {
						process.emit('config.'+key+'.change', newConfig[key])
						process.emit('config.'+key+'.delta', {before:oldConfig[key], after:newConfig[key]})
					}
				}
			}
		});
		// process.emit('filewriter.config', {'filename':'test.txt'})
    // }
	return ret;
}

// process.on('config.a.change', function(data){
// 	console.log('a changed to', data)
// })

// process.on('config.c.new', function(data){
// 	console.log('c created', data)
// })

// process.on('config.c.remove', function(){
// 	console.log('c removed')
// })
