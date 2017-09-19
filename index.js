var express = require('express');

var http = require('http');
var path = require('path');

var app = express();
var port = 3000;

app.use(require('body-parser').urlencoded({extended: true}));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

var mysql = require('mysql');

var client = mysql.createConnection({
	host : 'www.gmsgondr.net',
	user:'info3',
	password:'1234',
	database:'info3'
});

app.use(express.static(path.join(__dirname,'public')));

app.get('/page', function(req, res){
	client.connect(function (err) {
		client.query('SELECT * FROM user', function(error, result, fields){
			if(error){
				console.log('쿼리에 오류가 발생했습니다');
				res.render('index', {flag:false});
			}else {
				console.log(result);
				res.render('index', {flag:true, data:result});
			}
		});
	});
});

app.get('/post',function (req, res) {
	res.render('post');
});

app.post('/process-post', function(req, res){
	console.log(req.body);
});

app.post('/process-post', function (req, res) {
	var sql = "insert into 'user'('id','password','name','email') values('"+
			req.body.uid + "', password('" +
			req.body.upw + "'), '" + 
			req.body.uname + "', '" + 
			req.body.uemail + "')";
	client.query(sql, function (err, result) {
		if(err){
			res.render('result', {msg:err.code});
		}else {
			res.render('result', {msg:'성공적으로 입력되었습니다.'})
		}
	});
});

app.get('/del-process', function (req, res) {
	console.log(req.query.id);
	var sql = "Delete from 'user' where 'id' = '"+req.query.id+"'";
	client.query(sql, function (err) {
		if(err){
			res.render('result', {msg:error.code});
		}else{
			res.redirect(303, '/page');
		}
	});
});

app.listen(port, function () {
	console.log('Express 엔진이 port '+ port +'에서 실행중입니다.')
});