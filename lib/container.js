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
		//todo: conditionally start web server based on config.platform.type
    	startWebServer();
		startWebsocketServer();
	    loadConfig();
    }
}

function startWebServer() {
	var express = require('express'),
	    app = module.exports.app = express(),
	    cors = require('cors'),
	    errorHandler = require('errorhandler'),
	    bodyParser = require('body-parser'),
	    path = require('path'),
	    http = require('http').Server(app),
	    router = require('./router');

    app.set('x-powered-by', false);
    app.set('port', 3000);
    app.engine('html', require('ejs').renderFile);
    app.set('view engine', 'html');
    app.use(cors());
    app.use(bodyParser.json());
    app.use(express.static('./public'));
    // app.use(function (req, res, next) {
    //     res.status(404).sendFile("404.html", { root: path.join(__dirname, "./public"), title: "404 - page not found" });
    // });
    // app.use(function (err, req, res, next) {
    //     res.status(500).sendFile("500.html", { root: path.join(__dirname, "./public"), title: "500 - server error" });
    // });
    app.use(errorHandler({ dumpExceptions: true, showStack: true }));
	app.use('/', router);
	http.listen(app.get('port'), function () {
	    debug('web server v. ' + pkg.version + ' started on port 3000');
	});
}

function startWebsocketServer() {
	var wss = new WebSocketServer({ port: 3001 });
	debug('websocket server v. ' + pkg.version + ' started on port 3001');
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
					//todo: check if model supports the given method before triggering event 
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
					if(!/\.response$/.test(opts.listen)) {
						registerEventHandler(config, opts.listen+'.response');
					}
				}
				if(componentOpts.models) {
                    // componentOpts.models.forEach(function(model){
                    Object.keys(componentOpts.models).forEach(function(model){
                    	var modelData = componentOpts.models[model];
                    	debug('['+componentOpts.safename+']\t model: '+model+', methods: '+modelData.supportedMethods);
						//register model handlers
                    	if(modelHandlers[model]) {
                    		modelHandlers[model].push(componentOpts.safename);
                    	} else {
							modelHandlers[model] = [componentOpts.safename];
                    	}
						// register handlers based on model's supported methods
						// todo: deprecate explicit opts.listen 
						modelData.supportedMethods.forEach(function(method){
							registerEventHandler(config, [model, method].join(':'));
						});
					});
                }
				// initialize module
				if(!!m.init) {
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
	var isRegistered = !!eventHandlers[fullEventName];
	if(!isRegistered) {
		debug('registering handler for', fullEventName);
		var handler = function(payload){
			// debug(fullEventName, '->', payload);
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
		};
		eventHandlers[fullEventName] = handler;
		// debug('registering event handler for', fullEventName);
		process.on(fullEventName, handler);
	}
}
