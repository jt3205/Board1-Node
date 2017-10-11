var mysql = require('mysql');

var client = mysql.createConnection({
	host : '',
	user:'',
	password:'',
	database:''
})
client.connect(function (err) {
	client.query('Select * from user', function (err, result, fields) {
		if(err){
			console.log('[[ ------------ 에러남 ------------ ]]');
			console.log(err)
			console.log('[[ ------------ 에러남 ------------ ]]');
		}
		else{
			console.log(result);
		}
	});
});
