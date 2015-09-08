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
        var components = repoService.component.list();
        if(!!components.length) {
            var rows = [];
            components.forEach(function(component){
                var name = component.name;
                var version = S(component.version).truncate(8).s;
                var type = S(component.type).truncate(6).s;
                var author = S(component.author).truncate(10).s;
                var description = S(component.description).truncate(50).s;
                rows.push([name, version, type, author, description]);
            })
            this.log('');
            util.table(rows, ['Component Name', 'Version', 'Type', 'Author', 'Description']);
            this.log('');
        } else {
            this.log('There are no components in the local repo.');
        }
        cb();
    },
    search: function(args, cb){
        this.log(ERROR('not implemented'));
        cb();
    },
    pull: function(args, cb){
        var self = this;
        repoService.component.download(args.url)
        .then(function(componentName){
            self.log(componentName, 'component downloaded to local repo.');
            cb();
        }, function(err){
            self.log(ERROR(err));
            cb();
        })
    }
}

var app = {
    create: function(args, cb) {
        var self = this;
        var appName = args.app_name;
        var recipe = args.recipe || ((!!common.recipe) ? common.recipe.name : undefined);
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
                    common.recipe = recipe;
                    self.log(appName, 'app created in local repo.');
                    cb();
                // }, function(err){
                //     self.log(ERROR(err));
                //     cb();
                })
                .catch(function(err){
                    self.log(ERROR(err));
                    cb();
                })
            } else {
                this.log(ERROR(recipe, 'recipe is not available in the local repo.'));
                cb();
            }
        } else {
            this.log(ERROR('Please provide a recipe to create an app from.'));
            cb();
        }
    },
    deploy: function(args, cb) {
        this.log('TODO:', args.app, 'deployed');
        cb();
    },
    list: function(args, cb) {
require('debug')('test:test')('pppppppp')        
        var apps = repoService.app.list();
        if(!!apps.length) {
            var rows = [];
            apps.forEach(function(appName){
                rows.push([appName, 'local']);
            })
            this.log('');
            util.table(rows, ['Application Name', 'Repository']);
            this.log('');
        } else {
            this.log('There are no apps in the local repo.');
        }
        cb();
    },
    package: function(args, cb) {
        var location = args.location || process.cwd();
        var zip = appService.packageApp({appName: args.app_name, destination: location});
        this.log(args.app_name, 'has been packaged to', zip);
        cb();
    },
    run: function(args, cb) {
        this.log(ERROR('not implemented'));
        cb();
    },
    search: function(args, cb){
        this.log(ERROR('not implemented'));
        cb();
    },
    remove: function(args, cb){
        var self = this;
        repoService.app.remove(args.app_name)
        .then(function(recipe){
            self.log(args.app_name, 'app removed from local repo.');
            cb();
        }, function(err){
            self.log(ERROR(err));
            cb();
        });
    }
}

var recipe = {
    use: function(args, cb) {
        var recipeName = args.recipe;
        common.recipe = repoService.recipe.use(recipeName);
        common.recipe.name = common.recipe.name || recipeName; //old recipes don't have a name key
        this.log(recipeName, 'is now the current recipe.');
        cb();
    },
    list: function(args, cb){
        var recipes = repoService.recipe.list();
        if(!!recipes.length) {
            var rows = [];
            recipes.forEach(function(recipeName){
                var recipe = repoService.recipe.use(recipeName);
                recipe.description = recipe.description || '';
                recipe.platform = recipe.platform || { type: 'cli'};
                recipe.author = recipe.author || 'unknown';
                var name = recipe.name || recipeName;
                var version = !!recipe.version ? S(recipe.version).truncate(8).s : '?';
                var platform = S(recipe.platform.type).truncate(3).s;
                var author = S(recipe.author).truncate(10).s;
                var description = S(recipe.description).truncate(50).s;
                rows.push([name, version, platform, author, description]);
            })
            this.log('');
            util.table(rows, ['Recipe Name', 'Version', 'Platform', 'Author', 'Description']);
            this.log('');
        } else {
            this.log('There are no recipes in the local repo.');
        }
        cb();
    },
    pull: function(args, cb){
        var self = this;
        repoService.recipe.download(args.url)
        .then(function(recipe){
            self.log(recipe.name, 'downloaded to local repo.');
            cb();
        }, function(err){
            self.log(ERROR(err));
            cb();
        })
    },
    load: function(args, cb){
        var self = this;
        repoService.recipe.load(args.filename)
        .then(function(recipe){
            self.log(recipe.name, 'recipe is now available in the local repo.');
            cb();
        }, function(err){
            self.log(ERROR(err));
            cb();
        })
    },
    search: function(args, cb){
        this.log('TODO: search recipe...');
        cb();
    },
    show: function(args, cb){
        var recipeName;
        if(args.recipe) recipeName = args.recipe;
        else if(!!common.recipe) recipeName = common.recipe.name;
        if(!!recipeName) {
            repoService.recipe.show(recipeName);
        } else {
            this.log(ERROR('Recipe not provided and no current recipe is available.'));
        }
        cb();
    },
    create: function(args, cb) {
        var self = this;
        common.recipe = { name:args.recipe_name, version:'0.1.0', description:'' };
        //todo: check for name conflicts
        repoService.recipe.save(common.recipe)
        .then(function(recipe){
            self.log(common.recipe.name, 'recipe created in local repo.');
            self.log(JSON.stringify(common.recipe, null, 4));
            cb();
        }, function(err){
            self.log(ERROR(err));
            cb();
        })
    },
    set: function(args, cb) {
        var self = this;
        if(!!common.recipe) {
            var oldName;
            if(args.key == 'name') oldName = common.recipe.name;
            common.recipe[args.key] = args.value;
            repoService.recipe.save(common.recipe)
            .then(function(recipe){
                self.log(args.key, 'set to', args.value);
                if(!!oldName) repoService.recipe.remove(oldName);
                cb();
            }, function(err){
                self.log(ERROR(err));
                cb();
            })
        } else {
            this.log(ERROR('No current recipe. Create or load a recipe first.'))
            cb();
        }
    },
    remove: function(args, cb){
        var self = this;
        var recipeName;
        if(args.recipe) recipeName = args.recipe;
        else if(!!common.recipe) recipeName = common.recipe.name;
        if(!!recipeName) {
            repoService.recipe.remove(recipeName)
            .then(function(recipe){
                self.log(recipeName, 'recipe removed from local repo.');
                if(!!common.recipe) delete common.recipe;
                cb();
            }, function(err){
                self.log(ERROR(err));
                cb();
            })
        } else {
            this.log(ERROR('No current recipe. Create or load a recipe first.'));
            cb();
        }
    },
    components: {
        add: function(args, cb) {
            var self = this;
            if(!!common.recipe) {
                common.recipe.components = common.recipe.components || [];
                var componentName = args.component;
                var json = repoService.component.getJson(componentName);
                var isCommon = (Object.keys(json).length > 0) || (json.type == 'common');
                var componentType = isCommon ? 'common': 'web';
                var component = {};
                component[componentName] = { type: componentType };
                common.recipe.components.push(component);
                repoService.recipe.save(common.recipe)
                .then(function(recipe){
                    self.log(componentName, 'component added to', common.recipe.name);
                    cb();
                }, function(err){
                    self.log(ERROR(err));
                    cb();
                })
            } else {
                this.log(ERROR('No current recipe. Create or load a recipe first.'));
                cb();
            } 
        }
    }
}

var web = {
    theme: {
        load: function(args, cb){
            var self = this;
            repoService.web.theme.load(args.dir)
            .then(function(theme){
                self.log(theme, 'web theme is now available in the local repo.');
                cb();
            }, function(err){
                self.log(ERROR(err));
                cb();
            })
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
// vantage.command('app deploy <app_name>', 'Deploy a previously created app').action(app.deploy);
vantage.command('app list', 'Get a list of local apps').action(app.list);
// vantage.command('app run <app_name>', 'Run an existing app on the local host').action(app.run);
// vantage.command('app search <app_name>', 'Search for <app> in local and central repos').action(app.search);
vantage.command('app package <app_name>', 'extract <app_name> from the local repo into a zip file').action(app.package);
vantage.command('app remove <app_name>', 'Delete <app_name> from the local repo').action(app.remove);

// recipe command group
vantage.command('recipe create <recipe_name>', 'Create a new empty recipe and make it current').action(recipe.create);
vantage.command('recipe list', 'Get a list of local recipes').action(recipe.list);
vantage.command('recipe use <recipe>', 'Make <recipe> the current source for app creation, deployment, etc').action(recipe.use);
vantage.command('recipe load <filename>', 'Load a local <filename> recipe into the local repo').action(recipe.load);
vantage.command('recipe pull <url>', 'Fetch a recipe from <url> to local repo').action(recipe.pull);
// vantage.command('recipe search <recipe>', 'Search for <recipe> in local and central repos').action(recipe.search);
vantage.command('recipe show [recipe]', 'Show [recipe] or current recipe source').action(recipe.show);
vantage.command('recipe remove [recipe]', 'Delete the current or the specified [recipe] from the local repo').action(recipe.remove);
vantage.command('recipe set <key> <value>', 'Set recipe metadata. Used to set recipe name, description and version').action(recipe.set);
vantage.command('recipe add component <component>', 'Add <component> to current recipe').action(recipe.components.add);

// component command group
vantage.command('component list', 'Get a list of local components').action(component.list);
vantage.command('component pull <url>', 'Fetch a component from <url> to local repo').action(component.pull);
// vantage.command('component search <component>', 'Search for <component> in local and central repos').action(component.search);

vantage.command('web theme load <dir>', 'Register the web theme in <dir> with the local repo').action(web.theme.load);

repoService.init();

// vantage
//     .exec("help").then(function(){
        vantage
        .delimiter('revo '+pkg.version+':')
        .listen(9440)
        .show();
    // });
