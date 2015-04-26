var fs = require ('fs');
var _ = require('underscore');

var rawConfigData;
var isConfigText = false;
var isConfigJson = false;
var cfg = {};
var configModule;

module.exports = {

    init: function() {
    	// console.log('Initializing container')
    },

    start: function(config) {

    	//todo: conditionally start web server based on config.platform.type

		var static = require('node-static');
		var fileServer = new static.Server('./public');
		require('http').createServer(function (request, response) {
		    request.addListener('end', function () {
		        fileServer.serve(request, response);
		    }).resume();
		}).listen(3000);

    	console.log('revo container started');
    	console.log('web server running on port 3000');

		// fs.watchFile(configFilename, function (curr, prev) {
		// }
		var configFilename = config ? config : 'components.txt';
		// look for config file
		if (fs.existsSync(configFilename)) {
			rawConfigData = fs.readFileSync(configFilename, 'utf8');
			isConfigText = true;
		// or config.json
		// } else if (fs.existsSync('config.json')) {

		} else {
			console.log('Application config file', configFilename, 'not found.')
			// console.log('To setup your application simply create a file named components.txt containing a list of component names separated by spaces.')
			// console.log('For example, a config.txt file with the following content: "twitter logger" prints tweets about revo in real time.\n')
			process.exit(0);
		}
		// parse config file
		if(isConfigText) {
			_.each(rawConfigData.split(' '), function(moduleName){
				cfg[moduleName] = {name: moduleName};
			})
		} else if(isConfigJson) {
			cfg = JSON.parse(rawConfigData);
		}
		// retrieve and install missing components
		// todo

		// load and instantiate components
		// if there is a config module available, load it first
		var configModulePath = __dirname+'/../components/config/component.js';
		if (fs.existsSync(configModulePath)) {
			var module = require(configModulePath);
			configModule = new module();
			console.log('config module loaded and initialized')
		}
		// load the other modules declared in config.txt
		for(moduleName in cfg) {
			if(moduleName.indexOf('!') == 0) {
				console.log('[', moduleName.substring(1), ']\t is disabled')		
			} else {
				var fullModulePath = __dirname+'/../components/' + moduleName + '/component.js';
				// don't load config module again if declared
				if(fullModulePath == configModulePath) {
					console.log('config module loaded by default, no need to declare it in the config file')
				} else {
					//todo: chnage this to use the new yml config
/*					
					if (fs.existsSync(fullModulePath)) {
						var module = require(fullModulePath);
						var m = new module();
						console.log('[', moduleName, ']\t loaded')		
						if(m.init) {
							m.init(configModule[moduleName]);
							console.log('[', moduleName, ']\t initialized')
							process.emit('revo:'+moduleName+':created', configModule[moduleName]);
						} else {
							console.log('[', moduleName, ']\t init function not found')		
						}
					} else {
						console.log('['+moduleName+']\t declared but not available')		
					}
*/					
				}
			}
		}

    }

}