var placeholders = {};
var ws = new WebSocket("ws://localhost:3001");
ws.onmessage = function (msg) {
	try {
		var data = JSON.parse(msg.data);
		if(data.type) {
			if(data.type === 'revo-config') {
				data.config.placeholders.forEach(function(ph){
					var name = Object.keys(ph)[0];
					placeholders[name] = ph[name];
				});
				placeholders.main = placeholders.main || 'body';
			} else if(data.type === 'revo-event') {
				if(data.event && (data.event === 'load')) {
					var placeholder = placeholders[data.payload.placeholder] || placeholders.main;
		 			$(placeholder).load(['components', data.component, 'index.html'].join('/'));
				}
			}
		} else {
			console.log('unknown message type:', data);
		}
	} catch(err) {
		console.log(msg.data);
	}
}
window.handle = function(data) {
	ws.send(JSON.stringify(data))
}	
window.load = function(data) {
	if(data.component) {
		handle({
			type: "from-web",
			event: "load",
			component: data.component,
			payload: { placeholder: data.placeholder||"main" }
		});
	} else {
		console.log('missing "component" key in load()')
	}
}	
window.emit = function(data) {
	handle({
		type: "from-web",
		event: data.action,
		model: data.model,
		data: data.data
	});
}	
