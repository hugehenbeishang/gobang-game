// pages/index/index.js
const userUtil = require('../../utils/user.js');
const websocket = require('../../utils/websocket.js');

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    roomName: '',
    roomCode: '',
    selectedColor: 'black'
  },

  onLoad() {
    this.checkLoginStatus();
  },

  onShow() {
    this.checkLoginStatus();
  },

  // 检查登录状态
  checkLoginStatus() {
    const userData = userUtil.getUserInfo();
    this.setData({
      isLoggedIn: userData.isLoggedIn,
      userInfo: userData.userInfo
    });
  },

  // 微信登录
  login() {
    wx.showLoading({
      title: '登录中...',
    });

    // 模拟登录过程
    userUtil.mockLogin()
      .then((result) => {
        this.setData({
          isLoggedIn: true,
          userInfo: result.userInfo
        });
        
        wx.hideLoading();
        wx.showToast({
          title: '登录成功',
          icon: 'success',
          duration: 2000
        });
      })
      .catch((err) => {
        wx.hideLoading();
        wx.showToast({
          title: '登录失败',
          icon: 'none',
          duration: 2000
        });
        console.error('登录失败:', err);
      });
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          userUtil.clearUserInfo();
          this.setData({
            isLoggedIn: false,
            userInfo: null
          });
          
          wx.showToast({
            title: '已退出登录',
            icon: 'success',
            duration: 2000
          });
        }
      }
    });
  },

  // 房间名称输入
  onRoomNameInput(e) {
    this.setData({
      roomName: e.detail.value
    });
  },

  // 房间号输入
  onRoomCodeInput(e) {
    this.setData({
      roomCode: e.detail.value
    });
  },

  // 选择棋色
  selectColor(e) {
    const color = e.currentTarget.dataset.color;
    this.setData({
      selectedColor: color
    });
  },

  // 创建房间
  createRoom() {
    if (!this.data.roomName.trim()) {
      wx.showToast({
        title: '请输入房间名称',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 保存房间信息到本地存储
    const roomInfo = {
      name: this.data.roomName,
      creator: this.data.userInfo,
      creatorColor: this.data.selectedColor,
      createTime: Date.now(),
      status: 'waiting' // waiting, playing, finished
    };

    try {
      wx.setStorageSync('currentRoom', roomInfo);
      
      // 跳转到房间页面（房间页面会通过WebSocket创建房间）
      wx.navigateTo({
        url: `/pages/room/room?role=creator`
      });
    } catch (err) {
      wx.showToast({
        title: '创建房间失败',
        icon: 'none',
        duration: 2000
      });
      console.error('创建房间失败:', err);
    }
  },

  // 加入房间
  joinRoom() {
    if (!this.data.roomCode.trim()) {
      wx.showToast({
        title: '请输入房间号',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    if (this.data.roomCode.length !== 6) {
      wx.showToast({
        title: '房间号应为6位数字',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 跳转到房间页面
    wx.navigateTo({
      url: `/pages/room/room?code=${this.data.roomCode}&role=joiner`
    });
  },

  // 快速匹配
  quickMatch() {
    wx.showLoading({
      title: '匹配中...',
    });

    // 模拟匹配过程
    setTimeout(() => {
      wx.hideLoading();
      
      // 生成随机房间号
      const roomCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // 模拟匹配成功
      wx.showModal({
        title: '匹配成功',
        content: `已匹配到房间 ${roomCode}，是否加入？`,
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: `/pages/room/room?code=${roomCode}&role=joiner`
            });
          }
        }
      });
    }, 2000);
  },

  // 分享房间
  onShareAppMessage() {
    return {
      title: '五子棋对战 - 来和我对弈吧！',
      path: '/pages/index/index',
      imageUrl: '/images/share-cover.svg'
    };
  }
});