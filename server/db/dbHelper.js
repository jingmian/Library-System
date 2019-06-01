'use strict'

const Express = require('express');
const router = Express.Router();
const db = require('./connect.js');
const memcached = require('../middleware/memcached.js')
const createToken = require('../middleware/createToken.js');
const checkToken = require('../middleware/checkToken.js');
const common = require('../middleware/common.js');


var crypto = require('crypto');

var speakeasy = require('speakeasy')
var QRCode = require('qrcode')

var salt = "abcdefghijklmnopqrstuvwxyz";
var txt = "123456";

const Login = (req, res) => {

	var md5 = crypto.createHash('md5');

	let validTime = '10s';
	let queryString = {
		sql: 'SELECT user_password, user_secret FROM user WHERE user_id=?',
		values: [req.body.username],
		timeout: 40000
	};

	if (req.body.willStore) {
		validTime = '168h';
	}
	
	// console.log(req.body);
	// md5.update(req.body.password);

	db.query(queryString, function(error, results, fields) {

		if (error) {
			console.log(error);
		}
		
		if (results) {
			// 防止code: 'ER_NOT_SUPPORTED_AUTH_MODE'类型错误
			if (!results[0]) {
				// 用户不存在
				console.log('Operation: Login, State: 404, Message: User not existed.');
				res.json({
					info: 404,
					success: false,
					message: 'User not exists.'
				});
			} else {
				// 如果有匹配的用户
				md5.update(req.body.password + salt);
				if (md5.digest('hex') == results[0].user_password) {
					// 密码正确
					console.log('Operation: Login, State: 200');

					// 储存用户信息到Memcached
					let jsonData = {
						user_id: req.body.username,
						login_time: common.getPresentTime()
					}
					memcached.set(req.body.username, JSON.stringify(jsonData));

					res.json({
						info: 200,
						success: true,
						path: '/userinfo',
						user_secret: new Boolean(results[0].user_secret),
						token: createToken(req.body.username, validTime)
					});	
				} else {
					// 密码错误
					console.log('Operation: Login, State: 304, Message: Wrong password.');
					res.json({
						info: 304,
						success: false,
						message: 'Wrong password.'
					});
				}
			}
		} else {
			console.log('Operation: Login, State: 504, Message: Unknown DB Fault.');
			res.json({
				info: 504,
				success: false,
				message: 'Unknown DB Fault.'
			});
		}
	});

};

const GetUserData = (req, res) => {

	// console.log(req.body)
	let queryString = {
		sql: 'SELECT * FROM user CROSS JOIN Identification WHERE user.user_identity=Identification.User_identity AND user_id=?',
		values: [req.body.username],
		timeout: 40000
	};

	db.query(queryString, function(error, results, fields) {

		if (error) {
			console.log(error)
		}

		if (results) {
			if (!results[0]) {
				console.log('Operation: Get User Data, State: 404, Message: User not existed.');
				res.json({
					info: 404,
					success: false,
					message: 'User not exists.'
				});
			} else {
				console.log('Operation: Get User Data, State: 200');
				res.json({
					info: 200,
					success: true,
					// user_name: results[0].User_Name,
					user_name: '张三', // 数据库表改动了的原因，user表没有名字了...
					user_id: results[0].user_id,
					user_identity: results[0].Identify_Name,
					max_borrow_num: results[0].Max_Borrow_Num,
					max_borrow_time: results[0].Max_Borrow_Time,
					user_secret: results[0].user_secret
				});
			}
		} else {
			console.log('Operation: Get User Data, State: 504, Message: Unknown DB Fault.');
			res.json({
				info: 504,
				success: false,
				message: 'Unknown DB Fault.'
			});
		}
	});

};

const ChangePassword = (req, res) => {

	// console.log(req.body)

	var md5 = crypto.createHash('md5');

	let queryString_request = {
		sql: 'SELECT user_password AS solution FROM user WHERE user_id=?',
		values: [req.body.username],
		timeout: 40000
	};


	db.query(queryString_request, function(error, results, fields) {

		if (error) {
			console.log(error)
		}

		if (results) {
			if (!results[0]) {
				// 用户不存在
				console.log('Operation: Change Password, State: 404, Message: User not exists.');
				res.json({
					info: 404,
					success: false,
					message: 'User not exists.'
				});
			} else {
				md5.update(req.body.oldPassword + salt);
				// console.log(results[0])
				if (md5.digest('hex') == results[0].solution) {
					// 旧密码正确
					md5 = crypto.createHash('md5')
					md5.update(req.body.newPassword + salt);
					let queryString_update = {
						sql: 'UPDATE user SET user_password=? WHERE user_id=?',
						values: [md5.digest('hex'), req.body.username],
						timeout: 40000
					};

					db.query(queryString_update, function(error, results, fields) {
						if (error) {
							console.log(error)
						}
						if (results) {
							console.log('Operation: Change Password, State: 200');
							res.json({
								info: 200,
								success: true
							});
						} else {
							// 查询失败
							console.log('Operation: Change Password, State: 504, Message: Unknown DB Fault.');
							res.json({
								info: 504,
								success: false,
								message: 'Unknown DB Fault.'
							});
						}
					});
				} else {
					// 旧密码错误
					console.log('Operation: Change Password, State: 304, Message: Wrong Password.');
					res.json({
						info: 304,
						success: false,
						message: 'Wrong Password.'
					});
				}
			}
		} else {
			// 查询失败
			console.log('Operation: Change Password, State: 504, Message: Unknown DB Fault.');
			res.json({
				info: 504,
				success: false,
				message: 'Unknown DB Fault.'
			});
		}
	})
}

const SendVerify = (req, res) => {

	var secret = speakeasy.generateSecret({length: 20});

	let queryString = {
		sql: 'UPDATE user SET user_secret_temp=? WHERE user_id=?',
		values: [
			[secret.base32],
			[req.body.username]
		],
		timeout: 40000
	};

	db.query(queryString, function (error, results, fields) {

		if (error) {
			console.log(error)
		}

		QRCode.toDataURL(secret.otpauth_url, function (err, image_data) {
		
			if (err) {
				console.log(err)
			}
			
			res.json({
				image: image_data
			});

		});

	})
}

const Verify = (req, res) => {

	var verifyCode = req.body.verifyCode

	let queryString = {
		sql: 'SELECT user_secret FROM user WHERE user_id=?',
		values: [req.body.username],
		timeout: 40000
	}

	if (req.body.first) {
		queryString.sql = 'SELECT user_secret_temp FROM user WHERE user_id=?'
	}
	
	db.query(queryString, function (error, results, fields) {

		if (error) {
			console.log(error)
		}

		if (results) {
			if (results[0]) {
				var secret = ''

				if (req.body.first) {
					secret = results[0].user_secret_temp
				} else {
					secret = results[0].user_secret
				}

				var token = speakeasy.totp({
					secret: secret,
					encoding: 'base32'
				});

				// console.log(secret)

				if (verifyCode == token) {
					if (req.body.first) {
						let queryString2 = {
							sql: 'UPDATE user SET user_secret=? WHERE user_id=?',
							values: [[secret], [req.body.username]],
							timeout: 40000
						};
						db.query(queryString2, function (error, results, fields) {
							if (error) {
								console.log(error)
							}
						});
						queryString2 = {
							sql: 'UPDATE user SET user_secret_temp=null WHERE user_id=?',
							values: [req.body.username],
							timeout: 40000
						};
						db.query(queryString2, function (error, results, fields) {
							if (error) {
								console.log(error)
							}
						});
						console.log('Operation: First Verify, State: 200');
					} else {
						console.log('Operation: Verify, State: 200');
					}
					res.json({
						info: 200,
						success: true
					});
				} else {
					console.log('Operation: Verify, State: 304, Message: Wrong Verify Code.');
					res.json({
						info: 304,
						success: false,
						message: 'Wrong Verify Code.'
					});
				}
			}
		} else {
			console.log('Operation: Verify, State: 504, Message: Unknown DB Fault.');
			res.json({
				info: 504,
				success: false,
				message: 'Unknown DB Fault.'
			});
		}

	});

}

const RemoveVerify = (req, res) => {
	let queryString = {
		sql: 'UPDATE user SET user_secret=null WHERE user_id=?',
		values: [req.body.username],
		timeout: 40000
	};

	db.query(queryString, function(error, results, fields) {

		if (error) {
			console.log(error)
		}

		if (results) {
			console.log('Operation: Remove Verify, State: 200');
			res.json({
				info: 200,
				success: true
			});
		} else {
			console.log('Operation: Remove Verify, State: 504, Message: Unknown DB Fault.');
			res.json({
				info: 504,
				success: false,
				message: 'Unknown DB Fault'
			});
		}
	});
}

// 管理员查看所有成员的一个月内最后登录日期
const GetActiveTime = (req, res) => {
	let queryString = {
		sql: 'SELECT user_id AS solution FROM user',
		timeout: 40000
	}
	db.query(queryString, function (error, results, fields) {
		if (error) {
			console.log(error)
		} else {
			let user_ids = new Array()
			results.forEach(function (result) {
				user_ids.push(result.solution)
			});
			memcached.getMulti(user_ids, function(errCache, rst) {
				if (errCache) {
					console.log(errCache)
				} else {
					// console.log(rst)
					res.json({
						info: 200,
						success: true,
						data: rst
					})					
				}

			})
		}
	})
}

module.exports = (router) => {

	router.post('/login', Login);

	router.post('/getUserData', GetUserData);

	router.post('/changePassword', ChangePassword);

	router.post('/sendVerify', SendVerify);

	router.post('/verify', Verify);

	router.post('/removeverify', RemoveVerify);

	router.post('/getActiveTime', GetActiveTime);

}
