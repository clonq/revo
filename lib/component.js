var pkg = require('../package.json'),
    config = require('config'),
    fs = require('fs'),
    util = require('./util'),
    log = require('./logging');

const REVO_HOME = config.home || __dirname;

module.exports = {
    create: function (opts) {
        init(opts);
        generateComponent(opts);
        done();
    }
}

function init(opts) {
    log.info('', 3);
    log.info('REVO ver ' + pkg.version, 3);
    log.info('creating component ' + opts.name, 3);
    var dirname = 'components/' + opts.name;
    if (!fs.existsSync(dirname)) fs.mkdirSync(dirname);
}

function done() {
    process.on('exit', function (code) {
        if (code != 0) err('generation incomplete');
        log.msg('done');
        log.info('')
    });
}

function generateComponent(opts) {
    installFile('component.js', opts);
    installFile('component.json', opts);
}

function installFile(name, opts) {
    var inputFilename = 'templates/component/' + name;
    var outputFilename = __dirname + '/components/' + opts.name + '/' + name;
    fs.readFile(inputFilename, {encoding: 'utf8'}, function (err, content) {
        if (err) throw err;
        var outputContent = util.compileTemplate(content, opts);
        fs.writeFile(outputFilename, outputContent);
        if (opts.mode) fs.chmod(outputFilename, opts.mode);
    })
}
