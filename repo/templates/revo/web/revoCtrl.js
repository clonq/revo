var placeholders = {};
var successHandlersMap = {};
var errorHandlersMap = {};
var customEventHandlers = {};
var componentInitializers = {};
var ws = new WebSocket("ws://localhost:3001");
ws.onmessage = function (msg) {
	try {
		var data = JSON.parse(msg.data);
		data.payload = data.payload || {};
		if(data.type) {
			if(data.type === 'revo-config') {
				if(data.init) {
					var componentNamespace = data.init.safename.replace(/\-/g, '_');
					window[componentNamespace].init(data.init);
				}
				else if(data.config && data.config.placeholders) {
					data.config.placeholders.forEach(function(ph){
						var name = Object.keys(ph)[0];
						placeholders[name] = ph[name];
					});
					placeholders.main = placeholders.main || 'body';
				}
				else if(data.register) {
					data.register.forEach(function(component){
console.log('registering component', component.safename, component.handles);
						document.addEventListener(component.handles, function (e) {
							invokeHandler(component.safename, component.handles);
						});
					});
				}
			} else if(data.type === 'revo-event') {
				if(data.event) {
					if(data.event === 'load') {
						var placeholder = placeholders[data.payload.placeholder] || placeholders.main;
						// console.log('loading:', ['components', data.component, 'index.html'].join('/'))
			 			// $(placeholder).load(['components', data.component, 'index.html'].join('/'));
			 			$(placeholder).load(['components', data.component, 'index'].join('/'));
			 			// $(placeholder).load(['components', data.component].join('/'));
			 			// $(placeholder).load('components/test');
			 			// var url = 'test';
			 			// console.log(url)
			 			// $(placeholder).load(url);
						setTimeout(function(){registerFormHandlers();}, 100);//todo:replace timeout with onload
					} else if(data.event.endsWith('.response')) {
						if(data.payload.error) {
							var errorHandler = errorHandlersMap[data.event];
							if(errorHandler) invokeHandler(errorHandler);
							else revo.handleError(data.payload.error);
						} else {
							var successHandler = successHandlersMap[data.event];
							if(successHandler) invokeHandler(successHandler);
						}
					} else {
						document.dispatchEvent(new CustomEvent(data.event, data.payload));
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
function invokeHandler(handler, event) {
	if(handler) {
		if(handler.startsWith('revo:')) {
			handler = /revo:(.*)/.exec(handler)[1];
			var action = /^(.*):.*/.exec(handler)[1];
			var data = /.*:(.*)/.exec(handler)[1];
			revo[action]({component:data});
		} else {
			handler = handler.replace(/\-/g, '_');
			customEventHandlers[handler](event);//todo: refactor
		}
	}
}
function registerFormHandlers() {
	delete successHandlersMap;
	delete errorHandlersMap;
	$('form').each(function(i, formEl){
		if($(formEl).attr('model')) {
			$(formEl).on('submit', function(event) {
				event.preventDefault();
				var model = $(formEl).attr('model');
				var action = $(formEl).attr('request');
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
// console.log('loading', data.component);
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
	listen: function(component, handler){
		customEventHandlers[component] = handler;		
		// console.log('custom event handler registered for', component);
	}
}
