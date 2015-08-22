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
    app deploy <app_name>                     Deploy a previously created app
    app list                                  Get a list of local apps
    app run <app_name>                        Run an existing app on the local host
    app search <app_name>                     Search for <app> in local and central repos


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

An application recipe can be stored on any server but in order to create an application, you need a copy of the recipe in the local repo.

Let's fetch a basic recipe from github:

```

```

Type `recipe list` to show a list of available recipes avaiable in your local repository:

```
revo 0.5.0: recipe list

Recipe Name  Version  Platform  Author   Description

hello-world  1.0.0    web       revo     basic Hello World recipe
	
```

The "hello-world" recipe has been successfully downloaded to your local repo. Let's use it to build a new app. Type `app create myapp hello-world` to create a new application named "myapp" using the "hello-world" recipe: 

```
revo 0.5.0: app create myapp hello-world
Using local recipe: hello-world
myapp app created in local repo
```

To verify the application was created, type `app list`:

```
revo 0.5.0: app list

Application Name  Repository

myapp             local
```

The app is now available in the local repo. To retrieve it from the repo just type `app package`:

```
revo 0.5.0: app package myapp
myapp has been packaged to /revo/demo/myapp.zip
```

---

![](https://travis-ci.org/clonq/revo.svg?branch=master)
[![Bitdeli Badge](https://d2weczhvl823v0.cloudfront.net/clonq/revo/trend.png)](https://bitdeli.com/free "Bitdeli Badge")
