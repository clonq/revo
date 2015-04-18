//todo: deprecate

var pkg = require('../package.json'),
    debug = require('debug')('revo:application'),
    config = require('config'),
    _ = require('underscore'),
    fs = require('fs'),
    S = require('string'),
    repo = require('./repo'),
    util = require('./util'),
    log = require('./logging'),
    repoManager = require('./repo');

const REVO_HOME = config.home || __dirname;

module.exports = {
    create: function (opts) {
        // var recipe = {
        //     path: "../apps/" + opts.id,
        //     datasource: __dirname + '/../' + opts.filename,
        //     force: false
        // }
        // init(recipe, opts)

        // opts = init(opts)
        // installData(opts.name, opts.data)
        // installComponents(opts.name, opts.components, opts.config);
        // createPackageJson(opts.name, opts.components);
        // installRevo(opts.name);
        // done();
    }
}

function init(opts) {
    // repo.init();
    log.info('', 3);
    log.info('REVO ver ' + pkg.version, 3);
    log.info('creating app ' + opts.name, 3);
    if (opts.recipe) {
        opts = _.extend(opts, util.loadJson(opts.recipe));
        try {
            fs.mkdirSync(opts.name);
        } catch (err) {
            // dir already exists - ignore err
        }
        var cfg = {}
        if (typeof (opts.config) == 'object') {
            if (_.keys(opts.config).length) cfg = opts.config;
            else cfg = generateDefaultConfig(opts);
        } else {
            cfg = generateDefaultConfig(opts);
        }
        fs.writeFileSync(opts.name + '/config.json', JSON.stringify(cfg, null, '\t'));
    } else {
        fs.mkdirSync(opts.name);
    }
    return opts;
}

function generateDefaultConfig(opts) {
    var ret = {};
    if (opts.components) {
        components = opts.components.split(',');
        for (var i = 0; i < components.length; i++) {
            var moduleName = S(components[i]).trim().s;
            var fullModulePath = __dirname + '/components/' + moduleName + '/component';
            try {
                ret[moduleName] = require(fullModulePath).defaults;
            } catch (err) {
                log.info('cannot load default config for', moduleName);
            }
        }
    }
    return ret;
}

function installComponents(path, components, config) {
    if (components) {
        log.msg('installing components');
        fs.writeFileSync(path + '/components.txt', _.map(components.split(','), function (it) {
            return S(it).trim().s
        }).join(' '));
        try {
            fs.mkdirSync(path + '/components');
        } catch (err) {
            // dir already exists - ignore err
        }
        installComponent(path, 'config');
        if (components) {
            components = components.split(',');
            for (var i = 0; i < components.length; i++) {
                var component = S(components[i]).trim().s;
                installComponent(path, component);
            }
        }
        if (typeof (config) == 'string') {
            if (config) util.copyFile(config, path + '/config.json');
            else {
                fs.writeFileSync(path + '/config.json', '{}');//todo generate config.json using default components' configuration
            }
        }
    } else {
        log.msg('no components specified');
    }
}

function createPackageJson(path, components) {
    var pkg = {
        name: util.shortFilename(path), scripts: { 
            prestart: 'npm install',
            start: 'container/run'
        }, dependencies: {
            underscore: '*'
        }
    }
    if (components) {
        components = components.split(',');
        for (var i = 0; i < components.length; i++) {
            var component = S(components[i]).trim().s;
            var componentJson = getComponentJson(component);
            for (key in componentJson.dependencies) {
                pkg.dependencies[key] = componentJson.dependencies[key];//todo resolve conflicts
            }
        }
        debug(pkg)
        fs.writeFileSync(path + '/package.json', JSON.stringify(pkg, null, 2));
    }
}

function installData(path, files) {
    log.msg('installing data files');
    try {
        fs.mkdirSync(path + '/data');
    } catch (err) {
        // dir already exists - ignore err
    }
    if (files) {
        var filenames = []
        if (util.isDir(files)) filenames = util.getFiles(files);
        else filenames = files.split(',');
        for (var i = 0; i < filenames.length; i++) {
            var filename = S(filenames[i]).trim().s;
            if (util.isDir(files)) filename = files + '/' + filename;
            if (fs.existsSync(filename)) util.copyFile(filename, path + '/data/' + util.shortFilename(filenames[i]));
            else log.err('no such file ' + filename);
        }
    }
}

function installRevo(path) {
    // log.msg('install revo')
    var startFilename = path + '/' + util.shortFilename(path);
    fs.writeFileSync(startFilename, 'npm start');
    fs.chmod(startFilename, '0755');

    try {
        fs.mkdirSync(path + '/container');
    } catch (err) {
        // dir already exists - ignore err
    }

    var runFilename = path + '/container/run';
    fs.writeFileSync(runFilename, '#!/usr/bin/env node\nvar container=require("./container");\ncontainer.init();\ncontainer.start();');
    fs.chmod(runFilename, '0755');
    installFile('container.js', path + '/container');
    installFile('helpers.js', path + '/container');
}

function done() {
    process.on('exit', function (code) {
        if (code != 0) err('installation incomplete');
        log.msg('done');
        log.info('')
    });
}

function installComponent(path, name) {
    name = S(name).trim().s;
    try {
        fs.mkdirSync(path + '/components/' + name);
    } catch (err) {
        // dir already exists - ignore err
    }
    repoManager.installComponent(path, name);
}

function getComponentJson(name) {
    var ret = {};
    var componentJsonFilename = REVO_HOME + '/components/' + name + '/component.json'
    if (fs.existsSync(componentJsonFilename)) {
        var content = fs.readFileSync(componentJsonFilename);
        ret = JSON.parse(content);
    }
    return ret;
}

function installFile(filename, path) {
    util.copyFile(REVO_HOME + '/' + filename, path + '/' + filename)
}
