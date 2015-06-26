
![](https://travis-ci.org/clonq/revo.svg?branch=master)
 
REVO
===

Assemble applications from recipes.

Sample recipe
===
```
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
 clonq/user/login:
  type: web
  handles: user:login
```

initializr/bootstrap is the web page layout which will be downloaded from the specified url. Placeholders are fragment insertion points.

clonq/user/login is a web ui component that is asynchronously loaded into the page via an available placeholder.


Assemble the app
===
Save the recipe to repo/recipes/myapp.yaml then run:

```
./revo.js create myapp -fr myapp
```

Start the new app
===
```
cd repo/apps/myapp && ./myapp
```

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

