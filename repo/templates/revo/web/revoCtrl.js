var placeholders = {};
var responseHandlersMap = {};
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
								revo.handleError(data.payload.error);
							} else {
								var responseHandler = responseHandlersMap[data.event];
								invokeHandler(responseHandler);
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
	delete responseHandlersMap;
	$('form').each(function(i, formEl){
		if($(formEl).attr('model')) {
			$(formEl).on('submit', function(event) {
				event.preventDefault();
				var model = $(formEl).attr('model');
				var action = $(formEl).attr('request');
				var responseHandler = $(formEl).attr('onresponse');
				if((responseHandler.indexOf('_') > 0) && (responseHandler.indexOf('_') < responseHandler.indexOf('/'))) {
					//responseHandler is in safe format
				} else {
					responseHandler = responseHandler.replace('/', '_');
				}
				if(responseHandler) {
					var key = model+':'+action+'.response';
					responseHandlersMap[key] = responseHandler;
				}
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
