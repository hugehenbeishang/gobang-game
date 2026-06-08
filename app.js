// app.js
App({
  onLaunch() {
    // 初始化云开发环境（如果需要）
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'prod-xxx', // 替换为你的云开发环境ID
        traceUser: true,
      });
    }

    // 检查登录状态
    this.checkLoginStatus();
  },

  globalData: {
    userInfo: null,
    isLoggedIn: false,
    openid: null
  },

  // 检查登录状态
  checkLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo');
    const openid = wx.getStorageSync('openid');
    
    if (userInfo && openid) {
      this.globalData.userInfo = userInfo;
      this.globalData.openid = openid;
      this.globalData.isLoggedIn = true;
    }
  },

  // 微信登录
  login() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (res) => {
          if (res.code) {
            // 发送code到后端换取openid
            // 这里可以调用云函数或自己的服务器
            console.log('登录成功，code:', res.code);
            
            // 模拟获取用户信息（实际项目中需要调用后端接口）
            // 临时存储登录状态
            wx.setStorageSync('loginCode', res.code);
            resolve(res.code);
          } else {
            reject(new Error('登录失败：' + res.errMsg));
          }
        },
        fail: (err) => {
          reject(err);
        }
      });
    });
  },

  // 获取用户信息
  getUserInfo() {
    return new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于完善用户资料',
        success: (res) => {
          this.globalData.userInfo = res.userInfo;
          wx.setStorageSync('userInfo', res.userInfo);
          resolve(res.userInfo);
        },
        fail: (err) => {
          reject(err);
        }
      });
    });
  }
});