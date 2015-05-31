revo
===

revo is an app container that discovers, retrieves & launches fine-grained event-driven components. Build new apps by simply declaring the components required. The platform does the rest.

create an app
===

###App skeleton
````
$ revo create myapp
````

Generates an empty app called myapp, no components or any data files added

###Using a recipe

````
$ revo create myapp -f -r testrecipe
````

Generates an app using a recipe file named 'testrecipe'


###Sample recipe
```
title: Simple Login Recipe
version: 0.1.0
platform:
 type: web
 theme:
  name: initializr/bootstrap
  url: 'http://www.initializr.com/builder?boot-hero&jquerymin&h5bp-iecond&h5bp-chromeframe&h5bp-analytics&h5bp-favicon&h5bp-appletouchicons&modernizrrespond&izr-emptyscript&boot-css&boot-scripts'
  zip_path: initializr
  placeholders:
   - main: .jumbotron
components:
-
 dummy/bootstrap:
  type: common
  emit: dummy/login:load
  payload:
    placeholder: main
```

This recipe declares a web theme which becomes the web page layout. Placeholders are fragment insertion points. A component (dummy/bootstrap) can request a web ui component (dummy/login) to be asynchronously loaded into an available placeholder (main).

When revo parses this recipe, it downloads the template, installs the declared components and their dependencies, generates a package.json and configuration files and copy all these files into the target directory.

An new app created like this `revo create myapp -r testrecipe` can be started with `cd repo/apps/myapp && ./myapp` or `npm start`

###Components
Components can be locally created or stored in remote repos. Github and npm are both recognized as valid component repos. To declare a github-stored component in your recipe just add `repo: github` to the component configuration e.g.:

```
...
components:
-
 clonq/revo-user:
  type: common
  repo: github
...  
```

Revo will search for this component at https://github.com/clonq/revo-user/archive/master.zip. Alternatively, you may specify the component uri:

```
 clonq/revo-user:
  type: common
  uri: https://github.com/clonq/revo-user/archive/v1.zip
```

Install
===
npm install revo

