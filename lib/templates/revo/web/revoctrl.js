var placeholders = {};
var successHandlersMap = {};
var errorHandlersMap = {};
var commonEventHandlersMap = {onload:[]};
var customEventHandlers = {};
var componentInitializers = {};
var componentsStatus = { expected:{}, actual:{} };
var ws = new WebSocket('ws://'+window.location.hostname+':3000');
var placeholderSize = {};
var alreadyInitialized = false;
var isClientReady = false;
ws.onmessage = function (msg) {
	try {
		var data = JSON.parse(msg.data);
		data.payload = data.payload || {};
		if(data.type) {
			if(data.type === 'revo-config') {
				if(data.expect) {
					componentsStatus.expected = data.expect;
				} else if(data.init) {
					data.init.forEach(function(component){
						// console.log('initializing:', component.name);					
						var componentNamespace = component.safename.replace(/\-/g, '_');
						window[componentNamespace].init(component);
						componentsStatus.actual.init = componentsStatus.actual.hasOwnProperty('init') ? componentsStatus.actual.init+1 : 1;
					});
				} else if(data.register) {
					data.register.forEach(function(component){
						// console.log('registering event handler for', component.handles, '->', component.name);
						componentsStatus.actual.register = componentsStatus.actual.hasOwnProperty('register') ? componentsStatus.actual.register+1 : 1;
						document.addEventListener(component.handles, function (e) {
							invokeHandler(component.safename, component.handles);
						});
					});
				} else if(data.config && data.config.placeholders) {
					// console.log('page configuration: placeholders')
					data.config.placeholders.forEach(function(ph){
						var name = Object.keys(ph)[0];
						placeholders[name] = ph[name];
					});
					placeholders.main = placeholders.main || 'body';
				}
			} else if(data.type === 'revo-event') {
				if(data.event) {
					document.dispatchEvent(new CustomEvent( data.event, {detail: data.payload} ));
					if(data.event === 'load') {
						var placeholder = placeholders[data.payload.placeholder] || placeholders.main;
			 			$(placeholder).load(['components', data.component, 'index'].join('/'), function(){
							data.config = data.config || {};
							if(!!data.config.onload) {
								console.log('invoking onload handler for', data.component, data.config.onload)
								invokeHandler(data.config.onload, 'onload', {component:data.component});
							}
							revo.emit({ model: 'revo', action: 'client:ready', data: '' });
							document.dispatchEvent(new CustomEvent('revo:ready'));
							registerFormHandlers();
			 			});
					} else if(data.event.endsWith('.response')) {
						if(data.payload.error) {
							var errorHandler = errorHandlersMap[data.event];
							if(errorHandler) invokeHandler(errorHandler);
							else revo.handleError(data.payload.error);
						} else {
							var successHandler = successHandlersMap[data.event];
							if(!!successHandler) invokeHandler(successHandler, data.event, data.payload);
						}
					// } else {
					// 	document.dispatchEvent(new CustomEvent(data.event, data.payload));
					}
				}
			}
		} else {
			console.log('unknown message type:', data);
		}
	} catch(err) {
		// console.log('['+msg.data+']');
	}
}
function invokeHandler(handler, event, payload) {
// console.log('invokeHandler:', handler, event, JSON.stringify(payload));
	if(handler) {
		if(handler.startsWith('revo:')) {
			handler = /revo:(.*)/.exec(handler)[1];
			var params = handler.split(':');
			var action = params[0];
			if(!!revo[action]) {
				var revoPayload = {};
				if(action == 'load') {
					revoPayload.component = params[1];
					//todo: check for the next param as placeholder
				} else if(action == 'emit') {
					revoPayload.model = params[1];
					revoPayload.action = params[2];
				}
				// console.log('invoking revo:', action, revoPayload);
				revo[action](revoPayload);
			} else {
				console.log('unrecognized revo action:', action);
			}
		} else {
			handler = handler.replace(/\-/g, '_');
			if(!!customEventHandlers[handler]) {
				customEventHandlers[handler](event, payload);
			} else {
				console.log(handler, 'not defined');
			}
		}
	}
}
function registerFormHandlers() {
	delete successHandlersMap;
	delete errorHandlersMap;
	$('form').each(function(i, formEl){
		if($(formEl).attr('model')) {
			// register event handlers
			var model = $(formEl).attr('model');
			var action = $(formEl).attr('request');
			// console.log('registering success handler for:', model);
			// register success handler
			var successHandler = $(formEl).attr('onsuccess');
			if(successHandler) {
				if((successHandler.indexOf('_') > 0) && (successHandler.indexOf('_') < successHandler.indexOf('/'))) {
					//successHandler is in safe format
				} else {
					successHandler = successHandler.replace('/', '_');
				}
				var key = model+':'+action+'.response';
				successHandlersMap[key] = successHandler;
			}
			// register error handler
			var errorHandler = $(formEl).attr('onerror');
			if(errorHandler) {
				if((errorHandler.indexOf('_') > 0) && (errorHandler.indexOf('_') < errorHandler.indexOf('/'))) {
					//errorHandler is in safe format
				} else {
					errorHandler = errorHandler.replace('/', '_');
				}
				var key = model+':'+action+'.response';
				errorHandlersMap[key] = errorHandler;
			}
			// handle form submission
			$(formEl).on('submit', function(event) {
				event.preventDefault();
				// build payload and trigger form submission
				var data = {};
				$(formEl).find('input').each(function(i, inputEl){
					var fieldName = $(inputEl).attr('field');
					if(fieldName) data[fieldName] = $(inputEl).val();
				})
				revo.emit({ model: model, action: action, data: data });
			});
		}
	});
}
window.revo = {
	handle: function(data) {
		ws.send(JSON.stringify(data))
	},
	load: function(data) {
		if(data.component) {
			revo.handle({
				type: "from-web",
				event: "load",
				component: data.component.replace('/', '_'),
				payload: { placeholder: data.placeholder||"main" }
			});
		} else {
			console.log('missing "component" key in load()')
		}
	},
	emit: function(data) {
		revo.handle({
			type: "from-web",
			event: data.action,
			model: data.model,
			data: data.data
		});
	},
	handleError: function(error) {
		//todo: trigger a local error event
		alert(error.message)
	},
	registerCustomEventHandler: function(handlerName, handlerFunction){
		customEventHandlers[handlerName] = handlerFunction;		
		console.log('custom event handler', handlerName, 'registered');
	}
}
