$(function(){
	$(document).on('click', '#dummy_login .loginBtn', function() {
		handle({
			action: 'login',
			model: 'user',
			data: {
				name: $('#dummy_login .user').val(),
				password: $('#dummy_login .pass').val()
			}
		});
	});
});
