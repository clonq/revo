// const REPOS_CONFIG_FILENAME = './repos.json';
var debug = require('debug')('revo:repoService'),
    Promise = require('bluebird'),
    fs = Promise.promisifyAll(require('fs')),
    config = require('config'),
    request = require('request'),
    uuid = require('uuid'),
    S = require('string'),
    util = require('../util'),
    fs = require('fs'),
    mkdirp = require('mkdirp'),
    ncp = require('ncp').ncp,
    log = require('../logging'),
    Zip = require('adm-zip'),
    npm = require("npm");

// const REVO_HOME = config.home || __dirname.substring(0, __dirname.lastIndexOf('/')).substring(0, __dirname.lastIndexOf('/'));
var dir = __dirname;
dir = dir.substring(0, dir.lastIndexOf('/'));
dir = dir.substring(0, dir.lastIndexOf('/'));
const REVO_HOME = dir;
const LOCAL_REPO = REVO_HOME+'/repo/components';
const THEMES_DIR = REVO_HOME+'/repo/themes';
const COMPONENTS_DIR = REVO_HOME+'/repo/components';
const DOWNLOAD_DIR = REVO_HOME+'/repo/download';
const DOWNLOAD_DIR_SHORT = "repo/download";
const DEFAULT_COMPONENTS_REPO = 'http://localhost:10102';

const ERROR = require('chalk').red.bold;
const WARN = require('chalk').yellow.bold;
const INFO = require('chalk').green;

var repos = [];

module.exports = {

    web: {
        //todo: extract into theme model 
        fetchTheme: function(theme){
            return new Promise(function (resolve) {
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
                    var r = request(theme.url).pipe(fs.createWriteStream(targetFile));
                    r.on('finish', function () {
                        debug('download complete, unzipping...');
                        zip = new Zip(targetFile);
                        zip.extractAllTo(themeTargetDir, true);//overwrite existing
                        return resolve(ret);
                    });
                });
            });
        }
    },

    fetchComponent: function(component){
        return new Promise(function (resolve, reject) {
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
                var targetFile = [DOWNLOAD_DIR, uuid.v4()].join('/');
                var isError = false;
                var err;
                request({uri: componentUrl})
                // .get(componentUrl)
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

//     fetchComponent: function(name) {
//         var componentFound = false;
//         var componentFullPath;
//         for(var i=0; i<repos.length; i++) {
//             var repo = repos[i];
//             if(repo.type && (repo.type == 'local')) {
//                 try {
//                     componentFullPath = S(repo.path).ensureRight('/').s + 'components/' + name;
//                     require.resolve(componentFullPath);
//                     componentFound = true;
//                     if(componentFound) break;
//                 } catch(err) {
//                     // component not found, try next repo
//                 }
// // console.log('TODO: checking component at', repos.length, 'repositories')
//             }
//         }
//         if(componentFound) {
// console.log('component found at', componentFullPath);
//         } else {
// console.log('no component', name, 'found');
//         }
//     },

    // installComponent: function(path, name) {
    //     var source = REVO_HOME + '/components/' + name;
    //     var destination = path + '/components/' + name;
    //     if(fs.existsSync(source)) {
    //         ncp(source, destination, function (err) {
    //             if (err) throw err
    //             log.info(name, 6);
    //         });
    //     } else {
    //         this.fetchComponent(name);
    //         // log.err(name + ' : unknown component', 6);
    //     }
    // },

    installComponent: function(path, name, opts) {
        // debug('installing component', name, 'with options', opts, 'to', path);
        debug('installing component ' + name);
        return new Promise(function(resolve, reject){
            var componentType = opts.type || 'web';
            var source = [COMPONENTS_DIR, name].join('/');
            if(!util.isDir(source)) {
                return reject(source+' doesn\'t exist');
            } else {
                var subdir = 'components';// untyped components are handled as common components 
                if(opts.type == 'web') subdir = ['public', 'components'].join('/');
                var componentName = name.replace('\/', '_');
                var destination = [path, subdir, componentName].join('/');
                debug('installing component from ['+source+'] to ['+destination+']');
                mkdirp(destination, function(err){
                    if(err) reject(err);
                    else {
                        ncp(source, destination, function (err) {
                            if (err) return reject(err);
                            else {
                                return resolve(name);
                            }
                        });
                    }
                });
            }
        });
    },

    installTheme: function(path, theme) {
        return new Promise(function(resolve, reject){
            var themeName = theme.name || 'noname';
            var templateRelativePath = (theme.zip_path) ? [theme.name, theme.zip_path].join('/') : theme.name;
            var source = [THEMES_DIR, templateRelativePath].join('/');
            var destination = [path, 'public'].join('/');
            debug('installing theme from', source);
            ncp(source, destination, function (err) {
                if (err) reject(err);
                else {
                    return resolve(destination);
                }
            });
        });
    },

    installDependency: function(path, module, moduleCachedPath) {
        return new Promise(function(resolve, reject){
            var source = moduleCachedPath;//[DOWNLOAD_DIR, "node_modules", module].join('/');
            var destination = [path, 'node_modules', module].join('/');
            debug('installing dependency from', source);
            ncp(source, destination, function (err) {
                if (err) reject(err);
                else {
                    return resolve(destination);
                }
            });
        });
    },

    publishComponentToLocalRepo: function(componentPath, repoPath) {
        var source = componentPath;
        var name = this.shortFilename(componentPath);
        var destination = repoPath + '/components/' + name;
        if(fs.existsSync(source)) {
            ncp(source, destination, function (err) {
                if (err) throw err
                log.info(name+' component installed in the local repo at '+repoPath, 6);
            });
        }
    },

    getComponentJson: function(name) {
        var ret = {};
        var componentJsonFilename = [COMPONENTS_DIR, name,'component'].join('/')+'.json';
        if (fs.existsSync(componentJsonFilename)) {
            var content = fs.readFileSync(componentJsonFilename);
            ret = JSON.parse(content);
        }
        return ret;
    }

}
