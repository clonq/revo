var debug = require('debug')('revo:appService'),
	Promise = require('bluebird'),
	S = require('string'),
	fs = Promise.promisifyAll(require('fs')),
	mkdir = Promise.promisifyAll(require('mkdirp')),
	util = require('../util');

module.exports = {

    generateApp: function(opts) {
        // var destination;
        // if(program.recipe) {
        //     var fullPathRecipe = S(program.recipe).ensureLeft('../').s;
        //     try {
        //         require.resolve(fullPathRecipe);
        //         destination = require(fullPathRecipe).destination;
        //     } catch(err) {
        //         // recipe not found (ignore)
        //     }
        // }
        // var path = destination || directory || ".";
        // util.emptyDirectory(path, function(empty){
        //     if (empty || program.force) {
        //         application.create({name:path, components:program.components, data:program.data, config:program.config, recipe:program.recipe});
        //     } else {
        //         util.abort('destination is not empty, aborting', 3);
        //     }
        // });


        init(opts)
	        .then(createDirs)
        	.then(createPackage)
        	.then(createConfig)
        	.then(installRevo)
        	.then(debug)
        // .then(defineDatasources)
        // .then(installData)
        // // .then(generateCode)
        // // .then(generateTests)
        // // .then(generateWebapp)
        // .then(done)
        // // .catch(debug)
    }

}

function init(opts) {
    return new Promise(function (resolve) {
    	var dir = __dirname;
    	dir = dir.substring(0, dir.lastIndexOf('/'));
    	dir = dir.substring(0, dir.lastIndexOf('/'));
        if(!!opts.path) opts.path = [dir, opts.path].join("/");
        if(!!opts.appName && !opts.path) opts.path = [dir, opts.appName] .join("/");
        if(!opts.appName && !!opts.path) opts.appName = opts.path.substring(opts.path.lastIndexOf("/") + 1);
        // opts.options = opts;
        // opts.packageName = opts.appName;
        return resolve(opts);
    });
}

function createDirs(recipe) {
    return fs.statAsync(recipe.path)
    	.then(function(){
        	if(recipe.force) {
            	return util.rimraf(recipe.path);
        	} else {
	            //TODO: prompt user to rewrite existing dir
            	util.abort('directory ' + recipe.path  + ' already exists');
	        }
	    })
	    .catch(function(){
	        // directory doesn't exist - nothing to do
	    })
	    .finally(function(){
	        return mkdir.mkdirpAsync(recipe.path)
		        .then(mkdir.mkdirpAsync(recipe.path + "/container"))
		        .then(mkdir.mkdirpAsync(recipe.path + "/data"))
		        // .then(mkdir.mkdirpAsync(recipe.path + "/test"))
	    })
	    .then(function(){
	        debug("create directory structure")
	        return recipe;
	    });
}

function createPackage(recipe) {
    var pkg = {
        name: util.shortFilename(recipe.path),
        scripts: { 
	        version: "1.0.0",
            prestart: 'npm install',
            start: 'container/run'
        },
        dependencies: {
            underscore: '*'
        },
	    devDependencies: {
	        "mocha": "*",
	        "chai": "*"
	    }
    }
    if (recipe.components) {
        recipe.components = recipe.components.split(',');
        for (var i = 0; i < recipe.components.length; i++) {
            var component = S(recipe.components[i]).trim().s;
            var componentJson = getComponentJson(component);
            for (key in componentJson.dependencies) {
                pkg.dependencies[key] = componentJson.dependencies[key];//todo resolve conflicts
            }
        }
    }
    var filename = recipe.path + '/package.json'
    return fs.writeFileAsync(filename, JSON.stringify(pkg, null, 4))
	    .then(function(){
	        debug("generate package");
	        return recipe;
	    });
}

function createConfig(recipe) {
    var cfg = {}
    if (typeof (recipe.config) == 'object') {
        if (_.keys(recipe.config).length) cfg = recipe.config;
        else cfg = generateDefaultConfig(recipe);
    } else {
        cfg = generateDefaultConfig(recipe);
    }
    var filename = recipe.path + '/config.json'
    return fs.writeFileAsync(filename, JSON.stringify(cfg, null, 4))
	    .then(function(){
	        debug("generate config");
	        return recipe;
	    });
}

function generateDefaultConfig(recipe) {
    var ret = {};
    if (recipe.components) {
        var components = recipe.components.split(',');
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

function installRevo(recipe) {
    var startFilename = recipe.path + '/' + recipe.appName;
    var runFilename = recipe.path + '/container/run';
    return fs.writeFileAsync(startFilename, 'npm start')
	    .then(function(){
		    fs.writeFileAsync(runFilename, '#!/usr/bin/env node\nvar container=require("./container");\ncontainer.init();\ncontainer.start();')
		    util.installFile('container.js', recipe.path + '/container');
		    // util.installFile('helpers.js', recipe.path + '/container');
	    })
	    .then(function(){
		    fs.chmod(startFilename, '0755');
		    fs.chmod(runFilename, '0755');
	    })
	    .then(function(){
			return recipe;
	    })
}
