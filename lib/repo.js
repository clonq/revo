// const REPOS_CONFIG_FILENAME = './repos.json';
var config = require('config'),
    S = require('string'),
    util = require('./util'),
    fs = require('fs'),
    ncp = require('ncp').ncp,
    log = require('./logging');

//@todo infer from env and move it to constants.js
// const REVO_HOME = '/Users/ovi/projects/revo';

var repos = [];

module.exports = {

    // init: function(){
    //     var ret = {};
    //     try {
    //         require.resolve(REPOS_CONFIG_FILENAME);
    //         ret = require(REPOS_CONFIG_FILENAME);
    //     } catch (err) {
    //         util.abort('Cannot read ' + REPOS_CONFIG_FILENAME, 3);
    //     } finally {
    //         return ret;
    //     }
    // },

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

    installComponent: function(path, name) {
        var source = REVO_HOME + '/components/' + name;
        var destination = path + '/components/' + name;
        if(fs.existsSync(source)) {
            ncp(source, destination, function (err) {
                if (err) throw err
                log.info(name, 6);
            });
        } else {
            this.fetchComponent(name);
            // log.err(name + ' : unknown component', 6);
        }
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
    }


}
