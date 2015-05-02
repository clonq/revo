var placeholders = {};
var ws = new WebSocket("ws://localhost:3001");
ws.onmessage = function (msg) {
	try {
		var data = JSON.parse(msg.data);
		if(data.type) {
			if(data.type === 'revo-config') {
				placeholders = data.config.placeholders[0] || {};
				placeholders.main = placeholders.main || 'body';
			} else if(data.type === 'revo-event') {
				if(data.event && (data.event === 'load')) {
		 			$(placeholders.main).load(['components', data.component, 'index.html'].join('/'));
				}
			}
		} else {
			console.log('unknown message type:', data);
		}
	} catch(err) {
		console.log(msg.data);
	}
}
