var debug = require('debug')('revo:cloudService');
var Promise = require('bluebird');

function createLambda() {
    return new Promise(function (resolve, reject) {
        return reject(new Error('not implemented'));
    });
}

module.exports = {
    createLambda: createLambda
}
