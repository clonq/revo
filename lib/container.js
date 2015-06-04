var debug = require('debug')('revo:container'),
	fs = require ('fs'),
	_ = require('underscore'),
    chalk = require('chalk'),
    yaml = require('js-yaml'),
	WebSocketServer = require('ws').Server;
    component = require('./models/component'),
	pkg = require('../package.json');
 //    EventEmitter2 = require('eventemitter2').EventEmitter2,
	// eventServer = new EventEmitter2({
	// 	verbose: true
	// });

const ERROR = chalk.red.bold;

var rawConfigData;
var isConfigText = false;
var isConfigJson = false;
var cfg = {};
var configModule;
var socketClient;
var modelHandlers = {}
var eventHandlers = {}
var config;

module.exports = {
    init: function() {
    	debug('Initializing components')
		config = yaml.safeLoad(fs.readFileSync('./config.yml', 'utf8'));
	    initializeComponents();
    },
    start: function() {
    	startWebServer();
		startWebsocketServer();
	    loadConfig();
    }
}

function startWebServer() {
	debug('starting revo container');
	//todo: conditionally start web server based on config.platform.type
	var static = require('node-static');
	var fileServer = new static.Server('./public');
	require('http').createServer(function (request, response) {
// debug('========================')		
// debug(request.body)		
// debug('========================')		
	    request.addListener('end', function () {
	        fileServer.serve(request, response);
	    }).resume();
	}).listen(3000);
	debug('web server running on port 3000');
}

function startWebsocketServer() {
	var wss = new WebSocketServer({ port: 3001 });
	debug('websocket server running on port 3001');
	wss.on('error', function(){
		debug('socket client error')
		socketClient = undefined;
	});
	wss.on('close', function(){
		debug('socket client closed')
		socketClient = undefined;
	});
	wss.on('connection', function connection(ws) {
		debug('socket client connected')
		socketClient = ws;
		ws.send('revo ctrl ver. '+pkg.version);//todo: replace 'revo ctrl' with app name
		// listen to revoctrl bridge messages
		ws.on('message', function(data){
			try {
				message = JSON.parse(data);
				if((message.type === 'from-web') && message.event) {
					// emit event to be handled by non-web components
					var eventName = message.model+':'+message.event;
					var eventPayload = message.data;
					debug('from-web:', eventName, eventPayload);
					process.emit(eventName, eventPayload);
					// send the event back to the web, todo: do it conditionally
					var msg = { type: 'revo-event', event: message.event };
					if(message.payload) msg.payload = message.payload;
					if(message.component) msg.component = message.component;
					if(socketClient) socketClient.send(JSON.stringify(msg));
				}
				else if(modelHandlers[message.model]) {
					var registeredHandler = modelHandlers[message.model][0];
					var eventName = [registeredHandler, message.action].join(':');
					process.emit(eventName, message.data);
				} else {
					var err = new Error('no handlers for model ['+message.model+']');
					debug(ERROR(err.message));
					process.emit('revo:error', err);
				}
			} catch(err) {
				debug(err)					
			}
		});
		var configMsg = { type: 'revo-config', config: config.config };
		ws.send(JSON.stringify(configMsg));
	});
}

function initializeComponents() {
	try {
		var config = yaml.safeLoad(fs.readFileSync('./config.yml', 'utf8'));
		// clear existing listeners
		var components = config.components;
		for(componentName in components) {
			process.removeAllListeners(components[componentName].emit);
		}
		// register event and model handler & init modules
		for(componentName in components) {
			// debug('processing component', componentName);
			var componentOpts = components[componentName];
            if(componentOpts.type == 'common') {
            	// construct module
				var componentFullPath = ['../components', componentName, 'component'].join('/');
				var module = require(componentFullPath);
				var m = new module();
				debug('['+componentName+']\t loaded');
				var opts = components[componentName];
				// register event listeners
				if(opts.emit) {
					registerEventHandler(config, opts.emit);
				}
				if(opts.listen) {
					registerEventHandler(config, opts.listen);
					registerEventHandler(config, opts.listen+'.response');
				}
				//register model handler
				if(componentOpts.models) {
                    // componentOpts.models.forEach(function(model){
                    Object.keys(componentOpts.models).forEach(function(model){
                    	var modelData = componentOpts.models[model];
                    	debug('['+componentOpts.safename+']\t model: '+model+', methods: '+modelData.supportedMethods);
                    	if(modelHandlers[model]) {
                    		modelHandlers[model].push(componentOpts.safename);
                    	} else {
							modelHandlers[model] = [componentOpts.safename];
                    	}
                    });
                }
				// initialize module
				if(m.init) {
					m.init(opts);
					debug('['+componentName+']\t initialized')
					process.emit('revo:'+componentName+':created', components[componentName]);
				} else {
					debug('['+componentName+']\t init function not found');
				}
			}
		};
	} catch(err) {
		debug('ERROR:', ERROR(err.message));
	}
}

function loadConfig() {
	var configModulePath = __dirname+'/../components/config/component.js';
	if (fs.existsSync(configModulePath)) {
		var module = require(configModulePath);
		configModule = new module();
		debug('config module loaded and initialized')
	}
}

function registerEventHandler(config, fullEventName) {
	process.on(fullEventName, function(payload){
		debug(fullEventName, '->', payload);
		var targetComponentName = /^(.+):.*/.exec(fullEventName)[1];
		//todo: selectively send socket messages based on target component type (web)
		var msg = { type: 'revo-event', event: fullEventName, payload: payload, component: cfg.safename };
		if(socketClient) socketClient.send(JSON.stringify(msg));

		// Object.keys(config.components).forEach(function(key){
		// 	var cfg = config.components[key];
		// 	if(cfg.name && (cfg.name == targetComponentName) && (cfg.type == 'web')) {
		// 		//todo: introduce message model
		// 		var msg = { type: 'revo-event', event: fullEventName, payload: payload, component: cfg.safename };
		// 		debug(':::::', msg)
		// 		if(socketClient) socketClient.send(JSON.stringify(msg));
		// 	}
		// });
	});
}
