var debug = require('debug')('revo:appService'),
	_ = require('underscore'),
	Promise = require('bluebird'),
	S = require('string'),
	fs = Promise.promisifyAll(require('fs')),
	mkdir = Promise.promisifyAll(require('mkdirp')),
	util = require('../util'),
    repoManager = require('../repo');

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
	        .then(installComponents)
	        .then(installData)
        	// .then(debug)
        // // .then(generateCode)
        // // .then(generateTests)
        // // .then(generateWebapp)
        // .then(done)
        // // .catch(debug)
    }

}

function init(opts) {
    return new Promise(function (resolve) {
		var recipe = {};
    	var dir = __dirname;
    	dir = dir.substring(0, dir.lastIndexOf('/'));
    	dir = dir.substring(0, dir.lastIndexOf('/'));
    	var appsDir = [dir, 'repo', 'apps'].join('/'); 
    	var recipeDir = [dir, 'repo', 'recipes'].join('/');
        if(opts.recipeFile) {
        	try {
        		var fullRecipeFilename = '../../repo/recipes/'+opts.recipeFile;
				recipe = require(fullRecipeFilename);
        	} catch(err) {
        		util.abort('can\'t find recipe '+fullRecipeFilename);
        	}
        }
        // overwrite recipe setting
        if(!!opts.path) recipe.path = [appsDir, opts.path].join("/");
        if(!!opts.appName && !opts.path) recipe.path = [appsDir, opts.appName] .join("/");
        if(opts.appName) recipe.appName = opts.appName;
        if(opts.force) recipe.force = opts.force;
        debug(JSON.stringify(recipe, null, 4));
        return resolve(recipe);
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
		        .then(mkdir.mkdirpAsync(recipe.path + "/components"))
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
            var componentJson = repoManager.getComponentJson(component);
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
    // if (recipe.components) {
    //     var components = recipe.components.split(',');
    //     for (var i = 0; i < components.length; i++) {
    //         var moduleName = S(components[i]).trim().s;
    //         var fullModulePath = __dirname + '/components/' + moduleName + '/component';
    //         try {
    //             ret[moduleName] = require(fullModulePath).defaults;
    //         } catch (err) {
    //             log.info('cannot load default config for', moduleName);
    //         }
    //     }
    // }
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

// function installComponents(path, components, config) {
function installComponents(recipe) {
	return new Promise(function(resolve, reject){
	    if (recipe.components) {
	        debug('installing components');
			var componentsFilename = recipe.path + '/components.txt';
			var componentsContent = _.map(recipe.components, function (it) {
	            return S(it).trim().s
	        }).join(' ');
		    return fs.writeFileAsync(componentsFilename, componentsContent)
			    .then(function(){
			        repoManager.installComponent(recipe.path, 'config');
			        if (recipe.components) {
			            components = recipe.components;
			            for (var i = 0; i < recipe.components.length; i++) {
			                var component = S(recipe.components[i]).trim().s;
			                repoManager.installComponent(recipe.path, component);
			            }
			        }
			        // if (typeof (config) == 'string') {
			        //     if (config) util.copyFile(config, path + '/config.json');
			        //     else {
			        //         fs.writeFileSync(path + '/config.json', '{}');//todo generate config.json using default components' configuration
			        //     }
			        // }
			    }).then(function(){
			    	return resolve(recipe);
			    });
	    } else {
	        debug('no components specified');
	    	return resolve(recipe);
	    }
	});
}

function installData(recipe) {
	debug(recipe)
    return new Promise(function(resolve, reject){
    	var files = recipe.data;
    	if(files) {
		    debug('installing data files');
		    debug(recipe.data)
		    // files.forEach(function(filename){
		    // 	debug(filename)
		    //     // util.copyFile(datasource.filename, recipe.path + '/data/' + util.shortFilename(datasource.filename));
		    // })
    	}

	    // if (files) {
	    //     var filenames = []
	    //     if (util.isDir(files)) filenames = util.getFiles(files);//todo: switch to async
	    //     else filenames = files.split(',');
	    //     for (var i = 0; i < filenames.length; i++) {
	    //         var filename = S(filenames[i]).trim().s;
	    //         if (util.isDir(files)) filename = files + '/' + filename;
	    //         if (fs.existsSync(filename)) util.copyFile(filename, path + '/data/' + util.shortFilename(filenames[i]));
	    //         else log.err('no such file ' + filename);
	    //     }
	    // }
		resolve(recipe);	    
    })
}
