var debug = require('debug')('revo:container'),
    fs = require ('fs'),
    _ = require('underscore'),
    chalk = require('chalk'),
    yaml = require('js-yaml'),
    handlebars = require('handlebars'),
    WebSocketServer = require('ws').Server;
    component = require('./models/component'),
    pkg = require('../package.json');
 //    EventEmitter2 = require('eventemitter2').EventEmitter2,
    // eventServer = new EventEmitter2({
    //  verbose: true
    // });

const ERROR = require('chalk').red.bold;
const WARN = require('chalk').yellow.bold;
const INFO = require('chalk').green;
const DEBUG = require('chalk').gray;

var rawConfigData;
var isConfigText = false;
var isConfigJson = false;
var cfg = {};
var configModule;
var socketClient;
var modelHandlers = {};
var eventHandlers = {};
var appContextEventHandlers = {};
var webComponents = {};
var config;
var appContext = {};

module.exports = {
    init: function() {
        // debug('Initializing components');
        // config = yaml.safeLoad(fs.readFileSync('./config.yml', 'utf8'));
        // initializeComponents();
    },
    start: function() {
        // todo: conditionally start web server based on config.platform.type
        startWebServer();
        startComponents();
        startWebsocketServer();
        // startWebBridge();
        // loadConfig();
    }
}

function startComponents(){
    config = yaml.safeLoad(fs.readFileSync('./config.yml', 'utf8'));
    initializeComponents();
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
    app.get('/components/[a-z\_\/\-]+/', function (req, res, next) {
        var componentFullname = /components\/(.+)/.exec(req.originalUrl)[1];
        var templateFilename = [__dirname.substring(0, __dirname.lastIndexOf('/')), 'public', 'components', componentFullname].join('/') + '.revo';
        debug('reading revo template:', templateFilename);
        //todo: cache generated html
        fs.readFile(templateFilename, {encoding: 'utf8'}, function(err, data){
            if(err) res.end(err);
            else {
                var html = compileTemplate(data, appContext);
                res.send(html);
            }
        })
    });    
    http.listen(app.get('port'), function () {
        debug('web server v. ' + pkg.version + ' started on port 3000');
    });
}

function startWebBridge() {
    var componentsToInitialize = _.toArray(webComponents);
    var componentsToRegister = _.filter(webComponents, function(component){ if (component.handles) return component; });
    // set expectations
    socketClient.send(JSON.stringify({ type: 'revo-config', expect: { init:componentsToInitialize.length, register:componentsToRegister.length } }));
    // configure page (placeholders & co)
    socketClient.send(JSON.stringify({ type: 'revo-config', config: config.config }));
    //todo: do we need this?
    process.on('web:flow', function(pin){
// debug('web:flow', pin);
        if(pin && pin.action) {
            var msg = { type: 'revo-event', event: 'load' };
            if(pin.payload) msg.payload = pin.payload;
            //payload should contain a placeholder if there are multiple components registered for the same action
            getComponentsRegisteredFor(pin.action).forEach(function(component){
                msg.component = getComponentsRegisteredFor(pin.action);
                debug('socket->', msg);
                socketClient.send(JSON.stringify(msg));
            })
        } else {
            debug(WARN('missing "action" key in web bridge payload'));
        }
    });
    // register event handlers
    if(componentsToRegister.length) socketClient.send(JSON.stringify({ type: 'revo-config', register: componentsToRegister }));
    // initialize web components on the client side
    if(componentsToInitialize.length) socketClient.send(JSON.stringify({ type: 'revo-config', init: componentsToInitialize }));
}

function getComponentsRegisteredFor(webAction) {
    var ret = [];
    Object.keys(webComponents).forEach(function(componentName){
        var opts = webComponents[componentName];
        if(opts.handles == webAction) {
            ret.push(componentName);
        }
    })
    return ret;
}

function startWebsocketServer() {
    var wss = new WebSocketServer({ port: 3001 });
    debug('websocket server v. ' + pkg.version + ' started on port 3001');
    //todo: extract into a separate "revo-client-protocol" class 
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
                    // debug('from-web:', eventName, eventPayload);
                    if(eventName === 'revo:client:ready') {
debug(ERROR('>>> client is ready <<<'));
                    } else {
// debug('dynamicEventHandler:', eventName+'.response')                        
                        dynamicEventHandler(eventName+'.response');
                        process.emit(eventName, eventPayload);
                        // send the event back to the web, todo: do it conditionally
                        var msg = { type: 'revo-event', event: message.event };
                        if(message.payload) msg.payload = message.payload;
                        if(message.component) msg.component = message.component;
                        if(socketClient) socketClient.send(JSON.stringify(msg));
                    }
                } else if(modelHandlers[message.model]) {
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
        startWebBridge();
    });
}

function initializeComponents() {
    debug('Initializing components');
    var appConfig = require('../appconfig.json');
    try {
        // register event and model handler & init modules
        var components = config.components;
        for(componentName in components) {
            // debug('processing component', componentName);
            // clear existing listeners
            process.removeAllListeners(components[componentName].emit);
            var componentOpts = components[componentName];
            //inject component-specific config data
            if(appConfig[componentOpts.name]) {
                var configData = appConfig[componentOpts.name];
                componentOpts = _.defaults(componentOpts, configData);
            }
            if(componentOpts.type == 'common') {
                // construct module
                var componentFullPath = ['..', 'components', componentName, 'component'].join('/');
                var module = require(componentFullPath);
                var m = new module();
                debug('['+componentName+']\t loaded');
                var opts = components[componentName];
                // register event listeners, todo: deprecate
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
                        modelData.supportedMethods.forEach(function(method){
                            registerEventHandler(config, [model, method].join(':'));
                            registerAppContextEventHandler([model, method].join(':'));
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
            } else if(componentOpts.type == 'web') {
                // var isRegisteredForWebBridgeEvents = !!component.handles;
                // debug('['+componentName+']\t web component registered')
                webComponents[componentName] = componentOpts;
                // if(componentOpts.listen) {
                //     registerEventHandler(config, componentOpts.listen);
                // }
            }
        };
    } catch(err) {
        debug('ERROR:', ERROR(err.message));
    }
}

// function loadConfig() {
//     var configModulePath = __dirname+'/../components/config/component.js';
//     if (fs.existsSync(configModulePath)) {
//         var module = require(configModulePath);
//         configModule = new module();
//         debug('config module loaded');
//         if(!!configModule.init) {
//             configModule.init();
//             debug('config module initialized');
//             process.emit('revo:config:created', components[componentName]);
//         }
//     }
// }

function registerAppContextEventHandler(fullEventName) {
    // response events payloads usually contain models
    // todo: should i make this ^ mandatory?
    responseEvent = fullEventName + '.response';
    var isRegistered = !!appContextEventHandlers[responseEvent];
    if(!isRegistered) {
        var handler = function(payload){
            if(!!payload && (typeof payload === 'object')) {
                Object.keys(payload).forEach(function(key){
                    appContext[key] = payload[key];
                })
            }
        };
        appContextEventHandlers[responseEvent] = handler;
        process.on(responseEvent, handler);
    }
}

function registerEventHandler(config, fullEventName) {
    var isRegistered = !!eventHandlers[fullEventName];
    if(!isRegistered) {
        debug(DEBUG('registering handler for '+fullEventName));
        var handler = function(payload){
            debug(fullEventName, '->', payload);
            var targetComponentName = /^(.+):.*/.exec(fullEventName)[1];
            //todo: selectively send socket messages based on target component type (web)
            var msg = { type: 'revo-event', event: fullEventName, payload: payload, component: cfg.safename };
            if(!!socketClient) socketClient.send(JSON.stringify(msg));

            // Object.keys(config.components).forEach(function(key){
            //  var cfg = config.components[key];
            //  if(cfg.name && (cfg.name == targetComponentName) && (cfg.type == 'web')) {
            //      //todo: introduce message model
            //      var msg = { type: 'revo-event', event: fullEventName, payload: payload, component: cfg.safename };
            //      debug(':::::', msg)
            //      if(socketClient) socketClient.send(JSON.stringify(msg));
            //  }
            // });
        };
        eventHandlers[fullEventName] = handler;
        // debug('registering event handler for', fullEventName);
        process.on(fullEventName, handler);
    }
}

function dynamicEventHandler(fullEventName) {
    var isRegistered = !!eventHandlers[fullEventName];
    if(!isRegistered) {
        // debug('dynamicEventHandler:', fullEventName);
        var handler = function(payload){
            // debug(fullEventName, '->', payload);
            var targetComponentName = /^(.+):.*/.exec(fullEventName)[1];
            //todo: selectively send socket messages based on target component type (web)
            var msg = { type: 'revo-event', event: fullEventName, payload: payload, component: cfg.safename };
            if(socketClient) socketClient.send(JSON.stringify(msg));
        };
        eventHandlers[fullEventName] = handler;
        process.on(fullEventName, handler);
    }
}

function compileTemplate(source, data) {
    var template = handlebars.compile(source);
    return template(data);
}

function warn(msg) {
    if(msg instanceof Object) msg = JSON.stringify(msg, null, 2);
    debug(WARN(msg));
}

function info(msg) {
    if(msg instanceof Object) msg = JSON.stringify(msg, null, 2);
    debug(INFO(msg));
}
