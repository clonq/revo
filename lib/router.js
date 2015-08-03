var debug = require('debug')('revo:router'),
	express = require('express'),
    router = express.Router(),
	_ = require('underscore');

const ERROR = require('chalk').red.bold;
const WARN = require('chalk').yellow.bold;
const INFO = require('chalk').green;

module.exports = router;

//todo: refactor this into a revo component
process.on('http.route:create', function(payload){
	payload.method = payload.method || 'GET';
	debug('registered new dynamic route: ' + payload.method.toUpperCase() + ':' + payload.path);
	if(!!payload.path) {
		//todo: refactor
		if(payload.method.toUpperCase() == 'GET') {
			router.route(payload.path).get(function (req, res, next) {
				if(!!payload.trigger) {
					//todo: move this block into sendFile's callback
					var reqData = { path: req.url, data: {} };
					Object.keys(req.query).forEach(function(key){
						reqData.data[key] = req.query[key];
					})
					//todo: add x-headers
					setTimeout(function(){
						process.emit(payload.trigger, reqData);
					}, 500);
				}
				if(payload.webpage) {
	// 				var fullPath = [__dirname, '..', 'public', (payload.webpage=='/')?'index.html':payload.webpage].join('/');
	// 				fullPath = 'index.html';
	// 				var options = {
	// 					root: __dirname + '/public/',
	// 					dotfiles: 'deny',
	// 					headers: {
	// 					    'x-timestamp': Date.now(),
	// 					    'x-sent': true
	// 					}
	// 				};				
	// 				res.sendFile(fullPath, options, function(err){
	// 					if(err) debug(ERROR(err));
						// process.emit(payload.trigger, reqData);
	// 				})
					res.redirect(payload.webpage);
				}
				else res.end();
				next();
			});
		} else if(payload.method.toUpperCase() == 'POST') {
			router.route(payload.path).post(function (req, res, next) {
				if(!!payload.trigger) {
					//todo: move this block into sendFile's callback
					var reqData = { path: req.url, data: {} };
					Object.keys(req.query).forEach(function(key){
						reqData.data[key] = req.query[key];
					})
					//todo: add x-headers
					setTimeout(function(){
						process.emit(payload.trigger, reqData);
					}, 500);
				}
				if(payload.webpage) {
					res.redirect(payload.webpage);
				}
				else res.end();
				next();
			});
		}

	}
})

// //TODO
// router.use('test', function (req, res, next) {
// 	debug('intercepting component load:', req.params.component)	
// 	// console.log('Time: ', Date.now());
// 	next();
// });

// router.get('/components', function (req, res, next) {
// 	next();
// });

