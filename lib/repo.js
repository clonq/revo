// const REPOS_CONFIG_FILENAME = './repos.json';
var debug = require('debug')('revo:repo'),
    config = require('config'),
    S = require('string'),
    util = require('./util'),
    fs = require('fs'),
    ncp = require('ncp').ncp,
    log = require('./logging');

const REVO_HOME = config.home || __dirname.substring(0, __dirname.lastIndexOf('/'));
const LOCAL_REPO = REVO_HOME+'/repo/components';

var repos = [];

module.exports = {

    fetchComponent: function(name) {
        var componentFound = false;
        var componentFullPath;
        for(var i=0; i<repos.length; i++) {
            var repo = repos[i];
            if(repo.type && (repo.type == 'local')) {
                try {
                    componentFullPath = S(repo.path).ensureRight('/').s + 'components/' + name;
                    require.resolve(componentFullPath);
                    componentFound = true;
                    if(componentFound) break;
                } catch(err) {
                    // component not found, try next repo
                }
// console.log('TODO: checking component at', repos.length, 'repositories')
            }
        }
        if(componentFound) {
console.log('component found at', componentFullPath);
        } else {
console.log('no component', name, 'found');
        }
    },

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

    installComponent: function(path, name) {
        return new Promise(function(resolve, reject){
            var source = [LOCAL_REPO, name].join('/');
            var destination = [path, 'components', name].join('/');
            ncp(source, destination, function (err) {
                if (err) reject(err);
                else {
                    log.info(name, 6);
                    resolve(name);
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
        var componentJsonFilename = REVO_HOME + '/components/' + name + '/component.json'
        if (fs.existsSync(componentJsonFilename)) {
            var content = fs.readFileSync(componentJsonFilename);
            ret = JSON.parse(content);
        }
        return ret;
    }

}
