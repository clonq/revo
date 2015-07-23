var debug = require('debug')('revo:appService'),
	_ = require('underscore'),
	Promise = require('bluebird'),
	S = require('string'),
	fs = Promise.promisifyAll(require('fs')),
	mkdir = Promise.promisifyAll(require('mkdirp')),
    yaml = require('js-yaml'),
    fs   = require('fs'),
    jsdom = require('jsdom'),
    chalk = require('chalk'),
    ncp = require('ncp').ncp,
    scpClient = require('scp2'),
	util = require('../util'),
    repoService = require('./repoService'),
    webComponent = require('../models/webComponent'),
    component = require('../models/component');

var dir = __dirname;
dir = dir.substring(0, dir.lastIndexOf('/'));
dir = dir.substring(0, dir.lastIndexOf('/'));
const REVO_HOME = dir;
const THEMES_DIR = REVO_HOME+'/repo/themes';
const TEMPLATES_DIR = REVO_HOME+'/repo/templates';
const RECIPES_DIR = REVO_HOME+'/repo/recipes';

const ERROR = require('chalk').red.bold;
const WARN = require('chalk').yellow.bold;
const INFO = require('chalk').green;

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
        .then(installCommonComponents)
        .then(installDependencies)
        .then(installData)
        .then(function(recipe){
            return new Promise(function (resolve) {
                if(recipe.platform && recipe.platform.type && (recipe.platform.type == 'web')) {
                    installWebPlatform(recipe);
                }
                return resolve(recipe);
            });
        })
        .then(function(recipe){
            // debug(JSON.stringify(recipe, null, 4));
            // debug(recipe);
        })
        // // .then(generateCode)
        // // .then(generateTests)
        // // .then(generateWebapp)
        // .then(done)
        // // .catch(debug)
    },

    packageApp: function(opts) {
        var srcDir = [dir, 'repo', 'apps', opts.appName].join('/');
        var targetDir = opts.destination || dir;
        var targetZipFilename = targetDir + '/' + opts.appName + '.zip';
        util.zipDir(srcDir, targetZipFilename);
        debug(opts.appName, 'app has been packaged to', targetZipFilename);
        return targetZipFilename;
    },

    deployApp: function(opts) {
        init(opts)
        .then(function(recipe){
            var target;
            var defaultDeploymentTarget;
            if(recipe.deployment) {
                var deploymentTargets = recipe.deployment.targets || {};
                var targetsCount = Object.keys(deploymentTargets).length;
                if(!!opts.deploymentTarget) {
                    Object.keys(deploymentTargets).forEach(function(targetName){
                        if(targetName == opts.deploymentTarget) {
                            target = recipe.deployment.targets[targetName];
                        }
                    });
                } else {
                    if(targetsCount == 1) {
                        var targetName = Object.keys(deploymentTargets)[0];
                        console.log('No deployment target specified, using default:', targetName);
                        target = recipe.deployment.targets[targetName];
                    }
                }
            }
            // package
            var zipFilename = module.exports.packageApp(opts);
            // setup ssh
            var sshopts = {
                host: target.host,
                port: target.port||22,
                username: target.user,
                password: target.password,
                key: target.key||'~/.ssh/id_rsa',
                path: target.path||'.',
            }
            var method = target.method || 'scp';
            // secure copy the app
            if(method === 'scp') {
                //todo: use async serial execution
                util.scp(zipFilename, sshopts)
                .then(function(data){
                    // extract the app
                    sshopts.cmd = 'tar xvf '+zipFilename.substring(zipFilename.lastIndexOf('/')+1);
                    util.sshExec(sshopts)
                    .then(function(result){
                        if(opts.verbose) console.log(result);
                        // execute hooks
                        if(target.hooks) {
                            if(target.hooks.postdeploy) {
                                sshopts.cmd = target.hooks.postdeploy;
                                util.sshExec(sshopts)
                                .then(function(result){
                                    if(opts.verbose) console.log(result);
                                }, function(){
                                    console.log(ERROR(err));
                                });
                            }
                        }
                    }, function(){
                        console.log(ERROR(err));
                    });
                }, function(err){
                    console.log(ERROR(err));
                });
            } else {
                console.log(ERROR('unknown deployment method '+method));
            }
        });
    }

}

function installWebPlatform(recipe) {
    debug('installing web platform');
    return new Promise(function (resolve) {
        installTheme(recipe)
        .then(resolve(recipe))
    });
}

function installTheme(recipe){
    var theme = recipe.platform.theme;
    return new Promise(function (resolve) {
        if(!!theme) {
            return repoService.web.fetchTheme(theme)
            .then(function(){
                return repoService.installTheme(recipe.path, theme)                
            })
            .then(function(fetched){
                alterInstalledTheme(recipe);
            })
            .then(function(){
                return installRevoWeb(recipe);
            })
            .then(function(){
                return installWebComponents(recipe);
            })
            // .then(function(){
            //     return installCoreComponents(recipe);
            // })
            .then(function(){
                return recipe;
            });
        // } else {
        //     installCoreComponents(recipe)
        //     .then(function(){
        //         return recipe;
        //     });
        }
    });
}

function alterInstalledTheme(recipe) {
    //todo: extract theme into a model
    // var theme = recipe.platform.theme;
    // var themeName = theme.name || 'noname';
    // var templateRelativePath = (theme.zip_path) ? [theme.name, theme.zip_path].join('/') : theme.name;
    // var templateMainFilenameFullpath = [THEMES_DIR, templateRelativePath, 'index.html'].join('/');
    var templateMainFilenameFullpath = [recipe.path, 'public', 'index.html'].join('/');
    debug('customizing theme at', templateMainFilenameFullpath)
    return fs.readFileAsync(templateMainFilenameFullpath, 'utf8')
    .then(function(filedata){
        var doc = jsdom.jsdom(filedata);
        var window = doc.parentWindow;
        var revoCtrlScriptEl = window.document.createElement("script");
        revoCtrlScriptEl.src = "js/vendor/revoctrl.js";
        window.document.body.appendChild(revoCtrlScriptEl);
        var alteredTemplate = jsdom.serializeDocument(doc);
        return fs.writeFileAsync(templateMainFilenameFullpath, alteredTemplate);
    });
}

function installRevoWeb(recipe) {
    return generateRevoControllerScript()                
    .then(function(script){
        return installGeneratedScript(recipe.path, script, 'revoctrl.js')
        .then(function(){
            return recipe;
        });
    });
}

function installGeneratedScript(path, script, scriptName){
    var fullPath = [path, 'public/js/vendor', scriptName].join('/');
    debug('installing script at', fullPath);
    // debug('installing script:', script);
    return fs.writeFileAsync(fullPath, script);

}

function generateRevoControllerScript() {
    var filename = [TEMPLATES_DIR, 'revo/web/revoctrl.js'].join('/');
    return fs.readFileAsync(filename, 'utf8')
    .then(function(filedata){
        //todo: handlebars interpolation
        return filedata;
    });
}

// function installCoreComponents(recipe) {
//     var installs = [];
//     // var components = ['revo/webbridge'];
//     var components = [];
//     components.forEach(function(component){
//         var installProm = repoService.installComponent(recipe.path, component, {type:'common'});
//         installs.push(installProm);
//     });
//     debug('installing', components.length, 'core components');
//     return Promise.all(installs);
// }

function installWebComponents(recipe) {
    // fetch and copy components
    var fetches = []
    var installs = []
    recipe.components.forEach(function(component){
        var componentName = Object.keys(component)[0];
        var opts = component[componentName];
        var fetchProm = repoService.fetchComponent(component);
        fetches.push(fetchProm);
        var installProm = repoService.installComponent(recipe.path, componentName, opts);
        installs.push(installProm);
    });
    Promise.all(fetches)
    .then(function(){
        Promise.all(installs);
    })
    // insert component js & css into template
    .then(function(){
        var templateMainFilenameFullpath = [recipe.path, 'public', 'index.html'].join('/');
        return fs.readFileAsync(templateMainFilenameFullpath, 'utf8')
        .then(function(filedata){
            var doc = jsdom.jsdom(filedata);
            var window = doc.parentWindow;
            recipe.components.forEach(function(componentDefinition){
                var component = webComponent.parse(componentDefinition);
                if(component.type == 'web') {
                    component.scripts().forEach(function(script){
                        var safeComponentName = component.name.replace('\/', '_');
                        var scriptSrc = ['components', safeComponentName, 'js', script.name].join('/');
                        debug('template inserting script:' + scriptSrc)
                        var scriptEl = window.document.createElement("script");
                        scriptEl.src = scriptSrc;
                        window.document.body.appendChild(scriptEl);
                    })
                }
            });
            var alteredTemplate = jsdom.serializeDocument(doc);
            return fs.writeFileAsync(templateMainFilenameFullpath, alteredTemplate);
        });
    })
    .then(function(){
        debug('done installing ', installs.length, 'components');
        return recipe;
    });
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
                recipe.components = recipe.components || [];
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
                .then(mkdir.mkdirpAsync(recipe.path + "/node_modules"))
		        .then(mkdir.mkdirpAsync(recipe.path + "/container/models"))
		        .then(mkdir.mkdirpAsync(recipe.path + "/components"))
		        .then(mkdir.mkdirpAsync(recipe.path + "/data"))
                .then(function(){
                    if(!!recipe && !!recipe.platform && recipe.platform.type == 'web') {
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
        version: "1.0.0",
        scripts: { 
            // prestart: 'npm install',
            start: 'DEBUG=revo:* ./container/run'
        },
        dependencies: {
            "debug": "2.2.0",
            "underscore": "1.8.3",
            "js-yaml": "3.3.1",
            "ws": "0.7.2",
            "body-parser": "^1.12.2",
            "chalk": "*",
            "cors": "^2.5.3",
            "debug": "^2.1.3",
            "ejs": "~2.3.1",
            "errorhandler": "~1.3.4",
            "eson": "~0.5.0",
            "handlebars": "^2.1.3",
            "express": "~4.12.2"
            // "eventemitter2": "^0.4.14"
        }
	    // devDependencies: {
	    //     "mocha": "*",
	    //     "chai": "*"
	    // }
    }
    if(!!recipe && !!recipe.platform && recipe.platform.type == 'web') pkg.dependencies['node-static'] = '0.7.6';
    if (recipe.components) {
        // recipe.components = recipe.components.split(',');
        for (var i = 0; i < recipe.components.length; i++) {
            // var component = S(recipe.components[i]).trim().s;
            var component = recipe.components[i];
            var componentName = Object.keys(component)[0];
            var componentJson = repoService.getComponentJson(componentName);
            for (key in componentJson.dependencies) {
                debug('adding dependency', componentJson.dependencies[key], 'required by', key);
                pkg.dependencies[key] = componentJson.dependencies[key];//todo resolve conflicts
            }
        }
    }
    recipe.packagejson = pkg;
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
    //     else cfg = generateDefaultConfig(recipe);
    // } else {
    //     cfg = generateDefaultConfig(recipe);
    }
    var filename = recipe.path + '/config.json'
    return fs.writeFileAsync(filename, JSON.stringify(cfg, null, 4))
	    .then(function(){
	        debug("generate config");
	        return recipe;
	    });
}

// function generateDefaultConfig(recipe) {
//     var ret = {};
//     // if (recipe.components) {
//     //     var components = recipe.components.split(',');
//     //     for (var i = 0; i < components.length; i++) {
//     //         var moduleName = S(components[i]).trim().s;
//     //         var fullModulePath = __dirname + '/components/' + moduleName + '/component';
//     //         try {
//     //             ret[moduleName] = require(fullModulePath).defaults;
//     //         } catch (err) {
//     //             log.info('cannot load default config for', moduleName);
//     //         }
//     //     }
//     // }
//     return ret;
// }

function installRevo(recipe) {
    var startFilename = recipe.path + '/' + recipe.appName;
    var runFilename = recipe.path + '/container/run';
    return fs.writeFileAsync(startFilename, 'npm start')
	    .then(function(){
		    fs.writeFileAsync(runFilename, '#!/usr/bin/env node\nvar container=require("./container");\ncontainer.init();\ncontainer.start();')
            util.installFile('container.js', recipe.path + '/container');
            util.installFile('models/component.js', recipe.path + '/container');
		    util.installFile('router.js', recipe.path + '/container');
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
function installCommonComponents(recipe) {
	return new Promise(function(resolve, reject){
        // fetch and copy components
        var fetches = []
        var installs = []
        if (recipe.components) {
            debug('installing common components');
            generateAppConfig(recipe)
            .then(function(){
                generateOldAppConfig(recipe)//todo: remove
            })
            .then(function(){
                recipe.components.forEach(function(componentDefinition){
                    var cmp = component.parse(componentDefinition);
                    if(cmp.type == 'common') {
                        var componentName = cmp.name;
                        componentDefinition.name = cmp.name;//tmp hack
                        var opts = componentDefinition[componentName];
                        var fetchProm = repoService.fetchComponent(componentDefinition);
                        fetches.push(fetchProm);
                        var installProm = repoService.installComponent(recipe.path, componentName, opts);
                        installs.push(installProm);
                    }
                });
                Promise.all(fetches)
                .then(function(){
                    debug(fetches.length+' common component'+((fetches.length>1)?'s':'')+' fetched')
                    Promise.all(installs)
                    .then(function(){
                        debug(fetches.length+' common component'+((fetches.length>1)?'s':'')+' installed')
                        return resolve(recipe);    
                    })
                })
                .catch(function(err){
                    debug(WARN(JSON.stringify(err)));
                    if(err.component) {
                        var componentIndex = -1;
                        recipe.components.forEach(function(componentDefinition){
                            componentIndex = componentIndex + 1;
                            var cmp = component.parse(componentDefinition);
                            if(err.component == cmp.name) {
                                debug(WARN('disabling '+cmp.name));
                                recipe.components.splice(componentIndex, 1)
                            }
                        });
                    }
                    return resolve(recipe);    
                });
            })
        } else {
            return resolve(recipe);
        }
    });
}

function installDependencies(recipe) {
    if((recipe.dependencies == 'off') || (recipe.dependencies == 0)) {
        debug('skipping dependencies installation');
        return recipe;
    } else {
        debug('installing dependencies');
        var installs = [];
        return new Promise(function(resolve, reject){
            var dependencies = recipe.packagejson.dependencies;
            Object.keys(dependencies).forEach(function(module){
                var version = dependencies[module];
                // debug('checking module', module, '@', dependencies[module])
                // var fullModuleName = (version == '*') ? module : module+'@'+version;
                var fullModuleName = module;
                repoService
                .getNpmCache(fullModuleName)
                .then(function(modulePath){
                    installs.push(repoService.installDependency(recipe.path, module, modulePath));
                })
                .catch(function(err){
                    debug('Couldn\'t install module from '+modulePath);
                });
            })
            Promise.all(installs)
            .then(function(){
                return resolve(recipe);
            });
        });
    }
}

function generateAppConfig(recipe) {
    return new Promise(function(resolve, reject){
        try {
            var appConfigFilename = [recipe.path, 'config.yml'].join('/');
            var appConfig = {
                components: {},
                config: {}
            };
            if(!!recipe && !!recipe.platform && !!recipe.platform.theme && recipe.platform.theme.placeholders) {
                appConfig.config.placeholders = recipe.platform.theme.placeholders;
            }
            // injectCoreComponents(recipe);
            recipe.components.forEach(function(componentDefinition){
                var cmp = component.parse(componentDefinition);
                if(cmp.type == 'common') {
                    var moduleName = cmp.name.replace('\/', '_');//todo: add /g
                    var fullModulePath = ['../../repo/components', cmp.name, 'component'].join('/')
                    try {
                        //load component defaults
                        var defaultConfig = require(fullModulePath).defaults;
                        var componentConfig = defaultConfig || {};
                        // overwrite component defaults with component config data from recipe
                        Object.keys(cmp.opts).forEach(function(key){
                            componentConfig[key] = cmp.opts[key];
                        })
                        //set config for component
                        appConfig.components[moduleName] = componentConfig;
                    } catch (err) {
                        debug(WARN('Cannot load default config for '+moduleName+'['+err.message+']'));
                    }
                } else if(cmp.type == 'web') {
                    var moduleName = cmp.name.replace('\/', '_');
                    var componentConfig = {};
                    // overwrite component defaults with component config data from recipe
                    Object.keys(cmp.opts).forEach(function(key){
                        componentConfig[key] = cmp.opts[key];
                    })
                    //set config for component
                    appConfig.components[moduleName] = componentConfig;
                }
            });
            var appConfigYaml = yaml.safeDump(appConfig);
            fs.writeFileAsync(appConfigFilename, appConfigYaml)
            .then(function(){
                return resolve(recipe);
            })
        } catch(err) {
            return reject(err);
        }
    });
}

function generateOldAppConfig(recipe) {
    var componentsFilename = recipe.path + '/components.txt';
    var componentsContent = _.map(recipe.components, function (it) {
        var cmp = component.parse(it);
        return cmp.name.replace('\/', '_');
    }).join(' ');
    return fs.writeFileAsync(componentsFilename, componentsContent);
}

function installData(recipe) {
    return new Promise(function(resolve, reject){
    	if(recipe.data) {
            var isDir = /^\.\/|^\//.test(recipe.data);//todo: refine regex
            if (isDir) {
                var isAbsoluteDir = /^\//.test(recipe.data);
                var source = isAbsoluteDir ? recipe.data : [RECIPES_DIR, recipe.data.substring(2)].join('/');
                var destination = [recipe.path, 'data'].join('/');
                debug('installing application data from', source);
                ncp(source, destination, function (err) {
                    if (err) return reject(err);
                    else return resolve(recipe);
                });
            } else {
                var filenames = recipe.data.split(',');
                debug('TODO: installing individual data files:', filenames);
            }
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

// inject core components into recipe
function injectCoreComponents(recipe) {
    var coreComponents = [
        {
            'revo/webbridge': {
                type: 'common'
            }
        }
    ];
    coreComponents.forEach(function(componentDefinition){
        recipe.components.unshift(componentDefinition);
    });
}
