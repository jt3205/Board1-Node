var express = require('express');

var http = require('http');
var path = require('path');

var app = express();
var port = 3000;

var credentials = require('./secret.js');

app.use(require('body-parser').urlencoded({extended: true}));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(require('cookie-parser')(credentials.cookieSecret));

app.use(require('express-session')({
	resave:false,
	saveUninitialized:false,
	secret:credentials.cookieSecret
}));

app.use(function (req, res, next) {
	if(req.session.flashMsg != undefined){
		res.locals.flash = req.session.flashMsg;
		delete req.session.flashMsg;
	}
	next();
});

var mysql = require('mysql');

var client = mysql.createConnection({
	host : 'www.gmsgondr.net',
	user:'info3',
	password:'1234',
	database:'info3'
});

app.use(express.static(path.join(__dirname,'public')));

app.get('/page', function(req, res){
	var isLogin = req.session.user != undefined ? true : false;
	var level;
	if(isLogin){
		level = req.session.user.level;
	} else {
		level = 0;
	}
	client.connect(function (err) {
		client.query('SELECT * FROM user', function(error, result, fields){
			if(error){
				console.log('쿼리에 오류가 발생했습니다');
				res.render('index', {flag:false});
			}else {
				res.render('index', {flag:true, data:result, login:isLogin, level:level});
			}
		});
	});
});

app.get('/post',function (req, res) {
	res.render('post');
});

app.post('/process-post', function (req, res) {
	var sql = "INSERT INTO `user`(`id`, `password`, `name`, `email`) VALUES('"+
			req.body.id + "', '" +
			req.body.pw + "', '" + 
			req.body.name + "', '" + 
			req.body.email + "');";
	client.query(sql, function (err, result) {
		if(err){
			res.render('result', {msg:err.code});
		} else {
			res.render('result', {msg:'성공적으로 입력되었습니다.'})
		}
	});
});

app.get('/del-process', function (req, res) {
	var sql = "Delete from user where id='"+req.query.id+"';";
	client.query(sql, function (err) {
		if(err){
			res.render('result', {msg:error.code});
		}else{
			res.redirect(303, '/page');
		}
	});
});

app.post('/process-login', function (req, res) {
	var sql = "Select * from user where id='"+req.body.id+
			  "' and password='"+req.body.pw+"';";
	client.query(sql, function (err, result) {
		if(err){
			res.render('result', {msg:err.code});
		} else {
			if(result.length == 1){
				req.session.user = result[0];
				res.redirect(303, '/page');
			} else {
				res.render('result', {msg:'아이디나 비밀번호가 올바르지 않습니다.'})
			}
		}
	});
});

app.get('/login', function(req, res){
	res.render('login');
});

app.get('/log-out', function (req, res) {
	delete req.session.user;
	req.session.flashMsg = {
		type:'success',
		msg:'로그아웃 되었습니다'
	}
	res.redirect(303, '/page');
});

app.listen(port, function () {
	console.log('Express 엔진이 port '+ port +'에서 실행중입니다.')
});