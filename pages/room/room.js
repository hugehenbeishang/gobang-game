// pages/room/room.js
const userUtil = require('../../utils/user.js');
const websocket = require('../../utils/websocket.js');

Page({
  data: {
    // 房间信息
    roomCode: '',
    roomInfo: null,
    isCreator: false,
    
    // 玩家信息
    blackPlayer: null,
    whitePlayer: null,
    
    // 房间状态
    roomStatus: '等待玩家加入',
    canStartGame: false,
    isReady: false
  },

  onLoad(options) {
    const roomCode = options.code || '';
    const isCreator = options.role === 'creator';
    
    this.setData({
      roomCode,
      isCreator
    });
    
    // 加载房间信息
    this.loadRoomInfo();
    
    // 连接WebSocket服务器
    this.connectWebSocket();
    
    // 注册消息处理器
    this.registerMessageHandlers();
  },

  // 加载房间信息
  loadRoomInfo() {
    try {
      const roomInfo = wx.getStorageSync('currentRoom');
      if (roomInfo && roomInfo.code === this.data.roomCode) {
        this.setData({
          roomInfo
        });
        
        // 如果是房主，设置房主为黑方
        if (this.data.isCreator) {
          const userData = userUtil.getUserInfo();
          this.setData({
            blackPlayer: {
              name: userData.userInfo.nickName,
              openid: userData.openid,
              isMe: true
            }
          });
          this.updateRoomStatus();
        }
      }
    } catch (err) {
      console.error('加载房间信息失败:', err);
      wx.showToast({
        title: '加载房间信息失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 连接WebSocket服务器
  connectWebSocket() {
    // 连接到WebSocket服务器（需要替换为实际的服务器地址）
    const wsUrl = 'ws://localhost:3000';
    
    websocket.connect(wsUrl)
      .then(() => {
        console.log('WebSocket连接成功');
        
        // 如果是房主，创建房间；否则加入房间
        if (this.data.isCreator) {
          this.createRoom();
        } else {
          this.joinRoom();
        }
      })
      .catch((err) => {
        console.error('WebSocket连接失败:', err);
        wx.showToast({
          title: '连接服务器失败',
          icon: 'none',
          duration: 2000
        });
      });
  },

  // 创建房间
  createRoom() {
    const userData = userUtil.getUserInfo();
    const playerName = userData.userInfo ? userData.userInfo.nickName : '玩家';
    
    websocket.send({
      type: 'create_room',
      payload: {
        roomName: this.data.roomInfo ? this.data.roomInfo.name : '五子棋房间',
        playerName: playerName
      }
    });
  },

  // 加入房间
  joinRoom() {
    const userData = userUtil.getUserInfo();
    const playerName = userData.userInfo ? userData.userInfo.nickName : '玩家';
    
    websocket.send({
      type: 'join_room',
      payload: {
        roomId: this.data.roomCode,
        playerName: playerName
      }
    });
  },

  // 注册消息处理器
  registerMessageHandlers() {
    // 房间创建成功
    websocket.onMessage('room_created', (message) => {
      console.log('房间创建成功:', message);
      this.setData({
        roomCode: message.roomId
      });
      this.updateRoomState(message.room);
    });

    // 房间加入成功
    websocket.onMessage('room_joined', (message) => {
      console.log('加入房间成功:', message);
      this.updateRoomState(message.room);
    });

    // 玩家加入
    websocket.onMessage('player_joined', (message) => {
      console.log('玩家加入:', message);
      this.updateRoomState(message.room);
      
      wx.showToast({
        title: `${message.player.name} 加入了房间`,
        icon: 'success',
        duration: 2000
      });
    });

    // 玩家离开
    websocket.onMessage('player_left', (message) => {
      console.log('玩家离开:', message);
      this.updateRoomState(message.room);
      
      wx.showToast({
        title: '对手已离开',
        icon: 'none',
        duration: 2000
      });
    });

    // 准备状态
    websocket.onMessage('ready', (message) => {
      console.log('准备状态:', message);
      this.updateRoomState(message.room);
    });

    // 游戏开始
    websocket.onMessage('game_start', (message) => {
      console.log('游戏开始:', message);
      
      // 跳转到游戏页面
      wx.navigateTo({
        url: `/pages/game/game?code=${this.data.roomCode}&role=${this.data.isCreator ? 'creator' : 'joiner'}`
      });
    });

    // 错误消息
    websocket.onMessage('error', (message) => {
      console.error('服务器错误:', message);
      wx.showToast({
        title: message.message,
        icon: 'none',
        duration: 2000
      });
    });
  },

  // 更新房间状态
  updateRoomState(room) {
    if (!room) return;
    
    // 更新玩家信息
    const blackPlayer = room.players.black || null;
    const whitePlayer = room.players.white || null;
    
    this.setData({
      blackPlayer,
      whitePlayer
    });
    
    this.updateRoomStatus();
  },

  // 更新房间状态
  updateRoomStatus() {
    const { blackPlayer, whitePlayer, isCreator } = this.data;
    
    let roomStatus = '';
    let canStartGame = false;
    
    if (blackPlayer && whitePlayer) {
      roomStatus = '玩家已就位，可以开始游戏';
      canStartGame = isCreator; // 只有房主可以开始游戏
    } else if (blackPlayer && !whitePlayer) {
      roomStatus = '等待白方玩家加入';
    } else if (!blackPlayer && whitePlayer) {
      roomStatus = '等待黑方玩家加入';
    } else {
      roomStatus = '等待玩家加入';
    }
    
    this.setData({
      roomStatus,
      canStartGame
    });
  },

  // 复制房间号
  copyRoomCode() {
    wx.setClipboardData({
      data: this.data.roomCode,
      success: () => {
        wx.showToast({
          title: '房间号已复制',
          icon: 'success',
          duration: 2000
        });
      }
    });
  },

  // 开始游戏
  startGame() {
    if (!this.data.canStartGame) return;
    
    // 跳转到游戏页面
    wx.navigateTo({
      url: `/pages/game/game?code=${this.data.roomCode}&role=creator`
    });
  },

  // 邀请好友
  inviteFriend() {
    // 触发分享
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage']
    });
  },

  // 准备游戏（加入者使用）
  readyGame() {
    if (this.data.isReady) return;
    
    this.setData({
      isReady: true
    });
    
    wx.showToast({
      title: '已准备',
      icon: 'success',
      duration: 2000
    });
    
    // 通过WebSocket发送准备消息
    websocket.send({
      type: 'ready'
    }).catch((err) => {
      console.error('发送准备消息失败:', err);
      wx.showToast({
        title: '准备失败',
        icon: 'none',
        duration: 2000
      });
    });
  },

  // 离开房间
  leaveRoom() {
    wx.showModal({
      title: '确认离开',
      content: '确定要离开房间吗？',
      success: (res) => {
        if (res.confirm) {
          // 通过WebSocket发送离开消息
          websocket.send({
            type: 'leave_room'
          }).catch((err) => {
            console.error('发送离开消息失败:', err);
          });
          
          // 关闭WebSocket连接
          websocket.close();
          
          // 清除房间信息
          try {
            wx.removeStorageSync('currentRoom');
          } catch (err) {
            console.error('清除房间信息失败:', err);
          }
          
          // 返回上一页
          wx.navigateBack({
            delta: 1
          });
        }
      }
    });
  },

  // 分享配置
  onShareAppMessage() {
    return {
      title: `五子棋对战 - 邀请你加入房间 ${this.data.roomCode}`,
      path: `/pages/index/index`,
      imageUrl: '/images/share-cover.svg'
    };
  },

  // 页面卸载
  onUnload() {
    // 关闭WebSocket连接
    websocket.close();
    
    // 如果是房主离开，可以考虑删除房间
    if (this.data.isCreator) {
      // 实际项目中应该通知服务器删除房间
      console.log('房主离开房间');
    }
  }
});