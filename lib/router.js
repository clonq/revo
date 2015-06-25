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
	debug('registered new dynamic route:', payload.path);
	if(!!payload.path) {
		router.route(payload.path).get(function (req, res, next) {
			if(!!payload.trigger) {
				//todo: add x-headers & query data
				//todo: move this block into sendFile's callback
				var reqData = req.params
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

