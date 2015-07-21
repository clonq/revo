#!/usr/bin/env node
'use strict';
var pkg = require('./package.json'),
    debug = require('debug')('revo:'),
    fs = require('fs'),
    _ = require('underscore'),
    S = require('string'),
    // program = require('commander'),
    yaml = require('js-yaml'),
    scp = require('scp'),
    container = require('./lib/container'),
    appService = require('./lib/services/appService'),
    component = require('./lib/component'),
    util = require('./lib/util'),
    repoManager = require('./lib/repo');

var yargs = require('yargs')
    .usage('Usage: revo <command> <args> [options]')
    .command('create', 'create a revo application')
    .demand(2)
    .option('f', {
        alias: 'force',
        demand: false,
        // default: false,
        describe: 'force creating an app in an existing directory'
        // type: 'boolean'
    })
    .option('r', {
        alias: 'recipe',
        demand: false,
        describe: 'use a recipe to generate an app'
        // type: 'string'
    })
    .command('package', 'package an existing revo application')
    .option('d', {
        alias: 'destination',
        demand: false,
        // default: false,
        describe: 'set the destination directory for the packaged app'
        // type: 'boolean'
    })
    .option('t', {
        alias: 'target',
        demand: false,
        // default: false,
        describe: 'the deployment target (must be declared in the recipe)'
        // type: 'boolean'
    })
    .command('deploy', 'deploy an existing revo application')

var argv = yargs.argv,
    command = argv._[0];

if(command === 'create') {
    var opts = {
        appName: argv._[1],
        recipeFile: argv.recipe,
        // components: program.components,
        // data: program.data,
        force: argv.force
    };
    appService.generateApp(opts);
} else if(command === 'package') {
    var opts = {
        appName: argv._[1],
        destination: argv.destination
    };
    appService.packageApp(opts);
} else if(command === 'deploy') {
    var opts = {
        appName: argv._[1],
        recipeFile: argv.recipe,
        deploymentTarget: argv.target
    };
    appService.deployApp(opts);
} else {
    yargs.showHelp();    
}

/*
program
    .version(pkg.version)
    .usage('[command] [args] [options]')
    .option('-c, --components <components>', 'add <components> to an application. Use commas to separate the component names in the list')
    .option('-d, --data <files>', 'copy <files> to the data folder. Use commas to separate the file names in the list')
    .option('-f, --force', 'force on non-empty directory')
    // .option('-C, --config <config>', 'use components <config> file')
    .option('-r, --recipe <recipe>', 'load options from <recipe>. Overrides any options from the command line')

program  
    .command('create [app_name]')
    .description('create a revo application')
    .action(function(appName){
        var opts = {
            appName: appName,
            recipeFile: program.recipe,
            components: program.components,
            data: program.data,
            force: !!program.force
        };
        appService.generateApp(opts);
    })

program  
    .command('run [config]')
    .description('start a revo application defined in <config>')
    .action(function(config){
        console.log('Starting revo container using config file:', config);
        container.init(config);
        container.start(config);
    })

program  
    .command('deploy <app> <env>')
    .description('deploy the application in the <app> directory')
    .action(function(app, env){
        var dir = __dirname + '/../' + app;
        try {
            var stats = fs.lstatSync(dir);
            if(!stats.isDirectory()) util.abort('no such app, aborting', 3);
            else {
                try {
                    var doc = yaml.safeLoad(fs.readFileSync(__dirname + '/../targets.yaml', 'utf8'));
                    var cfg = doc.targets[env]
                    cfg.path = S(cfg.path).ensureRight('/').s + app.substring(app.lastIndexOf('/')+1);
                    var files = util.getFiles(dir);
                    console.log('copying files to', cfg.host+':'+cfg.path);
                    for(var i=0; i<files.length; i++) {
                        var file = dir + '/' + files[i];
                        scp.send({file:file, user:cfg.user, host:cfg.host, path:cfg.path });
                    }
                    var dirs = util.getDirs(dir);
                    for(var i=0; i<dirs.length; i++) {
                        var subdir = dir + '/' + dirs[i];
                        if(dirs[i] != 'node_modules') scp.send({file:subdir , user:cfg.user, host:cfg.host, path:cfg.path });
                    }
                } catch(err) {
                    util.abort(err, 3);
                }
            }
        } catch (err) {
            util.abort(app+' directory not found, aborting', 3);
        }
    })

program  
    .command('component [name]')
    .description('generate the skeleton of a component in components/[name]')
    .action(function(name){
        var path = __dirname+'/../components/'+name;
        util.emptyDirectory(path, function(empty){
            if (empty || program.force) component.create({name:name});
            else util.abort('destination is not empty, aborting', 3);
        });
    });

program  
    .command('publish <dir> [repo]')
    .description('push the component in the <dir> directory to one of repos declared in config.')
    .action(function(dirName, repoName){
        if(util.isDir(dirName)) {
            var repos = repoManager.init();
            var repo = repos[repoName];
            if(repo) {
                console.log('publishing component from', dirName, 'to', repo.type, 'repo', '"'+repoName+'"', 'at', repo.location);
                repoManager.publishComponentToLocalRepo(dirName, repo.location);
            } else {
                util.abort(repoName + ' not found in repos.json, aborting', 3);
            }
        } else {
            util.abort(dir + ' not found, aborting', 3);
        }
    });

program.parse(process.argv);

if(program.args.length == 0) program.help()

*/
