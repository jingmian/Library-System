<!DOCTYPE html>

<template>
<div class="userinfo">

	<ul class="nav nav-tabs head-tabs">
		<li role="presentation" v-bind:class="{ activeTab: this.presentTab == 'profile' }" v-on:click="alterTab('profile')">
		 	<a>Profile</a>
		 </li>
		<li role="presentation" v-bind:class="{ activeTab: this.presentTab == 'safety' }" v-on:click="alterTab('safety')"">
		 	<a>Safety</a>
		</li>
		<li role="presentation" v-if="this.userdata.user_identity == '管理员'" v-bind:class="{ activeTab: this.presentTab == 'overview' }" v-on:click="getOverview()">
			<a>Overview</a>
		</li>
		<li role="presentation" v-bind:class="{ activeTab: this.presentTab == 'verify' }" v-on:click="alterTab('verify')"">
		 	<a>Verify</a>
		</li>
	</ul>

	<div v-if=" presentTab == 'profile' " class="ctn-userinfo">
	<form class="form-horizontal">
		<div class="form-group">
			<label for="" class=" info">Name:</label>
			<div class="userdata">
				<span> {{ this.userdata.user_name }}</span>
			</div>
		</div>
		<div class="form-group">
			<label for="" class=" info">User ID:</label>
			<div class="userdata">
				<span class="userdata"> {{ this.userdata.user_id }}</span>
			</div>
		</div>
		<div class="form-group">
			<label for="" class=" info">User Identity:</label>
			<div class="userdata">
				<span class="userdata"> {{ this.userdata.user_identity }}</span>
			</div>
		</div>
		<div class="form-group">
			<label for="" class=" info">Max Borrow Number:</label>
			<div class="userdata">
				<span class="userdata"> {{ this.userdata.max_borrow_num }}</span>
			</div>
		</div>
		<div class="form-group">
			<label for="" class=" info">Max Borrow Time:</label>
			<div class="userdata">
				<span class="userdata"> {{ this.userdata.max_borrow_time }}</span>
			</div>
		</div>
		<button type="botton" class="btn btn-login" v-on:click="logout">登出</button>
	</form>
	</div>

	<div v-else-if=" presentTab == 'safety' " class="stu-content">
		<form class="form-horizontal">
				<div class="form-group">
					<label class="col-md-5 control-label" name="oldPassword">Old Password:</label>
					<div class="col-md-5">
						<input type="password" class="form-control" placeholder="Old Password" v-model="alter.oldPassword">
					</div>
				</div>
				<div class="form-group">
					<label class="col-md-5 control-label" name="newPassword">New Password:</label>
					<div class="col-md-5">
						<input type="password" class="form-control" placeholder="New Password" v-model="alter.newPassword">
					</div>
				</div>
				<div class="form-group">
					<label class="col-md-5 control-label" name="checkPassword">Check Password:</label>
					<div class="col-md-5">
						<input type="password" class="form-control" placeholder="Check the New Password" v-model="alter.checkPassword">
					</div>
				</div>
				<button class="btn btn-login btn-doChange" v-on:click="submitChange()">提交</button>
			</form>
	</div>

	<div v-else-if=" presentTab == 'verify' " class="stu-content">
		<button v-if="needAuth" class="btn btn-login btn-doChange" v-on:click="goTo('/verify-first')">进行认证</button>
		<button v-else class="btn btn-login btn-doChange" v-on:click="doRemove()">关闭认证</button>
	</div>

	<div v-else-if=" presentTab == 'overview' " class="stu-content">
		<div class="library-userOverview">
			<table class="table table-bordered table-striped">
				<thead>
					<tr class="library-backColor-cyan">
						<th>用户名</th>
						<th>活跃日期</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="user in activeTimes">
						<td>{{user.user_id}}</td>
						<td>{{user.login_time}}</td>
					</tr>
				</tbody>
			</table>
		</div>
		<div class="alert alert-info">
			数据来自Memcached，每次重启后都会被清空。
		</div>
	</div>
</div>
</template>

<script>
import api from '../api.js'
import store from '../store'
export default {
	name: 'Userinfo',
	data: function () {
		return {
			presentTab: '',
			userdata: {
				user_name: '',
				user_id: '',
				user_identity: '',
				max_borrow_num: '',
				max_borrow_time: '',
				user_secret: ''
			},
			activeTimes: undefined,
			alter: {
				oldPassword: '',
				newPassword: '',
				checkPassword: ''
			}
		}
	},
	computed: {
		needAuth: function () {
			return !this.userdata.user_secret
		}
	},
	methods: {
		logout: function () {
			store.dispatch('logout')
			this.$router.push('/')
			this.$router.go(0)
		},
		alterTab: function ( path ) {
			this.presentTab = path
		},
		submitChange: function () {

			if (this.alter.newPassword == this.alter.checkPassword) {
				let opt = {
					username: JSON.parse(store.getters.showTokenState).username,
					oldPassword: this.alter.oldPassword,
					newPassword: this.alter.newPassword
				}
				// console.log(opt)
				api.changePassword(opt).then(({
					data
				}) => {
					if (data.info == 200) {
						alert('Successfully changed password.')
						this.alterTab('profile')
					} else {
						alert(data.message)
					}
				})
			} else {
				alert('Check password is not consistent.')
			}
			
		},
		getOverview: function () {
			this.alterTab('overview')
			if (!this.activeTimes) {
				api.getLastLoginTime().then(({
					data
				}) => {
					if (data.success) {
						this.activeTimes = data.data
					}
				})
			}
		},
		goTo: function ( route ) {
			this.$router.push(route)
		},
	    doRemove: function () {
	      let opt = {
	        username: JSON.parse(store.getters.showTokenState).username
	      }
	      api.removeVerify(opt).then(({
	        data
	      }) => {
	        if (data.info == 200) {
	          let user = {
	            username: JSON.parse(store.getters.showTokenState).username,
	            token: JSON.parse(store.getters.showTokenState).token,
	            verify: false
	          }
	          store.dispatch('updateToken', JSON.stringify(user))
	          this.$router.go(0)
	        } else {
	          alert(data.message)
	        }
	      })
	    }
	},
	mounted: function () {

		this.presentTab = 'profile'

		let opt = {
			username: JSON.parse(store.getters.showTokenState).username
		}
		api.getData(opt).then(({
			data
		}) => {
			if (data.info == 200) {
				this.userdata.user_name = data.user_name
				this.userdata.user_id = data.user_id
				this.userdata.user_identity = data.user_identity
				this.userdata.max_borrow_num = data.max_borrow_num
				this.userdata.max_borrow_time = data.max_borrow_time
				this.userdata.user_secret = data.user_secret
			} else {
				alert(data.message)
				logout()
			}
		})
	}
}
</script>
<style>

th {
	text-align: center;
}

.userinfo {
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	margin-top: 60px;
	align-items: center;
}

.nav {
	display: flex;
	justify-content: center;
	margin-bottom: 30px;
	width: 70%;
}
	
.nav-tabs {
	border-bottom: 1px solid #78bfba;
}
.nav > li > a {
	padding-left: 35px;
	padding-right: 32px;
}
.nav > li > a:hover {
	color: white;
	background-color: #3fb1b1;
}
.nav > li {
	margin-left: 10px;
	margin-right: 10px;
}
.nav > li:hover {
	border-bottom: 2px solid #0EA8A3;
}

.activeTab {
	border-bottom: 2px solid #0EA8A3;
	background-color: #0EA8A3;
}

.activeTab > a {
	color: white;
}

.stu-content {
	width: 40%;
	height: 300px;
}

.ctn-userinfo {
	width: 50%;
}

.btn-login {
	margin-top: 20px;
	background-color: #0EA8A3;
	color: white;
}

.library-userOverview {
	height: 100%;
}

.library-userOverview > li {
	list-style: none;
}

.library-backColor-cyan {
	background-color: #0EA8A3;
	color: white;
}

</style>
