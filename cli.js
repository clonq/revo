#!/usr/bin/env node

var pkg = require('./package.json');
var vantage = require('vantage')();
var appService = require('./lib/services/appService');
var repoService = require('./lib/services/repoService');
var util = require('./lib/util');
var S = require('string');

var ERROR = require('chalk').red.bold;
var WARN = require('chalk').yellow.bold;
var INFO = require('chalk').green;

var common = {};

var component = {
    list: function(args, cb){
        this.log('TODO: component list...');
        cb();
    },
    search: function(args, cb){
        this.log('TODO: search component...');
        cb();
    }
}

var app = {
    create: function(args, cb) {
        var self = this;
        var appName = args.app_name;
        var recipe = args.recipe || common.recipeName;
        if(!!recipe) {
            var recipeSrc = repoService.recipe.check(recipe);
            if(recipeSrc != 'unavailable') {
                if(!!args.recipe) {
                    this.log('Using', recipeSrc, 'recipe:', args.recipe);
                } else {
                    this.log('Using previously loaded recipe:', common.recipe);
                }
                var opts = {
                    appName: appName,
                    recipeFile: recipe,
                    force: !!args.options.force
                };
                appService
                .generateApp(opts)
                .then(function(recipe){
                    common.recipeName = recipe;
                    common.recipe = recipe;
                    self.log(appName, 'app created in local repo');
                    cb();
                }, function(err){
                    self.log(ERROR(err));
                    cb();
                });
            } else {
                this.log(ERROR(recipe, 'recipe is not available either in the local repo or the central hub'));
                cb();
            }
        } else {
            this.log(ERROR('Recipe not provided and no previously loaded recipe is available'));
            this.log(INFO('Use "app create <app_name> <recipe>" or "recipe load <recipe>" to specify a recipe'));
            cb();
        }
    },
    deploy: function(args, cb) {
        this.log('TODO:', args.app, 'deployed');
        cb();
    },
    list: function(args, cb) {
        var apps = repoService.app.list();
        if(!!apps.length) {
            var rows = [];
            apps.forEach(function(appName){
                rows.push([appName, 'local']);
            })
            util.table(rows, ['Application Name', 'Repository']);
        } else {
            this.log('There are no apps in the local repo');
        }
        cb();
    },
    package: function(args, cb) {
        var zip = appService.packageApp({appName: args.app_name, destination: args.location});
        this.log(args.app_name, 'has been packaged to', zip);
        cb();
    },
    run: function(args, cb) {
        this.log('TODO: running', args.app);
        cb();
    },
    search: function(args, cb){
        this.log('TODO: search app...');
        cb();
    },
}

var recipe = {
    load: function(args, cb) {
        this.log('TODO: using recipe', args.recipe);
        common.recipe = args.recipe;
        cb();
    },
    list: function(args, cb){
        var recipes = repoService.recipe.list();
        if(!!recipes.length) {
            var rows = [];
            recipes.forEach(function(recipeName){
                var recipe = repoService.recipe.load(recipeName);
                recipe.description = recipe.description || '';
                recipe.platform = recipe.platform || { type: 'cli'};
                recipe.author = recipe.author || 'unknown';
                var name = recipe.name || recipeName;
                var version = S(recipe.version).truncate(8).s;
                var platform = S(recipe.platform.type).truncate(3).s;
                var author = S(recipe.author).truncate(10).s;
                var description = S(recipe.description).truncate(50).s;
                rows.push([name, version, platform, author, description]);
            })
            this.log('');
            util.table(rows, ['Recipe Name', 'Version', 'Platform', 'Author', 'Description']);
            this.log('');
        } else {
            this.log('There are no recipes in the local repo');
        }
        cb();
    },
    pull: function(args, cb){
        var self = this;
        repoService.recipe.download(args.url)
        .then(function(recipe){
            self.log(recipe.name, 'downloaded to local repo');
            cb();
        }, function(){
            cb();
        })
    },
    search: function(args, cb){
        this.log('TODO: search recipe...');
        cb();
    },
    show: function(args, cb){
        this.log('TODO: show recipe...');
        cb();
    },
    components: {
        add: function(args, cb) {
            this.log('adding', args.component, 'to current recipe');
            cb();
        }    
    }
}

// disable default vantage menu
vantage.command('exit', 'Exits revo\'s interactive CLI.').action(function(args,cb){ this.log('See you soon'); process.exit() });
vantage.command('repl').hidden().action(function(args,cb){cb()});
vantage.command('use').hidden().action(function(args,cb){cb()});
vantage.command('vantage').hidden().action(function(args,cb){cb()});

// app command group
vantage
.command('app create <app_name> [recipe]', 'Create a new app <app_name> in the local repo')
.option('-f, --force ', 'force existing app ovewrite')
.action(app.create);
vantage.command('app deploy <app_name>', 'Deploy a previously created app').action(app.deploy);
vantage.command('app list', 'Get a list of local apps').action(app.list);
vantage.command('app run <app_name>', 'Run an existing app on the local host').action(app.run);
vantage.command('app search <app_name>', 'Search for <app> in local and central repos').action(app.search);
vantage.command('app package <app_name>', 'extract <app_name> from the local repo into a zip file').action(app.package);

// recipe command group
vantage.command('recipe list', 'Get a list of local recipes').action(recipe.list);
vantage.command('recipe load <recipe>', 'Make <recipe> the current source for app creation, deployment, etc').action(recipe.load);
vantage.command('recipe pull <url>', 'Fetch a recipe from <url> to local repo').action(recipe.pull);
vantage.command('recipe search <recipe>', 'Search for <recipe> in local and central repos').action(recipe.search);
vantage.command('recipe show <recipe>', 'Show <recipe> source').action(recipe.show);
vantage.command('recipe add component <component>', 'Add <component> to current recipe').action(recipe.components.add);

// component command group
vantage.command('component list', 'Get a list of local components').action(component.list);
vantage.command('component search <component>', 'Search for <component> in local and central repos').action(component.search);

repoService.init();

// vantage
//     .exec("help").then(function(){
        vantage
        .delimiter('revo '+pkg.version+':')
        .listen(9440)
        .show();
    // });
