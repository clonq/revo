// var REPOS_CONFIG_FILENAME = './repos.json';
var debug = require('debug')('revo:repoService'),
    Promise = require('bluebird'),
    fs = Promise.promisifyAll(require('fs')),
    // config = require('config'),
    path = require('path'),
    request = require('request'),
    uuid = require('uuid'),
    S = require('string'),
    util = require('../util'),
    fs = require('fs'),
    mkdirp = require('mkdirp'),
    ncp = require('ncp').ncp,
    log = require('../logging'),
    Zip = require('adm-zip'),
    npm = require("npm"),
    yaml = require('js-yaml'),
    _ = require('underscore');

// var REVO_HOME = config.home || __dirname.substring(0, __dirname.lastIndexOf('/')).substring(0, __dirname.lastIndexOf('/'));
// var dir = __dirname;
// dir = dir.substring(0, dir.lastIndexOf('/'));
// dir = dir.substring(0, dir.lastIndexOf('/'));
var REVO_HOME = path.normalize([__dirname, '..', '..'].join(path.sep));
var LOCAL_REPO_ROOT = REVO_HOME+'/repo';
var LOCAL_REPO = REVO_HOME+'/repo/components';
var THEMES_DIR = REVO_HOME+'/repo/themes';
var COMPONENTS_DIR = REVO_HOME+'/repo/components';
var DOWNLOAD_DIR = REVO_HOME+'/repo/download';
var DOWNLOAD_DIR_SHORT = "repo/download";
var DEFAULT_COMPONENTS_REPO = 'http://localhost:10102';
var LOCAL_RECIPES_REPO = REVO_HOME+'/repo/recipes';
var LOCAL_APPS_REPO = REVO_HOME+'/repo/apps';
var LOCAL_COMPONENTS_REPO = REVO_HOME+'/repo/components';
var LOCAL_THEMES_REPO = REVO_HOME+'/repo/themes';

var ERROR = require('chalk').red.bold;
var WARN = require('chalk').yellow.bold;
var INFO = require('chalk').green;

var repos = [];

module.exports = {

    LOCAL_REPO: LOCAL_REPO,
    LOCAL_APPS_REPO: LOCAL_APPS_REPO,
    LOCAL_COMPONENTS_REPO: LOCAL_COMPONENTS_REPO,

    init: function(){
        //todo: prompt user for repo home
        var flag = false;
        if(!util.isDir(LOCAL_REPO_ROOT)) { fs.mkdirSync(LOCAL_REPO_ROOT); flag = true; }
        if(!util.isDir(LOCAL_APPS_REPO)) { fs.mkdirSync(LOCAL_APPS_REPO); flag = true; }
        if(!util.isDir(LOCAL_RECIPES_REPO)) { fs.mkdirSync(LOCAL_RECIPES_REPO); flag = true; }
        if(!util.isDir(LOCAL_COMPONENTS_REPO)) { fs.mkdirSync(LOCAL_COMPONENTS_REPO); flag = true; }
        if(!util.isDir(THEMES_DIR)) { fs.mkdirSync(THEMES_DIR); flag = true; }
        if(!util.isDir(DOWNLOAD_DIR)) { fs.mkdirSync(DOWNLOAD_DIR); flag = true; }
        if(flag) console.log('local repo initialized');
    },

    app: {
        list: function(){
            return util.getDirs(LOCAL_APPS_REPO);
        },
        remove: function(appName){
            var appDir = [LOCAL_APPS_REPO, appName].join('/');
            return util.rimraf(appDir);
        }
    },

    recipe: {
        // list local & optionally central recipes
        list: function(){
            return _.map(util.getFiles(LOCAL_RECIPES_REPO), function(filename){
                return filename.replace(/\.yaml/, '');
            });
        },
        // check if a recipe exists in local repo or in the hub
        check: function(name) {
            var ret = 'unavailable';
            // check local recipes
            var recipes = util.getFiles(LOCAL_RECIPES_REPO);
            var fullRecipeName = S(name).ensureRight('.yaml').s;
            if(recipes.indexOf(fullRecipeName) >=0 ) return 'local';
            // todo: check for recipes in the hub
            return ret;
        },
        use: function(name) {
            var yamlRecipeFilename = [LOCAL_RECIPES_REPO, name+'.yaml'].join('/');
            return yaml.safeLoad(fs.readFileSync(yamlRecipeFilename, 'utf8'));            
        },
        load: function(filename) {
            filename = require('path').resolve(filename);
            return new Promise(function(resolve, reject){
                if(!util.isDir(filename)) {
                    var recipe = yaml.safeLoad(fs.readFileSync(filename, 'utf8'));
                    var recipeName = recipe.name || util.shortFilename(filename);
                    if(recipeName.indexOf('.') > 0) recipeName = recipeName.substring(0, recipeName.indexOf('.'));
                    recipe.name = recipeName;
                    var yamlRecipeFilename = [LOCAL_RECIPES_REPO, recipeName].join('/')+'.yaml';
                    fs.writeFile(yamlRecipeFilename, yaml.safeDump(recipe), function (err) {
                        if (err) {
                            return reject(err);
                        } else {
                            debug(recipeName, 'recipe registered in local repo');
                            return resolve(recipe);
                        }
                    });                    
                } else {
                    return reject(filename, 'appears to be a directory');
                }
            });
        },
        download: function(url) {
            return new Promise(function (resolve) {
                //todo: handle download errors
                debug('fetching theme from', url);
                var targetFile = [DOWNLOAD_DIR, uuid.v4()].join('/');
                var r = request(url).pipe(fs.createWriteStream(targetFile));
                r.on('finish', function () {
                    debug('download complete');
                    var recipe = yaml.safeLoad(fs.readFileSync(targetFile, 'utf8'));
                    var recipeName = recipe.name || uuid.v4();
                    var yamlRecipeFilename = [LOCAL_RECIPES_REPO, recipeName].join('/')+'.yaml';
                    fs.writeFile(yamlRecipeFilename, yaml.safeDump(recipe), function (err) {
                        if (err) {
                            debug('recipe download:', err);
                            return reject(err);
                        } else {
                            debug(recipeName, 'recipe registered in local repo');
                            return resolve(recipe);
                        }
                    });                    
                });
            });
        },
        show: function(name) {
            var yamlRecipeFilename = [LOCAL_RECIPES_REPO, name+'.yaml'].join('/');
            var recipe = yaml.safeLoad(fs.readFileSync(yamlRecipeFilename, 'utf8'));
            console.log(JSON.stringify(recipe, null, 4));
        },
        save: function(recipe){
            return new Promise(function (resolve) {
                var recipeName = recipe.name || uuid.v4();
                var yamlRecipeFilename = [LOCAL_RECIPES_REPO, recipeName].join('/')+'.yaml';
                fs.writeFile(yamlRecipeFilename, yaml.safeDump(recipe), function (err) {
                    if (err) {
                        debug('create recipe:', err);
                        return reject(err);
                    } else {
                        debug(recipeName, 'recipe created in local repo');
                        return resolve(recipe);
                    }
                });                    
            });
        },
        remove: function(recipeName){
            return new Promise(function (resolve, reject) {
                var yamlRecipeFilename = [LOCAL_RECIPES_REPO, recipeName].join('/')+'.yaml';
                fs.unlink(yamlRecipeFilename, function(err){
                    if(err) return reject(err);
                    else return resolve(recipeName);
                });
            });
        },
        filenameForApp: function(appName) {
            return [module.exports.LOCAL_APPS_REPO, appName, 'recipe.json'].join(require('path').sep);
        }
    },

    component: {
        list: function(){
            var ret = [];
            var authors = util.getDirs(LOCAL_COMPONENTS_REPO);
            authors.forEach(function(author){
                var componentDir = LOCAL_COMPONENTS_REPO+'/'+author;
                var authorComponents = util.getDirs(componentDir);
                var type = '?';
                var version = '?';
                var description = '';
                authorComponents.forEach(function(name){
                    var componentJson = componentDir+'/'+name+'/component.json';
                    name = author+'/'+name;
                    try {
                        var componentMetadata = require(componentJson);
                        type = componentMetadata.type || 'common';
                        version = componentMetadata.version || '?';
                        description = componentMetadata.description || '?';
                    } catch(e) {
                        type = 'web';
                        //old web components don't have a component.json file - assume type is web
                    }
                    var component = { author:author, name: name, type: type, version: version, description: description };
                    ret.push(component);
                });
            });
            return ret;
        },
        fetch: function(component){
            return new Promise(function (resolve, reject) {
                // debug('fetching component', component);
// console.log('fetching component', component);
                var componentName = Object.keys(component)[0];
                var opts = component[componentName];
                var componentTargetDir = [COMPONENTS_DIR, componentName].join('/');
                var ret = componentName;
                fs.statAsync(componentTargetDir).then(function(){
                    debug(componentName + ' component cached locally');
                    resolve(ret);
                }).catch(function(){
                    var componentRepo = opts.repo || DEFAULT_COMPONENTS_REPO;
                    var componentVersion = opts.version || 'latest';
                    var componentUrl = [componentRepo, componentName, componentVersion+'.zip'].join('/');
                    if(opts.repo && (opts.repo == 'github')) {
                        componentUrl = ["https://github.com",componentName,"archive","master.zip"].join('/');
                    }
                    if(opts.uri) {
                        componentUrl = opts.uri;
                    }
                    debug(componentName+' doesn\'t exist in local repo, fetching component from '+componentUrl);
                    //todo: reuse download()
                    var targetFile = [DOWNLOAD_DIR, uuid.v4()].join('/');
                    var isError = false;
                    var err;
                    request({uri: componentUrl})
                    .pipe(fs.createWriteStream(targetFile))
                    .on('response', function (response) {
                        isError = response.statusCode != '200';
                        if(isError) {
                            err = {
                                component: componentName,
                                message:  "cannot download from "+componentUrl
                            }
                            if(response.headers.status) err.message += ' ['+response.headers.status+']';
                            return reject(err);
                        }
                    })
                    .on('error', function () {
                        isError = true;
                        err = "cannot download from "+componentUrl;
                        return reject(err);
                    })
                    .on('close', function () {
                        debug('download complete, adding component to local repo');
                        try {
                            zip = new Zip(targetFile);
                            zip.extractAllTo(componentTargetDir, true);//overwrite existing
                            // remove the intermediary directory.
                            var subdirs = util.getSubdirs(componentTargetDir);
                            var files = util.getFiles(componentTargetDir);
                            if((files == 0) && (subdirs.length == 1)) {
                                var deepTargetDir = [componentTargetDir, subdirs[0]].join('/');
                                debug(WARN('moving '+deepTargetDir+' to '+componentTargetDir))
                                ncp(deepTargetDir, componentTargetDir, function (err) {
                                    if (err) return reject(err);
                                    else {
                                        util.rimraf(deepTargetDir)
                                        .then(function(){
                                            return resolve(name);
                                        })
                                        .catch(function(){
                                            return reject(err);
                                        })
                                    }
                                });
                            }
                            return resolve(ret);
                        } catch(err) {
                            return reject(err);
                        }
                    })
                });
            });
        },
        download: function(componentUrl){
            return new Promise(function(resolve, reject){
                var tempFilename = uuid.v4();
                var targetFile = [DOWNLOAD_DIR, tempFilename].join('/');
                var isError = false;
                var err;
                request({uri: componentUrl})
                .pipe(fs.createWriteStream(targetFile))
                .on('response', function (response) {
                    isError = response.statusCode != '200';
                    if(isError) {
                        err = {
                            component: componentName,
                            message:  "cannot download from "+componentUrl
                        }
                        if(response.headers.status) err.message += ' ['+response.headers.status+']';
                        return reject(err);
                    }
                })
                .on('error', function () {
                    isError = true;
                    err = "cannot download from "+componentUrl;
                    return reject(err);
                })
                .on('close', function () {
                    debug('download complete, adding component to local repo');
                    var zip = new Zip(targetFile);
                    //extract to temp dir
                    var tempDirShort = Date.now();
                    var tempDir = [DOWNLOAD_DIR, tempDirShort].join('/');
                    zip.extractAllTo(tempDir, true);//overwrite existing
                    // remove the intermediary directory.
                    var subdirs = util.getSubdirs(tempDir);
                    var files = util.getFiles(tempDir);
                    if((files == 0) && (subdirs.length == 1)) {
                        var subdir = subdirs[0];
                        var deepTargetDir = [tempDir, subdir].join('/');
                        ncp(deepTargetDir, tempDir, function (err) {
                            if (err) return reject(err);
                            else {
                                util.rimraf(deepTargetDir)
                                .then(function(){
                                    // extract component metadata
                                    var componentJson = require(tempDir+'/component.json');
                                    var GITHUB_REGEX = /http[s]*:\/\/github\.com\/([a-z\-]+)\/([a-z\-]+)\/archive\/master\.zip/;
                                    var isGithubRepo = GITHUB_REGEX.test(componentUrl);
                                    var opts = {};
                                    if(isGithubRepo) {
                                        author = GITHUB_REGEX.exec(componentUrl)[1];
                                        name = GITHUB_REGEX.exec(componentUrl)[2];
                                        componentJson.repo = "github";
                                    } else {
                                        author = componentJson.user || componentJson.group || 'noname';
                                        name = componentJson.name || subdir || ('noname'+Date.now());
                                        componentJson.repo = componentUrl;
                                    }
                                    fs.writeFile(tempDir+'/component.json', JSON.stringify(componentJson, null, 4), function(err){
                                        if(err) return reject(err);
                                        else {
                                            var componentName = [author, name].join('/');
                                            var componentTargetDir = [COMPONENTS_DIR, componentName].join('/');
                                            // move component to components dir
                                            debug(WARN('moving '+tempDir+' to '+componentTargetDir))
                                            ncp(tempDir, componentTargetDir, function (err) {
                                                if (err) return reject(err);
                                                else {
                                                    //todo: remove temporary archive
                                                    util.rimraf(tempDir)
                                                    .then(function(){
                                                        return resolve(componentName);
                                                    })
                                                    .catch(function(){
                                                        return reject(err);
                                                    })
                                                }
                                            });
                                        }
                                    });
                                })
                                .catch(function(err){
                                    return reject(err);
                                })
                            }
                        });
                    }
                });
            });
        },
        install: function(path, name, opts) {
            return new Promise(function(resolve, reject){
            // debug('installing component', name, 'with options', opts, 'to', path);
            debug('installing component ' + name);
// console.log('installing component ' + name);
                var componentType = opts.type || 'web';
                var source = [COMPONENTS_DIR, name].join('/');
                if(!util.isDir(source)) {
                    // component doesn't exist in the local repo - this should not happen
                    // return reject(source+' doesn\'t exist');
                } else {
                    var subdir = 'components';// untyped components are handled as common components 
                    if(opts.type == 'web') subdir = ['public', 'components'].join('/');
                    var componentName = name.replace('\/', '_');
                    var destination = [path, subdir, componentName].join('/');
                    debug('installing component from ['+source+'] to ['+destination+']');
// console.log('installing component from ['+source+'] to ['+destination+']');
                    mkdirp(destination, function(err){
                        if(err) {
                            return reject(err);
                        } else {
                            ncp(source, destination, function (err) {
                                if (err) {
                                    return reject(err);
                                } else {
                                    if(opts.type == 'web') {
                                        // interpolate index.html in web components
                                        // var templateFilename = destination + '/index.html';
                                        var originalTemplateFilename = destination + '/index.html';
                                        var templateFilename = destination + '/index.revo';
                                        fs.rename(originalTemplateFilename, templateFilename, function(err) {
                                            if (err) throw err;
                                            else {
                                                fs.readFile(templateFilename, {encoding: 'utf8'}, function (err, content) {
                                                    if (err) throw err;
                                                    var outputContent = util.compileTemplate(content, opts.locals);
                                                    fs.writeFile(templateFilename, outputContent, function(err){
                                                        if (err) throw err;
                                                        return resolve(name);
                                                    });
                                                })
                                            }
                                        });
                                    }
                                    else {
                                        return resolve(name);
                                    }
                                }
                            });
                        }
                    });
                }
            });
        },
        // publishToLocalRepo: function(componentPath, repoPath) {
        //     var source = componentPath;
        //     var name = this.shortFilename(componentPath);
        //     var destination = repoPath + '/components/' + name;
        //     if(fs.existsSync(source)) {
        //         ncp(source, destination, function (err) {
        //             if (err) throw err
        //             log.info(name+' component installed in the local repo at '+repoPath, 6);
        //         });
        //     }
        // },
        getJson: function(name) {
            var ret = {};
            var componentJsonFilename = [COMPONENTS_DIR, name,'component'].join('/')+'.json';
            if (fs.existsSync(componentJsonFilename)) {
                var content = fs.readFileSync(componentJsonFilename);
                ret = JSON.parse(content);
            }
            return ret;
        },
        remove: function(componentName){
            var componentDir = [LOCAL_COMPONENTS_REPO, componentName].join('/');
            if(util.isDir(componentDir)) {
                return util.rimraf(componentDir);
            } else {
                return Promise.reject(new Error(componentName+' not installed in local repo'));
            }
        }
    },

    web: {
        theme: {
            load: function(themedir){
                themedir = require('path').resolve(themedir);
                return new Promise(function(resolve, reject){
                    if(util.isDir(themedir)) {
                        var source = require('path').normalize(themedir);
                        var destination = require('path').normalize([LOCAL_THEMES_REPO, util.shortFilename(themedir)].join('/'));
                        ncp(source, destination, function (err) {
                            if (err) {
                                return reject(err);
                            } else {
                                return resolve(destination);
                            }
                        });
                    } else {
                        return reject(themedir, 'has to be a directory');
                    }
                });
            },
            install: function(path, theme) {
                return new Promise(function(resolve, reject){
                    var isRemote = !!theme.url;
                    var isLocal = !!theme.dir;
                    if(isRemote) {
                        return fetchTheme(theme).then(installTheme);
                    } else if(isLocal) {
                        var localThemeDir = theme.dir;
                        if(util.isDir(localThemeDir)) {
                            installThemeFromDir(localThemeDir, path, theme)
                            .then(function(location){
                                return resolve(location);
                            })
                        } else {
                            return reject('Directory '+theme.dir+' not found.');
                        }
                    } else {
                        var themeName = theme.name || 'noname';
                        var templateRelativePath = (!!theme.zip_path) ? [themeName, theme.zip_path].join('/') : themeName;
                        var localThemeDir = [THEMES_DIR, templateRelativePath].join('/');
                        if(util.isDir(localThemeDir)) {
                            installTheme(path, theme)
                            .then(function(location){
                                return resolve(location);
                            })
                        } else {
                            return reject('Theme '+themeName+' is not available in local repo');
                        }
                    }
                });
            }
        }
    },

    getNpmCache: function(module){
        return new Promise(function (resolve, reject) {
            npm.load({ prefix: DOWNLOAD_DIR_SHORT }, function (er, npm) {
                npm.commands.list([module], true, function(err, info){
                    if(info.dependencies[module]) {
                        debug(module, 'cached at', info.dependencies[module].realPath);
                        if(err) return reject(err);
                        return resolve(info.dependencies[module].realPath);
                    } else {
                        debug(module, 'not installed. installing now');
                        npm.commands.install([module], function(err){
                            npm.commands.list([module], true, function(err, info){
                                if(info.dependencies[module]) {
                                    debug(module+' is now available at '+info.dependencies[module].realPath);
                                    if(err) return reject(err);
                                    else return resolve(info.dependencies[module].realPath);
                                }
                            });
                        });
                    }
                });
            });
        });
    },

    installDependency: function(path, module, moduleCachedPath) {
        return new Promise(function(resolve, reject){
            var source = moduleCachedPath;//[DOWNLOAD_DIR, "node_modules", module].join('/');
            var destination = [path, 'node_modules', module].join('/');
            debug('installing dependency from', source);
            ncp(source, destination, function (err) {
                if (err) {
                    return reject(err);
                } else {
                    return resolve(destination);
                }
            });
        });
    }

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

//todo: extract into theme model 
function fetchTheme(theme){
    return new Promise(function (resolve, reject) {
        var themeName = theme.name || 'noname';
        var themeTargetDir = [THEMES_DIR, themeName].join('/');
        // var ret = (theme.zip_path) ? [theme.name, theme.zip_path].join('/') : theme.name;
        var ret = false;
        fs.statAsync(themeTargetDir).then(function(){
            debug('theme cached locally');
            return resolve(ret);
        }).catch(function(){
            ret = true;
            debug('theme doesn\'t exist, fetching theme from', theme.url);
            var targetFile = [DOWNLOAD_DIR, uuid.v4()].join('/');
            // var r = request(theme.url).pipe(fs.createWriteStream(targetFile));
// console.log('fetching to', targetFile, 'from:', theme.url);
            request({
                method: 'GET',
                uri: theme.url
            })
            // .get(theme.url)
            .on('error', function(err) {
                debug('error downloading theme from', theme.url);
                return reject(err);
            })
            .on('finish', function () {
                debug('download complete, unzipping...');
                zip = new Zip(targetFile);
                zip.extractAllTo(themeTargetDir, true);//overwrite existing
                return resolve(ret);
            })
            .pipe(fs.createWriteStream(targetFile));
        });
    });
}

function installTheme(path, theme) {
    return new Promise(function (resolve, reject) {
        var themeName = theme.name || 'noname';
        var templateRelativePath = (theme.zip_path) ? [themeName, theme.zip_path].join('/') : themeName;
        var source = [THEMES_DIR, templateRelativePath].join('/');
        var destination = [path, 'public'].join('/');
        debug('installing theme from', source);
        ncp(source, destination, function (err) {
            if (err) {
                return reject(err);
            } else {
                return resolve(destination);
            }
        });
    });
}

function installThemeFromDir(dir, path, theme) {
    return new Promise(function (resolve, reject) {
        var source = dir;
        var destination = [path, 'public'].join('/');
        debug('installing theme from', source);
        ncp(source, destination, function (err) {
            if (err) {
                return reject(err);
            } else {
                return resolve(destination);
            }
        });
    });
}