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
    path = require('path'),
	util = require('../util'),
    repoService = require('./repoService'),
    webComponent = require('../models/webComponent'),
    component = require('../models/component');

var dir = __dirname;
dir = dir.substring(0, dir.lastIndexOf('/'));
dir = dir.substring(0, dir.lastIndexOf('/'));
const REVO_HOME = dir;
const THEMES_DIR = REVO_HOME+'/repo/themes';
const TEMPLATES_DIR = REVO_HOME+'/lib/templates';
const RECIPES_DIR = REVO_HOME+'/repo/recipes';

const ERROR = require('chalk').red.bold;
const WARN = require('chalk').yellow.bold;
const INFO = require('chalk').green;

var runningApps = {}; 

module.exports = {

    component: {
        defaultConfig: function(componentName) {
            var ret = {};
            var fullModulePath = [repoService.LOCAL_COMPONENTS_REPO, componentName, 'component'].join(path.sep);
            try {
                ret = require(fullModulePath).defaults;
            } catch (err) {
                // no default config
            }
            return ret;
        }
    },

    generateApp: function(opts) {
        return init(opts)
        .then(createDirs)
        .then(createPackage)
        .then(createConfig)
        .then(installRevo)
        .then(installCommonComponents)
        .then(installDependencies)
        .then(installRecipe)
        .then(installData)
        .then(function(recipe){
            return new Promise(function (resolve, reject) {
                if(recipe.platform && recipe.platform.type && (recipe.platform.type == 'web')) {
                    installWebPlatform(recipe)
                    .then(function(){
                        return resolve(recipe);
                    })
                    .catch(function(err){
                        return reject(err);
                    });
                } else {
                    return resolve(recipe);
                }
            });
        });
    },

    runApp: function(appName, cb) {
        var appDir = [repoService.LOCAL_APPS_REPO, appName].join('/');
        // var env = { DEBUG: 'revo:*' };
        var child = require('child_process').fork('container/run', {cwd: appDir, stdio: ['ignore', 'ignore', 'ignore'] });
        runningApps[appName] = child;
        cb(null);
    },

    stopApp: function(appName, cb) {
        if(!!runningApps[appName]) {
            runningApps[appName].kill();
            cb(null);
        } else {
            cb(new Error(appName+' not running'));
        }
    },

    isAppRunning: function(appName) {
        return !!runningApps[appName];
    },

    getRunningApps: function() {
        return Object.keys(runningApps);
    },

    packageApp: function(opts) {
        var srcDir = [repoService.LOCAL_APPS_REPO, opts.appName].join('/');
        var targetDir = opts.destination || dir;
        var targetZipFilename = [targetDir, opts.appName].join('/') + '.zip';
        util.zipDir(srcDir, targetZipFilename);
        return targetZipFilename;
    },

    deployApp: function(opts) {
        return new Promise(function(resolve, reject){
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
                    deployViaScp(recipe, zipFilename, sshopts)
                    .then(function(result){
                        executeHooks(recipe, target, sshopts);
                    })
                    .then(function(result){
                        return resolve(recipe);
                    })
                } else {
                    return reject('unknown deployment method '+method);
                }
            })
            .catch(function(err){
                return reject(err);
            });
        });
    }
}

function executeHooks(recipe, target, sshopts) {
    return new Promise(function (resolve, reject) {
        if(!!target.hooks) {
            if(!!recipe.verbose) console.log('running hooks');
            if(target.hooks.postdeploy) {
                sshopts.cmd = target.hooks.postdeploy;
                util.sshExec(sshopts)
                .then(function(result){
                    if(!!recipe.verbose) {
                        if(!!result.stdOut) console.log(result.stdOut);
                        if(!!result.stdErr) console.log(result.stdErr);
                    }
                    return resolve(recipe);
                }, function(){
                    return reject(err);
                });
            }
        } else {
            if(!!recipe.verbose) console.log('done');
            return resolve(recipe);
        }
    });
}

function deployViaScp(recipe, zipFilename, sshopts) {
    return new Promise(function (resolve, reject) {
        if(!!recipe.verbose) console.log('copy', zipFilename, 'to', sshopts.host);
        var shortZipName = path.basename(zipFilename);
        util.scp(zipFilename, sshopts)
        .then(function(result){
            if(!!recipe.verbose) {
                if(!!result.stdOut) console.log(result.stdOut);
                if(!!result.stdErr) console.log(result.stdErr);
            }
            if(!!recipe.verbose) console.log('extracting packaged app to', sshopts.path);
            sshopts.cmd = ['cd', sshopts.path, '&& tar xf', shortZipName].join(' ');
            return util.sshExec(sshopts);
        })
        .then(function(result){
            if(!!recipe.verbose) console.log('removing temporary remote zip file');
            sshopts.cmd = 'rm ' + [sshopts.path, shortZipName].join(path.sep);
            return util.sshExec(sshopts)
        })
        .then(function(result){
            if(!!recipe.verbose) console.log('removing temporary local zip file');
            if(!!recipe.verbose) {
                if(!!result.stdOut) console.log(result.stdOut);
                if(!!result.stdErr) console.log(result.stdErr);
            }
            return util.deleteFile(zipFilename);
        })
        .then(function(filename){
            if(!!recipe.verbose) console.log(filename, 'removed');
            return resolve(recipe);
        })
        .catch(function(err){
            return reject(err);
        })
    });
}

function installWebPlatform(recipe) {
    debug('installing web platform');
    return new Promise(function (resolve, reject) {
        installTheme(recipe)
        .then(function(){
            return resolve(recipe);
        })
        .catch(function(err){
            return reject(err);
        });
    });
}

function installTheme(recipe){
    var theme = recipe.platform.theme;
    return new Promise(function (resolve, reject) {
        if(!!theme) {
            return repoService.web.theme.install(recipe.path, theme)
            .then(function(fetched){
                alterInstalledTheme(recipe);
            })
            .then(function(){
                return installRevoWeb(recipe);
            })
            .then(function(){
                return installWebComponents(recipe);
            })
            .then(function(){
                return installAdditionalFiles(recipe);
            })
            // .then(function(){
            //     return installCoreComponents(recipe);
            // })
            .then(function(){
                return resolve(recipe);
            })
            .catch(function(err){
                return reject(err);
            })
        }
    });
}

function installAdditionalFiles(recipe) {
    if(!!recipe.platform.theme.css) {
        recipe.platform.theme.css.forEach(function(css){
            var src = process.cwd()+'/'+css;
            var dst = recipe.path+'/public/css/'+util.shortFilename(css);
            util.copyFile(src, dst);
        })
    }
    return recipe;
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
        // inject revo ctrl
        var revoCtrlScriptEl = window.document.createElement("script");
        revoCtrlScriptEl.src = "js/revoctrl.js";
        window.document.body.appendChild(revoCtrlScriptEl);
        // inject additonal css files
        if(!!recipe.platform.theme.css) {
            recipe.platform.theme.css.forEach(function(css){
                var cssEl = window.document.createElement("link");
                cssEl.rel = 'stylesheet';
                cssEl.href = 'css/'+util.shortFilename(css);
                window.document.head.appendChild(cssEl);
            });
        }
        // write altered template
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
    return new Promise(function(resolve, reject){
        var scriptFilename = [path, 'public', 'js', scriptName].join('/');
        fs.writeFile(scriptFilename, script, function(err){
            if(err) return reject(err);
            else return resolve(scriptName);
        });
    });
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
        var fetchProm = repoService.component.fetch(component);
        fetches.push(fetchProm);
        // var installProm = repoService.installComponent(recipe.path, componentName, opts);
        var installProm = repoService.component.install(recipe.path, componentName, opts);
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
                        //todo: extract functions from each main.js and inject them within a namespace
                        //http://stackoverflow.com/questions/881515/how-do-i-declare-a-namespace-in-javascript
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
        } else if(opts.recipe) {
            recipe = opts.recipe;
            // overwrite recipe setting
            if(!!opts.path) recipe.path = [appsDir, opts.path].join("/");
            if(!!opts.appName && !opts.path) recipe.path = [appsDir, opts.appName] .join("/");
            if(opts.appName) recipe.appName = opts.appName;
            if(opts.force) recipe.force = opts.force;
            recipe.components = recipe.components || [];
            // debug(JSON.stringify(recipe, null, 4));
            return resolve(recipe);
        }
    });
}

function createDirs(recipe) {
    return new Promise(function(resolve, reject){
        return fs.statAsync(recipe.path)
            .then(function(){
                if(recipe.force) {
                    return util.rimraf(recipe.path);
                } else {
                    return reject(recipe.appName + ' app already exists. Use --force to overwrite');
                    // util.abort('directory ' + recipe.path  + ' already exists');
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
                            mkdir.mkdirpAsync(recipe.path + "/public/js")
                        }
                    })
                    // .then(mkdir.mkdirpAsync(recipe.path + "/test"))
            })
            .then(function(){
                debug("create directory structure")
                return resolve(recipe);
            });
    })
}

function createPackage(recipe) {
    var pkg = {
        name: util.shortFilename(recipe.path),
        version: "1.0.0",
        scripts: { 
            start: 'DEBUG=revo:* ./container/run'
        },
        dependencies: {
            "body-parser": "1.13.3",
            "bluebird": "2.10.0",
            "chalk": "*",
            "cors": "2.7.1",
            "debug": "*",
            "ejs": "*",
            "errorhandler": "*",
            "eson": "*",
            "express": "~4.12.2",
            "handlebars": "*",
            "js-yaml": "3.3.1",
            "underscore": "1.8.3",
            "ws": "0.7.2"
        }
	    // devDependencies: {
	    //     "mocha": "*",
	    //     "chai": "*"
	    // }
    }
    if(!!recipe && (recipe.dependencies != 'on')) pkg.scripts['prestart'] = 'npm install';
    if(!!recipe && !!recipe.platform && recipe.platform.type == 'web') pkg.dependencies['node-static'] = '0.7.6';
    if (recipe.components) {
        // recipe.components = recipe.components.split(',');
        for (var i = 0; i < recipe.components.length; i++) {
            // var component = S(recipe.components[i]).trim().s;
            var component = recipe.components[i];
            var componentName = Object.keys(component)[0];
            var componentJson = repoService.component.getJson(componentName);
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
    var appConfig = {}
    var recipeConfig = {}
    if (typeof (recipe.config) == 'object') {
        if (_.keys(recipe.config).length) recipeConfig = recipe.config;
    }
    recipe.components.forEach(function(component){
        var componentName = Object.keys(component)[0];
        var componentType = component[componentName].type || 'common';
        var componentExplicitConfig = recipeConfig[componentName] || {};
        var componentDefaultConfig = (componentType === 'common') ? module.exports.component.defaultConfig(componentName) : {};
        var componentConfig = _.defaults(componentExplicitConfig, componentDefaultConfig);
        appConfig[componentName] = componentConfig;
    });
    var appConfigFilename = recipe.path + '/appconfig.json'
    return fs.writeFileAsync(appConfigFilename, JSON.stringify(appConfig, null, 4))
    .then(function(){
        return recipe;
    });
}

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
                    // if(cmp.type == 'common') {
                        var componentName = cmp.name;
                        componentDefinition.name = cmp.name;//tmp hack
                        var opts = componentDefinition[componentName];
                        var fetchProm = repoService.component.fetch(componentDefinition);
                        fetches.push(fetchProm);
                    // }
                });
                Promise.all(fetches)
                .then(function(){
                    debug(fetches.length+' common component'+((fetches.length>1)?'s':'')+' fetched')
// console.log(fetches.length+' common component'+((fetches.length>1)?'s':'')+' fetched')

                    recipe.components.forEach(function(componentDefinition){
                        var cmp = component.parse(componentDefinition);
                        // if(cmp.type == 'common') {
                            var componentName = cmp.name;
                            componentDefinition.name = cmp.name;//tmp hack
                            var opts = componentDefinition[componentName];
                            var installProm = repoService.component.install(recipe.path, componentName, opts);
                            installs.push(installProm);
                        // }
                    });

                    Promise.all(installs)
                    .then(function(){
// console.log(installs.length+' common component'+((installs.length>1)?'s':'')+' installed')
                        debug(fetches.length+' common component'+((fetches.length>1)?'s':'')+' installed')
                        return resolve(recipe);    
                    })
                    .catch(function(err){
                        debug(err);
                        return reject(err);
                        // return resolve(recipe);    
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

function installRecipe(recipe) {
    return new Promise(function(resolve, reject){
        var recipeFilename = [recipe.path, 'recipe.json'].join(require('path').sep);
        fs.writeFile(recipeFilename, JSON.stringify(recipe, null, 4), function (err) {
            if (err) return reject(err);
            else return resolve(recipe);
        });
    });
}

function installDependencies(recipe) {
    return new Promise(function(resolve, reject){
// console.log('installDependencies begin')
        if(recipe.dependencies == 'on') {
            debug('installing dependencies');
            var installs = [];
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
// console.log('installDependencies done')
                return resolve(recipe);
            });
        } else {
// console.log('installDependencies done')
            return resolve(recipe);
        }
    });
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
                        debug(WARN('Cannot load default config for '+moduleName+' ['+err.message+']'));
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
    	if(!!recipe.data) {
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
    	} else {
// console.log('installData done');            
            return resolve(recipe);     
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
    });
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
