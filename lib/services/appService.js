var debug = require('debug')('revo:appService'),
	_ = require('underscore'),
	Promise = require('bluebird'),
	S = require('string'),
	fs = Promise.promisifyAll(require('fs')),
	mkdir = Promise.promisifyAll(require('mkdirp')),
    yaml = require('js-yaml'),
    fs   = require('fs'),
    jsdom = require('jsdom'),
	util = require('../util'),
    repoService = require('./repoService');

var dir = __dirname;
dir = dir.substring(0, dir.lastIndexOf('/'));
dir = dir.substring(0, dir.lastIndexOf('/'));
const REVO_HOME = dir;
const THEMES_DIR = REVO_HOME+'/repo/themes';

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
        // .then(installComponents)
        // .then(installData)
        .then(function(recipe){
            return new Promise(function (resolve) {
                if(recipe.platform && recipe.platform.type && (recipe.platform.type == 'web')) {
                    installWebPlatform(recipe);
                }
                return resolve(recipe);
            });
        })
        // if(opts)
        .then(function(recipe){
            // debug(JSON.stringify(recipe, null, 4));
            debug(recipe);
        })
        // // .then(generateCode)
        // // .then(generateTests)
        // // .then(generateWebapp)
        // .then(done)
        // // .catch(debug)
    }

}

function installWebPlatform(recipe) {
    return new Promise(function (resolve) {
        installTheme(recipe)
        .then(installWebComponents)
        .then(resolve(recipe))
    });
}

function installTheme(recipe){
    var theme = recipe.platform.theme;
    return new Promise(function (resolve) {
        if(theme) {
            repoService.web.fetchTheme(theme)//promise doesn't work here (check race condition)
            .then(function(){
                return alterTheme(theme);
            })
            .then(function(){
                return generateRevoControllerScript(theme)                
            })
            .then(function(script){
                return installGeneratedScript(script);
            })
            .then(function(){
                return repoService.installTheme(recipe.path, theme)                
            })
            .then(resolve(recipe));
        } else {
            return resolve(recipe);                
        }
    });
}

function alterTheme(theme) {
    //todo: extract theme into a model
    var themeName = theme.name || 'noname';
    var templateRelativePath = (theme.zip_path) ? [theme.name, theme.zip_path].join('/') : theme.name;
    var templateMainFilenameFullpath = [THEMES_DIR, templateRelativePath, 'index.html'].join('/');
    return fs.readFileAsync(templateMainFilenameFullpath, 'utf8')
    .then(function(filedata){
        var doc = jsdom.jsdom(filedata);
        var window = doc.parentWindow;
        var revoCtrlScriptEl = window.document.createElement("script");
        revoCtrlScriptEl.src = "revoCtrl.js";
        window.document.body.appendChild(revoCtrlScriptEl);
        var alteredTemplate = jsdom.serializeDocument(doc);
        return fs.writeFileAsync(templateMainFilenameFullpath, alteredTemplate);
    });
}

function installGeneratedScript(script){
    debug('installing script:', script);
}

function generateRevoControllerScript() {
    return new Promise(function(resolve){
        var template = "//TODO: define revo controller script template";
        var script = template;//use handlebars
        return resolve(script);
    })
}

function installWebComponents(recipe) {
    var fetches = []
    var installs = []
    recipe.components.forEach(function(component){
        var componentName = Object.keys(component)[0];
        var opts = component[componentName];
        var fetchProm = repoService.web.fetchComponent(component);
        fetches.push(fetchProm);
        var installProm = repoService.installComponent(recipe.path, componentName, opts);
        installs.push(installProm);
    });
    Promise.all(fetches)
    .then(function(){
        Promise.all(installs)
    })
    .then(function(){
        debug('done installing ', installs.length, 'components');
        return recipe;
    });

//                     // .then(function(themeDir){
//                     //     repoService.installTheme(recipe.path, themeDir);
//                     // })
//                     // repoService.installComponent(recipe.path, componentName, opts)
//                 });        
// // debug(components);
//             })
//             .catch(function(){

//             })
    return recipe;
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
            var fullRecipeFilename = S(dir+'/repo/recipes/'+opts.recipeFile).ensureRight('.yaml').s;
            fs.readFileAsync(fullRecipeFilename, 'utf8')
            .then(function(filedata){
                recipe = yaml.safeLoad(filedata);
                // overwrite recipe setting
                if(!!opts.path) recipe.path = [appsDir, opts.path].join("/");
                if(!!opts.appName && !opts.path) recipe.path = [appsDir, opts.appName] .join("/");
                if(opts.appName) recipe.appName = opts.appName;
                if(opts.force) recipe.force = opts.force;
                // debug(JSON.stringify(recipe, null, 4));
                return resolve(recipe);
            }).catch(function(err){
                util.abort(err);
            });
        }
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
                .then(function(){
                    if(recipe.platform.type == 'web') {
                        mkdir.mkdirpAsync(recipe.path + "/public")
                    }
                })
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
        }
	    // devDependencies: {
	    //     "mocha": "*",
	    //     "chai": "*"
	    // }
    }
    if(recipe.platform.type == 'web') pkg.dependencies['node-static'] = '*';
    if (recipe.components) {
        // recipe.components = recipe.components.split(',');
        for (var i = 0; i < recipe.components.length; i++) {
            var component = S(recipe.components[i]).trim().s;
            var componentJson = repoService.getComponentJson(component);
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
			        repoService.installComponent(recipe.path, 'config');
			        if (recipe.components) {
			            components = recipe.components;
			            for (var i = 0; i < recipe.components.length; i++) {
			                var component = S(recipe.components[i]).trim().s;
			                repoService.installComponent(recipe.path, component);
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
	// debug(recipe)
    return new Promise(function(resolve, reject){
    	var files = recipe.data;
    	if(files) {
		    debug('installing data files');
		    // debug(recipe.data)
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
