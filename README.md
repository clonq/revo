revo
===

revo is an app container that discovers, retrieves & launches fine-grained event-driven components. somewhat like docker for app components. It allows building new apps by simply declaring the components required - or use the AI to determine that for you ;)

create an app
===

###app skeleton
````
$ revo create myapp
````

Generates an empty app called myapp, no components or any data files added

###using a recipe

````
$ revo create myapp -r myrecipe.json
````

Generates an using myrecipe.json recipe file


install
===
npm install revo

