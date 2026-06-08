// pages/game/game.js
const userUtil = require('../../utils/user.js');
const gameUtil = require('../../utils/game.js');
const websocket = require('../../utils/websocket.js');

Page({
  data: {
    // 游戏状态
    board: [], // 15x15 棋盘，0: 空，1: 黑子，2: 白子
    currentPlayer: 'black', // 当前玩家
    moveCount: 0, // 落子次数
    gameOver: false, // 游戏是否结束
    winner: null, // 获胜者
    gameStatus: '游戏进行中', // 游戏状态描述
    
    // 玩家信息
    blackPlayer: null, // 黑方玩家
    whitePlayer: null, // 白方玩家
    
    // 棋盘参数
    boardSize: 15, // 棋盘大小
    cellSize: 0, // 格子大小
    boardOffset: 0, // 棋盘偏移量
    
    // 落子提示
    showMoveHint: false,
    hintX: 0,
    hintY: 0,
    
    // 房间信息
    roomCode: '',
    isCreator: false
  },

  onLoad(options) {
    // 获取房间信息
    const roomCode = options.code || '';
    const isCreator = options.role === 'creator';
    
    this.setData({
      roomCode,
      isCreator
    });
    
    // 初始化棋盘
    this.initBoard();
    
    // 初始化玩家信息
    this.initPlayers();
    
    // 初始化棋盘绘制
    this.initCanvas();
    
    // 连接WebSocket服务器
    this.connectWebSocket();
    
    // 注册消息处理器
    this.registerMessageHandlers();
  },

  // 初始化棋盘
  initBoard() {
    const board = gameUtil.createBoard(this.data.boardSize);
    
    this.setData({
      board,
      currentPlayer: 'black',
      moveCount: 0,
      gameOver: false,
      winner: null,
      gameStatus: '游戏进行中'
    });
  },

  // 连接WebSocket服务器
  connectWebSocket() {
    // 连接到WebSocket服务器（需要替换为实际的服务器地址）
    const wsUrl = 'ws://localhost:3000';
    
    websocket.connect(wsUrl)
      .then(() => {
        console.log('WebSocket连接成功');
        
        // 加入房间
        this.joinRoom();
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

    // 游戏状态更新
    websocket.onMessage('game_state', (message) => {
      console.log('游戏状态更新:', message);
      this.updateGameState(message);
    });

    // 游戏开始
    websocket.onMessage('game_start', (message) => {
      console.log('游戏开始:', message);
      this.updateRoomState(message.room);
      
      wx.showToast({
        title: '游戏开始！',
        icon: 'success',
        duration: 2000
      });
    });

    // 游戏结束
    websocket.onMessage('game_over', (message) => {
      console.log('游戏结束:', message);
      this.updateRoomState(message.room);
      
      const winnerName = message.winner ? 
        (message.winner === 'black' ? '黑方' : '白方') : '平局';
      
      this.setData({
        gameOver: true,
        winner: message.winner,
        gameStatus: `${winnerName} 获胜！`
      });
      
      wx.showModal({
        title: '游戏结束',
        content: `${winnerName} 获胜！`,
        showCancel: false
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
  },

  // 更新游戏状态
  updateGameState(message) {
    const { move, room } = message;
    
    if (move) {
      // 更新棋盘
      const newBoard = [...this.data.board];
      newBoard[move.x] = [...newBoard[move.x]];
      newBoard[move.x][move.y] = move.player === 'black' ? 1 : 2;
      
      this.setData({
        board: newBoard,
        moveCount: room.moveCount,
        currentPlayer: room.currentPlayer,
        gameStatus: `${move.player === 'black' ? '黑方' : '白方'} 落子于 (${move.x + 1}, ${move.y + 1})`
      });
      
      // 重新绘制棋盘
      this.drawBoard();
    }
  },

  // 初始化玩家信息
  initPlayers() {
    const userData = userUtil.getUserInfo();
    
    // 模拟玩家信息（实际项目中应该从房间数据获取）
    const blackPlayer = {
      name: this.data.isCreator ? userData.userInfo.nickName : '对手',
      openid: this.data.isCreator ? userData.openid : 'opponent',
      isMe: this.data.isCreator
    };
    
    const whitePlayer = {
      name: this.data.isCreator ? '对手' : userData.userInfo.nickName,
      openid: this.data.isCreator ? 'opponent' : userData.openid,
      isMe: !this.data.isCreator
    };
    
    this.setData({
      blackPlayer,
      whitePlayer
    });
  },

  // 初始化Canvas
  initCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#boardCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (res[0]) {
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          
          // 设置Canvas尺寸
          const dpr = wx.getWindowInfo().pixelRatio;
          canvas.width = res[0].width * dpr;
          canvas.height = res[0].height * dpr;
          ctx.scale(dpr, dpr);
          
          // 计算格子大小
          const cellSize = res[0].width / (this.data.boardSize + 1);
          
          this.setData({
            cellSize,
            boardOffset: cellSize
          });
          
          // 保存canvas和ctx到页面实例
          this.canvas = canvas;
          this.ctx = ctx;
          
          // 绘制棋盘
          this.drawBoard();
        }
      });
  },

  // 绘制棋盘
  drawBoard() {
    if (!this.ctx) return;
    
    const { boardSize, cellSize, boardOffset } = this.data;
    const ctx = this.ctx;
    
    // 清空画布
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 绘制棋盘背景
    ctx.fillStyle = '#d4a373';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 绘制网格线
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    
    for (let i = 0; i < boardSize; i++) {
      // 横线
      ctx.beginPath();
      ctx.moveTo(boardOffset, boardOffset + i * cellSize);
      ctx.lineTo(boardOffset + (boardSize - 1) * cellSize, boardOffset + i * cellSize);
      ctx.stroke();
      
      // 竖线
      ctx.beginPath();
      ctx.moveTo(boardOffset + i * cellSize, boardOffset);
      ctx.lineTo(boardOffset + i * cellSize, boardOffset + (boardSize - 1) * cellSize);
      ctx.stroke();
    }
    
    // 绘制天元和星位
    this.drawStars();
    
    // 绘制已有棋子
    this.drawPieces();
  },

  // 绘制星位
  drawStars() {
    const { boardSize, cellSize, boardOffset } = this.data;
    const ctx = this.ctx;
    
    // 天元（中心点）
    const center = Math.floor(boardSize / 2);
    this.drawStar(center, center);
    
    // 四个星位
    const starPoints = [
      [3, 3], [3, 11], [11, 3], [11, 11]
    ];
    
    starPoints.forEach(([x, y]) => {
      this.drawStar(x, y);
    });
  },

  // 绘制单个星位
  drawStar(x, y) {
    const { cellSize, boardOffset } = this.data;
    const ctx = this.ctx;
    
    const centerX = boardOffset + x * cellSize;
    const centerY = boardOffset + y * cellSize;
    const radius = cellSize * 0.15;
    
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
  },

  // 绘制棋子
  drawPieces() {
    const { board, boardSize, cellSize, boardOffset } = this.data;
    const ctx = this.ctx;
    
    for (let i = 0; i < boardSize; i++) {
      for (let j = 0; j < boardSize; j++) {
        if (board[i][j] !== 0) {
          this.drawPiece(i, j, board[i][j]);
        }
      }
    }
  },

  // 绘制单个棋子
  drawPiece(x, y, player) {
    const { cellSize, boardOffset } = this.data;
    const ctx = this.ctx;
    
    const centerX = boardOffset + x * cellSize;
    const centerY = boardOffset + y * cellSize;
    const radius = cellSize * 0.4;
    
    // 绘制棋子阴影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(centerX + 2, centerY + 2, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // 绘制棋子
    if (player === 1) {
      // 黑子
      const gradient = ctx.createRadialGradient(
        centerX - radius * 0.3, centerY - radius * 0.3, 0,
        centerX, centerY, radius
      );
      gradient.addColorStop(0, '#555');
      gradient.addColorStop(1, '#000');
      
      ctx.fillStyle = gradient;
    } else {
      // 白子
      const gradient = ctx.createRadialGradient(
        centerX - radius * 0.3, centerY - radius * 0.3, 0,
        centerX, centerY, radius
      );
      gradient.addColorStop(0, '#fff');
      gradient.addColorStop(1, '#ddd');
      
      ctx.fillStyle = gradient;
    }
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // 白子边框
    if (player === 2) {
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  },

  // 触摸事件处理
  onBoardTouch(e) {
    if (this.data.gameOver) return;
    
    const touch = e.touches[0];
    const { cellSize, boardOffset, boardSize } = this.data;
    
    // 计算点击的棋盘坐标
    const x = Math.round((touch.x - boardOffset) / cellSize);
    const y = Math.round((touch.y - boardOffset) / cellSize);
    
    // 检查是否在棋盘范围内
    if (x >= 0 && x < boardSize && y >= 0 && y < boardSize) {
      // 检查该位置是否已有棋子
      if (this.data.board[x][y] === 0) {
        // 显示落子提示
        const hintX = boardOffset + x * cellSize;
        const hintY = boardOffset + y * cellSize;
        
        this.setData({
          showMoveHint: true,
          hintX,
          hintY
        });
        
        // 延迟落子，给用户确认时间
        this.moveTimer = setTimeout(() => {
          this.makeMove(x, y);
        }, 300);
      }
    }
  },

  // 触摸移动事件
  onBoardTouchMove(e) {
    // 取消之前的落子定时器
    if (this.moveTimer) {
      clearTimeout(this.moveTimer);
      this.moveTimer = null;
    }
    
    // 隐藏落子提示
    this.setData({
      showMoveHint: false
    });
  },

  // 触摸结束事件
  onBoardTouchEnd(e) {
    // 如果没有移动，保持落子提示
    if (!this.moveTimer && this.data.showMoveHint) {
      // 延迟落子
      this.moveTimer = setTimeout(() => {
        const hintX = this.data.hintX;
        const hintY = this.data.hintY;
        const { cellSize, boardOffset, boardSize } = this.data;
        
        const x = Math.round((hintX - boardOffset) / cellSize);
        const y = Math.round((hintY - boardOffset) / cellSize);
        
        if (x >= 0 && x < boardSize && y >= 0 && y < boardSize) {
          this.makeMove(x, y);
        }
      }, 300);
    }
  },

  // 落子
  makeMove(x, y) {
    // 通过WebSocket发送落子消息
    websocket.send({
      type: 'make_move',
      payload: { x, y }
    }).catch((err) => {
      console.error('发送落子消息失败:', err);
      wx.showToast({
        title: '发送落子失败',
        icon: 'none',
        duration: 2000
      });
    });
    
    // 隐藏落子提示
    this.setData({
      showMoveHint: false
    });
  },

  // 检查是否获胜
  checkWinner(x, y, player) {
    const { board, boardSize } = this.data;
    
    // 检查方向：水平、垂直、对角线
    const directions = [
      [1, 0],  // 水平
      [0, 1],  // 垂直
      [1, 1],  // 右下对角线
      [1, -1]  // 左下对角线
    ];
    
    for (const [dx, dy] of directions) {
      let count = 1;
      
      // 正向检查
      for (let i = 1; i < 5; i++) {
        const newX = x + dx * i;
        const newY = y + dy * i;
        
        if (newX >= 0 && newX < boardSize && newY >= 0 && newY < boardSize && 
            board[newX][newY] === player) {
          count++;
        } else {
          break;
        }
      }
      
      // 反向检查
      for (let i = 1; i < 5; i++) {
        const newX = x - dx * i;
        const newY = y - dy * i;
        
        if (newX >= 0 && newX < boardSize && newY >= 0 && newY < boardSize && 
            board[newX][newY] === player) {
          count++;
        } else {
          break;
        }
      }
      
      // 检查是否五连
      if (count >= 5) {
        const winner = player === 1 ? this.data.blackPlayer : this.data.whitePlayer;
        this.setData({
          gameOver: true,
          winner,
          gameStatus: `${winner.name} 获胜！`
        });
        
        wx.showModal({
          title: '游戏结束',
          content: `${winner.name} 获胜！`,
          showCancel: false
        });
        
        return;
      }
    }
  },

  // 悔棋
  undoMove() {
    if (this.data.moveCount === 0 || this.data.gameOver) return;
    
    wx.showModal({
      title: '确认悔棋',
      content: '确定要悔棋吗？',
      success: (res) => {
        if (res.confirm) {
          websocket.send({
            type: 'undo_move'
          }).catch((err) => {
            console.error('发送悔棋消息失败:', err);
            wx.showToast({
              title: '悔棋功能开发中',
              icon: 'none',
              duration: 2000
            });
          });
        }
      }
    });
  },

  // 重新开始
  restartGame() {
    wx.showModal({
      title: '重新开始',
      content: '确定要重新开始游戏吗？',
      success: (res) => {
        if (res.confirm) {
          websocket.send({
            type: 'restart_game'
          }).catch((err) => {
            console.error('发送重新开始消息失败:', err);
            // 如果发送失败，本地重置
            this.initBoard();
            this.drawBoard();
          });
          
          wx.showToast({
            title: '请求重新开始',
            icon: 'success',
            duration: 2000
          });
        }
      }
    });
  },

  // 认输
  surrender() {
    wx.showModal({
      title: '确认认输',
      content: '确定要认输吗？',
      success: (res) => {
        if (res.confirm) {
          websocket.send({
            type: 'surrender'
          }).catch((err) => {
            console.error('发送认输消息失败:', err);
            wx.showToast({
              title: '认输失败',
              icon: 'none',
              duration: 2000
            });
          });
        }
      }
    });
  },

  // 分享游戏
  shareGame() {
    // 触发分享
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },

  // 返回房间
  backToRoom() {
    wx.navigateBack({
      delta: 1
    });
  },

  // 分享配置
  onShareAppMessage() {
    return {
      title: `五子棋对战 - 房间号: ${this.data.roomCode}`,
      path: `/pages/index/index`,
      imageUrl: '/images/share-cover.svg'
    };
  }
});