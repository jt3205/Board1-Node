var express = require('express');

var http = require('http');
var path = require('path');
var fs = require('fs');
var formidable = require('formidable');
// var viewsCache = {};
// var randString = require('./randString.js');
// var mailer = require('./mailer.js');

var options = {textPerPage:5, pagePerChapter:3}

var app = express();
var port = 3242;

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

app.get('/', function (req, res) {
	res.redirect('/page');
})

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

app.all('/board/:name?/:fun?/:id?', function (req, res) {
	var name = req.params.name;
	if(name === undefined){
		name = "freeboard";
	}
	var fun = req.params.fun;
	if(fun == undefined){
		fun = 'view';
	}

	var boardName = {freeboard:"자유게시판", notice:"공지사항"};

	if(boardName[name] == undefined){
		fun = "error";
	}
	console.log(fun);
	switch(fun){
		case "write":
			console.log(req.session.user);
			if(req.session.user !== undefined){
				return res.render('writeboard', {header:boardName[name], bindex:'freeboard', fun:'writeprocess'});
			}else{
				req.session.flashMsg = {type:'danger', msg:'로그인 후 글쓰기가 가능합니다'};
				return res.redirect('back');
			}
			break;
		case "writeprocess":
			if(req.session.user == undefined){
				req.session.flashMsg = {
					type:'danger',
					msg:'세션이 만료되었습니다. 다시 로그인해주세요'
				}
				return res.redirect(303, '/board/'+name+'/view');
			} else {
				var sql = 'INSERT INTO `' + name +'`(`title`, `content`, `date`, `uid`, `file`)	VALUES (? ,?, ?, ?, ?)';
				var date = new Date();
				var form = formidable.IncomingForm();

				form.parse(req, function (err, fields, files) {
					var uploadName = "";
					if(files.attachedFile.name != ''){
						var old_path = files.attachedFile.path;
						var file_size = files.attachedFile.size;
						var file_ext = files.attachedFile.name.split('.').pop(); // 확장자
						var index = old_path.lastIndexOf('/') + 1;
						var file_name = old_path.substr(index) + '.'+ file_ext;
						var new_path = path.join(__dirname, 'public/uploads', file_name);
						fs.readFile(old_path, function(err, data) {
							fs.writeFile(new_path, data, function(err) {
								fs.unlink(old_path, function(err) {
									if (err) {
										return res.render('error', {title:'파일처리 실패', msg:'파일처리중 에러 발생 : ' + err});
									} 
								});
							});
						});
						uploadName = '/uploads/' + file_name; //DB에 업로드할 이름을 지정
					}
					client.query(sql, [fields.title, fields.content, date, req.session.user.id, uploadName], function(error, result){
						if(error){
							res.render('error', {title:'DB에러(글삽입)', msg:error });
						}else{
							req.session.flashMsg = { type:'success', msg:'성공적으로 글이 작성되었습니다'};
							return res.redirect(303, '/board/' + name + '/list/1');
						}
					});
				});
			}
			break;
		case "list":
			var tpp = options.textPerPage;  //페이지당 글의 수
			var ppc = options.pagePerChapter; // 챕터당 페이지 수
			var nowPage = req.params.id; //현재 요청 페이지 받아오기.
			var totalCnt = 0;
			if(nowPage == undefined){
				nowPage = 1; //기본으로 1페이지를 보게한다.
			}
			var sql = 'SELECT count(wid) as totalCnt FROM `' + name +'`';  //전체 글의 개수를 가져온다.
			client.query(sql, function(error, result){
				if(error){
					res.render('error', {title:'DB에러(게시판 글 수 세기)', msg:error });
				}else{
					totalCnt = result[0].totalCnt; //글 개수 받아오고
					var totalPageCnt = Math.floor(totalCnt / tpp) + 1;
					if(totalCnt % tpp == 0 ) totalPageCnt -= 1; //나누어 떨어진다면 딱 그 페이지 만큼만
					
					var totalChapterCnt = Math.floor(totalPageCnt / ppc) + 1;
					if(totalPageCnt % ppc == 0) totalChapterCnt -= 1;
					
					var nowChapter = Math.floor(nowPage / (ppc+1));
					var start = (nowPage -1) * tpp;
					
					//1페이지 분량만큼 페이지 가져오기.
					sql = 'SELECT `wid`, `title`, `content`, `date`, b.`uid`, u.`name`, `file` FROM `'
						+ name +'` as b, `user` as u WHERE u.id = b.uid ORDER BY b.`wid` DESC LIMIT ?, ?';
					
					client.query(sql, [start, tpp], function(error, result){
						if(error){
							res.render('error', {title:'DB에러(게시판 리스트 받기)', msg:error });
						}else{
							res.render('boardlist', {
								title:boardName[name],
								data:result, 
								length:result.length,
								board:name, 
								page:nowPage,
								chapter:nowChapter,
								tpp:tpp,
								ppc:ppc,
								totalPage:totalPageCnt,
								totalChapter:totalChapterCnt
							});
						}
					});
				}
			});
			break;
		case "view":
			var wid = req.params.id;	//현재 요청한 글번호
			if(wid == undefined){
				return res.render('error', {title:'글번호 에러', msg:'요청하신 글이 존재하지 않습니다'})
			}
			var sql = 'SELECT `wid`, `title`, `content`, `date`, b.`uid`, u.`name`, `file` FROM `'+ name +'` as b,`user` as u WHERE u.id = b.uid AND b.wid = ?';
			client.query(sql, [wid], function (error, result) {
				if(error){
					return res.render('error', {title:'DB 에러 (글정보 로딩)', msg:error});
				} else {
					if(result.length == 1){
						var isWriter = false;
						console.log(req.session.user);
						console.log(result[0]);
						if(req.session.user != undefined && req.session.user.id == result[0].uid){
							isWriter = true;
						}
						res.render('viewboard', {data:result[0], writer:isWriter, board:name});
					}else{
						req.session.flashMsg = { type:'warning', msg:'해당하는 글이 없습니다.'};
						return res.redirect('back');
					}
				}
			});
			break;
		case "mod":
			if(req.session.uid == undefined){ //로그인되어 있지 않다면 수정할 수 없다.
				req.session.flashMsg = { type:'warning', msg:'글을 수정할 권한이 없습니다.'};
				return res.redirect('back');
			}
			var wid = req.params.id;
			if(wid == undefined){
				req.session.flashMsg = { type:'warning', msg:'잘못된 요청입니다.'};
				return res.redirect('back');
			}
			var sql = 'SELECT `wid`, `title`, `content`, `date`, b.`uid`, u.`uname`, `file` FROM `'
				+ name +'` as b,`user` as u WHERE u.uid = b.uid AND b.wid = ?';
				
			DB.client.query(sql, [wid], function(error, result){
				if(error){
					return res.render('error', {title:'DB 에러(글정보 로딩)', msg:error});
				}else {
					if(result.length == 1){
						if(result[0].uid != req.session.uid){  //다른 세션으로 수정요청시
							req.session.flashMsg = { type:'warning', msg:'글을 수정할 권한이 없습니다.'};
							return res.redirect('back');
						}else {
							var content = result[0].content;
							var title = result[0].title;
							
							return res.render('writeboard',
								{header:boardName[name], bindex:name, fun:'modprocess/'+wid, 
								con:content, title:title});
						}
					}else {  //해당 글이 존재 하지 않을 때.
						req.session.flashMsg = { type:'warning', msg:'해당하는 글이 없습니다.'};
						return res.redirect('back');
					}
				}
			});
			break;
		case 'modprocess':
			//글 수정 프로세스.
			if(req.session.user == undefined){ 	//로그인되어 있지 않다면 수정할 수 없다.
				req.session.flashMsg = { type:'warning', msg:'잘못된 요청입니다.'};
				return res.redirect('back');
			}
			var wid = req.params.id;
			if(wid == undefined){
				req.session.flashMsg = { type:'warning', msg:'해당하는 글이 없습니다.'};
				return res.redirect('back');
			}
			var sql = 'SELECT `uid`, `file` FROM `'	+ name +'` WHERE wid = ?';
			client.query(sql, [wid], function(error, result){
				if(error){
					return res.render('error', {title:'DB 에러(글정보 수정-1)', msg:error});
				}else {
					if(result.length == 1){
						if(result[0].uid != req.session.user.id){  //다른 세션으로 수정요청시
							req.session.flashMsg = { type:'warning', msg:'글을 수정할 권한이 없습니다.'};
							return res.redirect('back');
						}else {
							//여기에 수정코드
							var date = new Date();
							var form = formidable.IncomingForm();
							
							form.parse(req, function(err, fields, files){
								var uploadName = "";
								if(files.attachedFile.name != ''){ //파일이 업로드 되었을 경우
									var old_path = files.attachedFile.path, file_size = files.attachedFile.size,
										file_ext = files.attachedFile.name.split('.').pop(),
										//pop은 배열의 맨 마지막 요소를 추출함. 맨 앞을 추출할 때는 shift
										index = old_path.lastIndexOf('/') + 1, 
										file_name = old_path.substr(index) + '.' + file_ext, 
										//임시 파일명으로 그대로 업로드.
										new_path = path.join(__dirname,'../public/uploads/', file_name);
								
									fs.readFile(old_path, function(err, data) {
										fs.writeFile(new_path, data, function(err) {
											fs.unlink(old_path, function(err) {
												if (err) {
													return res.render('error', {title:'파일처리 실패', msg:'파일처리중 에러 발생 : ' + err});
												} 
											});
										});
									});
									uploadName = '/uploads/' + file_name; //DB에 업로드할 이름을 지정
								}
								var sql = 'UPDATE `' + name + '` SET `title` = ?, `content` = ?, `date` = ?';
								if(uploadName != ''){
									sql += ", `file` = '"+ uploadName + "'";
								}
								sql += ' WHERE `wid` = ?';
								client.query(sql, [fields.title, fields.content, date, wid], function(error, result){
									if(error){
										res.render('error', {title:'DB에러(글수정)', msg:error });
									}else{
										req.session.flashMsg = { type:'success', msg:'성공적으로 글이 수정되었습니다'};
										return res.redirect(303, '/board/' + name + '/view/' + wid);
									}
								});
							});
							
						}
					}else {  //해당 글이 존재 하지 않을 때.
						req.session.flashMsg = { type:'warning', msg:'해당하는 글이 없습니다.'};
						return res.redirect('back');
					}
				}
			});
			break;
		case 'del':
			var wid = req.params.id;
			if(req.session.user == undefined || wid == undefined){
				req.session.rlashMsg = {type:'warning', msg:'잘못된 요청입니다'};
				return res.redirect('back');
			}
			var sql = 'SELECT `uid`, `file` FROM `'	+ name +'` WHERE wid = ?';
			client.query(sql, [wid], function (error, result) {
				if(error){
					return res.render('error', {title:'DB 에러(글정보 수정-1)', msg:error});
				} else {
					if(result.length == 1){
						if(result[0].uid == req.session.user.id){
							sql = "DELETE FROM `" + name + '` WHERE `wid` = ?';
							client.query(sql, [wid], function (error, result) {
								if(error){
									return res.render('error', {title:'DB 에러(글삭제)', msg:error});
								} else {
									req.session.flashMsg = { type:'success', msg:'글을 성공적으로 삭제하였습니다.'};
									return res.redirect(303, '/board/' + name + '/list/1');
								}
							});
						} else {							
							req.session.flashMsg = { type:'warning', msg:'글을 수정할 권한이 없습니다.'};
							return res.redirect('back');
						}
					}else{
						req.session.flashMsg = { type:'warning', msg:'해당하는 글이 없습니다.'};
						return res.redirect('back');

					}
				}
			});
			break;
		default:
			return res.render('error', {title:'잘못된 요청', msg:'잘못된 요청입니다'});
			break;
	}
});

app.listen(port, function () {
	console.log('Express 엔진이 port '+ port +'에서 실행중입니다.')
});