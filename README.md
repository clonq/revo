
![](https://travis-ci.org/clonq/revo.svg?branch=master)
 
REVO
===

Assemble applications from recipes.

Sample web app recipe
===
```
platform:
 type: web
 theme:
  name: initializr/bootstrap
  url: '...'
  placeholders:
   - main: .jumbotron
components:
-
 mike/login:
  type: web
  handles: user:login
```
`theme` specifies the web page layout/template which is downloaded and cached. 

`placeholders` are fragment insertion points.

`components` are specialized modules that deal with a single application aspect (e.g. login ui, authentication, etc)  

Web components are asynchronously loaded and inserted into the web layout in one of the available placeholders.

Revo components can be stored locally or in remote repos and will be fetched if necessary when the app is assembled.


Assemble the app
===
Recipes should be saved in revo's local repo in the `recipes` folder as yaml files. To generate a complete node app from a recipe named `myrecipe` saved under `<revo_home>/repo/recipes/myrecipe.yaml`, provide the app name and the recipe as arguments to `revo create`:  

```
revo create <app_name> -r <recipe>
```

Start the new app
===
Once assembled, the new app is stored in `<revo_home>/repo/apps/<app_name>`. The app can be started using `npm start` or via the shell wrapper available and named after the app name.
 

Components
===
Developers could build new apps based only on the available components. Custom content needs to be provided by the application developer in the form  of themes or web components.

Custom components can also be created and saved in `<revo_home>/repo/components` or in github. To declare a github-stored component in your recipe just add `repo: github` to the component configuration e.g.:

```
...
components:
-
 clonq/revo-user:
  type: common
  repo: github
...  
```

Revo will search for this component at https://github.com/clonq/revo-user/archive/master.zip.


Installation
===
npm install revo



Component Design Guide
===
TODO
