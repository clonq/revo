REVO
===

REVO is an open platform for building, deploying and running node.js applications. It allows programmers to assemble complex apps in minutes by reusing existing components.

Install REVO
===

```
$ npm install -g revo
```

Run REVO
===
```
$ sudo revo
revo 0.5.0: 
```
The new prompt shows that revo is running and accepting commands.

Type `help` to get the list of available commands. If everything runs well, the command’s output looks like this:

```
revo 0.5.0: help

  Commands:

    help [command]  Provides help for a given command.
    exit            Exits revo's interactive CLI.

  Command Groups:

    app *           5 sub-commands.
    recipe *        5 sub-commands.
    component *     2 sub-commands.
```
This message shows that your installation appears to be working correctly.

Let's try to create a simple application. Type `app` to get the list of application-specific sub-commands:

```
revo 0.5.0: app

  Commands:

    app create [options] <app_name> [recipe]  Create a new app <app_name> in the local repo
    app deploy <app>                          Deploy a previously created app
    app list                                  Get a list of local apps
    app run <app>                             Run an existing app on the local host
    app search <app>                          Search for <app> in local and central repos


```

To create an application you need a recipe. Let's switch to recipes for a second. Type `recipe` for the available recipe sub-commands:

```
revo 0.5.0: recipe

  Commands:

    recipe load <recipe>    Make <recipe> the current source for app creation, deployment, etc
    recipe list             Get a list of local recipes
    recipe search <recipe>  Search for <recipe> in local and central repos
    recipe show <recipe>    Show <recipe> source

  Command Groups:

    recipe add *            1 sub-command.
```

`recipe list` shows a list of available recipes in your local repository:

```
revo 0.5.0: recipe list

Recipe Name  Version  Platform  Author   Description

hello-world  1.0.0    web       revo     basic Hello World recipe
	
```

Let's use the "hello-world" recipe to build a new app. Type `app create myapp hello-world` to create a new application named "myapp" using the "hello-world" recipe: 

```
revo 0.5.0: app create myapp hello-world
Using local recipe: hello-world
myapp app created in local repo
```

Verify the application was created and available in the local repo by typing `app list`:

```
revo 0.5.0: app list

Application Name  Repository

myapp             local
```


---

![](https://travis-ci.org/clonq/revo.svg?branch=master)
[![Bitdeli Badge](https://d2weczhvl823v0.cloudfront.net/clonq/revo/trend.png)](https://bitdeli.com/free "Bitdeli Badge")
