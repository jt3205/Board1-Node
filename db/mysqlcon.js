var mysql = require('mysql');

var client = mysql.createConnection({
	host : 'www.gmsgondr.net',
	user:'info3',
	password:'1234',
	database:'info3'
});
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