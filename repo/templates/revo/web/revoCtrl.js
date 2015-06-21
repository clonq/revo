var placeholders = {};
var successHandlersMap = {};
var errorHandlersMap = {};
var ws = new WebSocket("ws://localhost:3001");
ws.onmessage = function (msg) {
	try {
		var data = JSON.parse(msg.data);
		data.payload = data.payload || {};
		if(data.type) {
			if(data.type === 'revo-config') {
				data.config.placeholders.forEach(function(ph){
					var name = Object.keys(ph)[0];
					placeholders[name] = ph[name];
				});
				placeholders.main = placeholders.main || 'body';
			} else if(data.type === 'revo-event') {
				if(data.event) {
					if(data.event === 'load') {
						var placeholder = placeholders[data.payload.placeholder] || placeholders.main;
			 			$(placeholder).load(['components', data.component, 'index.html'].join('/'));
						setTimeout(function(){registerFormHandlers();}, 100);//todo:replace timeout with onload
					} else {
						if(data.event.endsWith('.response')) {
							if(data.payload.error) {
								var errorHandler = errorHandlersMap[data.event];
								if(errorHandler) invokeHandler(errorHandler);
								else revo.handleError(data.payload.error);
							} else {
								var successHandler = successHandlersMap[data.event];
								if(successHandler) invokeHandler(successHandler);
							}
						}
					}
				}
			}
		} else {
			console.log('unknown message type:', data);
		}
	} catch(err) {
		console.log('['+msg.data+']');
	}
}
function invokeHandler(handler) {
	if(handler) {
		if(handler.startsWith('revo:')) {
			handler = /revo:(.*)/.exec(handler)[1];
			var action = /^(.*):.*/.exec(handler)[1];
			var data = /.*:(.*)/.exec(handler)[1];
			revo[action]({component:data});
		} else {
			console.log('todo: invoke custom handler', handler);
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
		//todo trigger custom browser event
		if(data.component) {
			revo.handle({
				type: "from-web",
				event: "load",
				component: data.component,
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
	}
}
