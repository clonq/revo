const welcome_page = 'dummy_login'

$(function(){
    init();
});

function init() {
    nav.welcome();
}

var nav = {
    welcome: function(){
        $('.jumbotron').load(['components', welcome_page, 'index.html'].join('/'));
    }
}