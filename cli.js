#!/usr/bin/env node

var pkg = require('./package.json');
var vantage = require('vantage')();
var appService = require('./lib/services/appService');

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
        var appName = args.app_name;
        var recipe = args.recipe || common.recipe;
        if(!!recipe) {
            // this.log('App created from recipe', recipe);
            var opts = {
                appName: appName,
                recipeFile: recipe
                // force: argv.force
            };
            appService.generateApp(opts);
        } else {
            this.log(ERROR('No application recipe provided'));
            this.log(INFO('Use "app create <recipe>" or "recipe load <recipe>" to specify a recipe'));
        }
        cb();
    },
    deploy: function(args, cb) {
        this.log('TODO:', args.app, 'deployed');
        cb();
    },
    list: function(args, cb) {
        this.log('TODO: app list');
        cb();
    },
    run: function(args, cb) {
        this.log('TODO: running', args.app);
        cb();
    },
    search: function(args, cb){
        this.log('TODO: search app...');
        cb();
    }
}

var recipe = {
    load: function(args, cb) {
        this.log('TODO: using recipe', args.recipe);
        common.recipe = args.recipe;
        cb();
    },
    list: function(args, cb){
        this.log('TODO: recipe list');
        cb();
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
vantage.command('exit', 'Exits revo\'s interactive CLI.').action(function(args,cb){ process.exit() });
vantage.command('repl').hidden().action(function(args,cb){cb()});
vantage.command('use').hidden().action(function(args,cb){cb()});
vantage.command('vantage').hidden().action(function(args,cb){cb()});

// app command group
vantage.command('app create <app_name> [recipe]', 'Create a new app').action(app.create);
vantage.command('app deploy <app>', 'Deploy a previously created app').action(app.deploy);
vantage.command('app list', 'Get a list of local apps').action(app.list);
vantage.command('app run <app>', 'Run an existing app on the local host').action(app.run);
vantage.command('app search <app>', 'Search for <app> in local and central repos').action(app.search);

// recipe command group
vantage.command('recipe load <recipe>', 'Make <recipe> the current source for app creation, deployment, etc').action(recipe.load);
vantage.command('recipe list', 'Get a list of local recipes').action(recipe.list);
vantage.command('recipe search <recipe>', 'Search for <recipe> in local and central repos').action(recipe.search);
vantage.command('recipe show <recipe>', 'Show <recipe> source').action(recipe.show);
vantage.command('recipe add component <component>', 'Add <component> to current recipe').action(recipe.components.add);

// component command group
vantage.command('component list', 'Get a list of local components').action(component.list);
vantage.command('component search <component>', 'Search for <component> in local and central repos').action(component.search);


vantage
    .exec("help").then(function(){
        vantage
        .delimiter('revo '+pkg.version+':')
        .listen(9440)
        .show();
    })
