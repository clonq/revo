var express = require('express'),
    router = express.Router(),
	_ = require('underscore');

module.exports = router;

//todo: refactor this into a revo component
process.on('http.route:create', function(payload){
	if(!!payload.path) {
		router.route(payload.path).get(function (req, res, next) {
			if(!!payload.event) {
				//todo: add x-headers & query data
				var reqData = req.params
				process.emit(payload.event, reqData);
			}
			res.end();
			next();
		});
	}
})
