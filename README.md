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

    recipe list             Get a list of local recipes
    recipe load <recipe>    Make <recipe> the current source for app creation, deployment, etc
    recipe pull <url>       Fetch a recipe from <url> to local repo
    recipe search <recipe>  Search for <recipe> in local and central repos
    recipe show <recipe>    Show <recipe> source

  Command Groups:

    recipe add *            1 sub-command.
```

An application recipe can be stored on any server but in order to create an application, you need a copy of the recipe in the local repo. Let's fetch a basic recipe from github:

```
revo 0.5.16: recipe pull https://raw.githubusercontent.com/clonq/revo-recipes/master/hello-world.yaml
recipe hello-world downloaded to local repo
```

Type `recipe list` to show the list of recipes avaiable in your local repository:

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

The app is now available in the local repo. To retrieve the app from the repository and package it as a standalone node.js application, use `app package`:

```
revo 0.5.0: app package myapp
myapp has been packaged to /revo/demo/myapp.zip
```
The app is now available as a zip file in your current directory. Exit revo, unzip the new app in the directory of your choice and run the app:

```
revo 0.5.0: exit
See you soon
MacBook:/revo/demo revo-user$ ls -al
...
-rw-r--r--   1 revo-user  staff   9.1M 22 Aug 11:42 myapp.zip
...
MacBook:/revo/demo revo-user$ tar xf myapp.zip
MacBook:/revo/demo revo-user$ cd myapp
MacBook:/revo/demo revo-user$ ./myapp

> myapp@1.0.0 start /revo/demo/myapp
> DEBUG=revo:* ./container/run

  revo:container web server v. 1.0.0 started on port 3000 +0ms
  revo:container Initializing components +6ms
  revo:container [dummy_bootstrap]	 loaded +2ms
  revo:container registering handler for revo/hello-world:load +1ms
  revo:container [dummy_bootstrap]	 initialized +0ms
  revo:container piggyback websocket server started +1ms

```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the Hello World web app.

Recipes
===
In the REVO world, you use recipes to create new applications. Recipes are .yaml files that describe how an application should be assembled from components. Let's have a look at the hello-world recipe. At revo prompt type `recipe show hello-world`:

```
revo 0.5.0: recipe show hello-world
{
    "name": "hello-world",
    "description": "basic Hello World recipe",
    "version": "1.0.0",
    "author": "revo",
    "platform": {
        "type": "web",
        "theme": {
            "name": "initializr/bootstrap",
            "url": "http://www.initializr.com/builder?boot-hero&jquerymin&h5bp-iecond&h5bp-chromeframe&h5bp-analytics&h5bp-favicon&h5bp-appletouchicons&modernizrrespond&izr-emptyscript&boot-css&boot-scripts",
            "zip_path": "initializr",
            "placeholders": [
                {
                    "main": ".jumbotron"
                },
                {
                    "login": "#navbar form"
                }
            ]
        }
    },
    "components": [
        {
            "clonq/revo-ui-bootstrap": {
                "type": "web",
                "repo": "github"
            }
        },
        {
            "revo/hello-world": {
                "type": "web"
            }
        }
    ],
    "config": {
        "clonq/revo-ui-bootstrap": {
            "load": "revo/hello-world",
            "remove": "nav"
        }
    }
}
```
The important sections in a recipe are: `platform`, `components` and `config`.

###Platform 
The `platform` key in a revo recipe describes and optionally configures some high level aspects of the application. The `type` sub-key informs the revo application generator module about the environment the generated application will run on and can have two values `cli` or `web`.

For web applications, a second `theme` sub-key defines the web theme or the web page layout. If the theme was created on developer's machine and thus already available in the local repo, a `name` key is enough to retrieve it and generate the web app page layout. The theme could be stored anywhere though and referenced via the `url` key. The hello-world recipe leverages [Initializr](http://www.initializr.com/)'s Bootstrap template.

When the `url` is present, revo downloads the theme locally, unpacks it and registers the template with the local repo for future references.

The `placeholders` key defines DOM elements that can be used by web components to inject their content into the web page. The hello-world component for example overwrites Bootstrap's original content of the .jumbotron div element.


---

![](https://travis-ci.org/clonq/revo.svg?branch=master)
<!--[![Bitdeli Badge](https://d2weczhvl823v0.cloudfront.net/clonq/revo/trend.png)](https://bitdeli.com/free "Bitdeli Badge")-->
