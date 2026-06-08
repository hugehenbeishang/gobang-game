/**
 * 五子棋小游戏 - 微信云开发版（免域名配置）
 */

// ==================== 基础配置 ====================
const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');
const { windowWidth, windowHeight, pixelRatio } = wx.getSystemInfoSync();

canvas.width = windowWidth * pixelRatio;
canvas.height = windowHeight * pixelRatio;
ctx.scale(pixelRatio, pixelRatio);

// ==================== 云开发初始化 ====================
let db = null;
let roomsCollection = null;
let _ = null; // db.command

try {
  wx.cloud.init({
    traceUser: true
  });
  db = wx.cloud.database();
  roomsCollection = db.collection('rooms');
  _ = db.command;
  console.log('云开发初始化成功');
} catch (err) {
  console.error('云开发初始化失败:', err);
}

// ==================== 游戏状态 ====================
const game = {
  // 当前界面：menu, lobby, game
  scene: 'menu',

  // 玩家信息
  playerId: 'p' + Date.now() + Math.floor(Math.random() * 10000),
  playerName: '玩家' + Math.floor(Math.random() * 1000),
  myColor: null, // 'black' 或 'white'

  // 房间信息
  roomId: null,
  docId: null, // 云数据库文档ID
  isCreator: false,

  // 棋盘状态
  board: [],
  boardSize: 15,
  currentPlayer: 'black',
  moveCount: 0,
  gameOver: false,
  winner: null,

  // UI参数
  cellSize: 0,
  boardOffset: 0,

  // 玩家列表
  blackPlayer: null,
  whitePlayer: null,

  // 输入状态
  inputText: '',
  inputField: null,

  // 连接状态
  connected: false,
  watcher: null // 数据库实时监听器
};

// ==================== 云数据库操作 ====================

function initCloud() {
  if (db && roomsCollection) {
    game.connected = true;
    drawBoard();
    return Promise.resolve();
  }
  game.connected = false;
  drawBoard();
  return Promise.reject(new Error('云开发未初始化'));
}

function createEmptyBoard() {
  const board = [];
  for (let i = 0; i < game.boardSize; i++) {
    board[i] = [];
    for (let j = 0; j < game.boardSize; j++) {
      board[i][j] = 0;
    }
  }
  return board;
}

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// 创建房间
function createRoom(roomName) {
  if (!game.connected) {
    wx.showToast({ title: '云服务未连接', icon: 'none' });
    return;
  }

  wx.showLoading({ title: '创建房间...' });

  const roomId = generateRoomId();
  const board = createEmptyBoard();

  roomsCollection.add({
    data: {
      roomId: roomId,
      roomName: roomName || '五子棋房间',
      status: 'waiting',
      players: {
        black: { id: game.playerId, name: game.playerName, ready: true },
        white: null
      },
      board: board,
      currentPlayer: 'black',
      moveCount: 0,
      gameOver: false,
      winner: null,
      createdAt: Date.now()
    }
  }).then(res => {
    wx.hideLoading();
    game.roomId = roomId;
    game.docId = res._id;
    game.isCreator = true;
    game.myColor = 'black';
    game.blackPlayer = { id: game.playerId, name: game.playerName };
    game.whitePlayer = null;
    game.board = board;
    game.scene = 'lobby';

    // 开始监听房间变化
    startWatching(res._id);
    drawBoard();

    wx.showToast({ title: '房间创建成功', icon: 'success' });
  }).catch(err => {
    wx.hideLoading();
    console.error('创建房间失败:', err);
    wx.showToast({ title: '创建失败', icon: 'none' });
  });
}

// 加入房间
function joinRoom(roomId) {
  if (!game.connected) {
    wx.showToast({ title: '云服务未连接', icon: 'none' });
    return;
  }
  if (!roomId || roomId.length < 4) {
    wx.showToast({ title: '请输入有效房间号', icon: 'none' });
    return;
  }

  wx.showLoading({ title: '加入房间...' });

  // 查找房间
  roomsCollection.where({
    roomId: roomId,
    status: _.in(['waiting', 'ready'])
  }).get().then(res => {
    if (res.data.length === 0) {
      wx.hideLoading();
      wx.showToast({ title: '房间不存在或已开始', icon: 'none' });
      return;
    }

    const room = res.data[0];

    if (room.players.white) {
      wx.hideLoading();
      wx.showToast({ title: '房间已满', icon: 'none' });
      return;
    }

    // 加入为白方
    roomsCollection.doc(room._id).update({
      data: {
        'players.white': { id: game.playerId, name: game.playerName, ready: false },
        status: 'ready'
      }
    }).then(() => {
      wx.hideLoading();
      game.roomId = roomId;
      game.docId = room._id;
      game.isCreator = false;
      game.myColor = 'white';
      game.blackPlayer = room.players.black;
      game.whitePlayer = { id: game.playerId, name: game.playerName };
      game.board = room.board;
      game.currentPlayer = room.currentPlayer;
      game.moveCount = room.moveCount;
      game.gameOver = room.gameOver;
      game.scene = 'lobby';

      // 开始监听房间变化
      startWatching(room._id);
      drawBoard();

      wx.showToast({ title: '加入成功', icon: 'success' });
    }).catch(err => {
      wx.hideLoading();
      console.error('加入房间失败:', err);
      wx.showToast({ title: '加入失败', icon: 'none' });
    });
  }).catch(err => {
    wx.hideLoading();
    console.error('查询房间失败:', err);
    wx.showToast({ title: '查询失败', icon: 'none' });
  });
}

// 快速匹配
function quickMatch() {
  if (!game.connected) {
    wx.showToast({ title: '云服务未连接', icon: 'none' });
    return;
  }
  game.isCreator = true;
  createRoom('快速匹配');
}

// 开始监听房间文档变化
function startWatching(docId) {
  // 关闭之前的监听
  if (game.watcher) {
    game.watcher.close();
    game.watcher = null;
  }

  game.watcher = roomsCollection.doc(docId).watch({
    onChange: function(snapshot) {
      console.log('数据库变化:', snapshot.type);
      if (snapshot.docs && snapshot.docs.length > 0) {
        handleRoomUpdate(snapshot.docs[0]);
      }
    },
    onError: function(err) {
      console.error('监听错误:', err);
    }
  });
}

// 处理房间数据更新
function handleRoomUpdate(room) {
  if (!room) return;

  const prevScene = game.scene;

  game.roomId = room.roomId;
  game.currentPlayer = room.currentPlayer;
  game.moveCount = room.moveCount;
  game.gameOver = room.gameOver;
  game.winner = room.winner;
  game.board = room.board || createEmptyBoard();
  game.blackPlayer = room.players.black || null;
  game.whitePlayer = room.players.white || null;

  // 场景切换
  if (room.status === 'playing' && prevScene === 'lobby') {
    game.scene = 'game';
  }
  if (room.status === 'finished') {
    game.scene = 'game';
  }

  // 游戏结束弹窗
  if (room.gameOver && !game.gameOverShown) {
    game.gameOverShown = true;
    const winnerText = room.winner === game.myColor ? '你赢了！' :
                       (room.winner ? '你输了！' : '平局！');
    setTimeout(() => {
      wx.showModal({
        title: '游戏结束',
        content: winnerText,
        showCancel: false,
        success: () => {
          game.scene = 'menu';
          game.gameOverShown = false;
          if (game.watcher) {
            game.watcher.close();
            game.watcher = null;
          }
          game.roomId = null;
          game.docId = null;
          drawBoard();
        }
      });
    }, 500);
  }

  drawBoard();
}

// 落子
function cloudMakeMove(x, y) {
  if (game.myColor !== game.currentPlayer || game.gameOver) return;
  if (!game.board[x] || game.board[x][y] !== 0) return;
  if (!game.docId) return;

  const piece = game.myColor === 'black' ? 1 : 2;
  const newBoard = game.board.map(row => [...row]);
  newBoard[x][y] = piece;

  const won = checkWinnerOnBoard(newBoard, x, y, piece);
  const nextPlayer = game.currentPlayer === 'black' ? 'white' : 'black';
  const newMoveCount = game.moveCount + 1;

  const updateData = {
    board: newBoard,
    currentPlayer: nextPlayer,
    moveCount: newMoveCount
  };

  if (won) {
    updateData.gameOver = true;
    updateData.winner = game.myColor;
    updateData.status = 'finished';
  } else if (newMoveCount >= game.boardSize * game.boardSize) {
    updateData.gameOver = true;
    updateData.winner = null;
    updateData.status = 'finished';
  }

  roomsCollection.doc(game.docId).update({
    data: updateData
  }).catch(err => {
    console.error('落子失败:', err);
    wx.showToast({ title: '落子失败', icon: 'none' });
  });
}

// 开始游戏（房主操作）
function startGame() {
  if (!game.docId || !game.isCreator) return;
  if (!game.whitePlayer) {
    wx.showToast({ title: '等待对手加入', icon: 'none' });
    return;
  }

  roomsCollection.doc(game.docId).update({
    data: {
      status: 'playing',
      board: createEmptyBoard(),
      currentPlayer: 'black',
      moveCount: 0,
      gameOver: false,
      winner: null
    }
  }).then(() => {
    game.scene = 'game';
    drawBoard();
  }).catch(err => {
    console.error('开始游戏失败:', err);
    wx.showToast({ title: '开始失败', icon: 'none' });
  });
}

// 玩家准备
function playerReady() {
  if (!game.docId || game.isCreator) return;

  roomsCollection.doc(game.docId).update({
    data: {
      'players.white.ready': true
    }
  }).then(() => {
    wx.showToast({ title: '已准备', icon: 'success' });
  }).catch(err => {
    console.error('准备失败:', err);
  });
}

// 重新开始
function restartGame() {
  if (!game.docId) return;

  roomsCollection.doc(game.docId).update({
    data: {
      status: 'playing',
      board: createEmptyBoard(),
      currentPlayer: 'black',
      moveCount: 0,
      gameOver: false,
      winner: null
    }
  }).catch(err => {
    console.error('重新开始失败:', err);
  });
}

// 认输
function surrender() {
  if (!game.docId || game.gameOver) return;

  const winner = game.myColor === 'black' ? 'white' : 'black';

  roomsCollection.doc(game.docId).update({
    data: {
      gameOver: true,
      winner: winner,
      status: 'finished'
    }
  }).catch(err => {
    console.error('认输失败:', err);
  });
}

// 离开房间
function leaveRoom() {
  if (game.watcher) {
    game.watcher.close();
    game.watcher = null;
  }

  if (game.docId) {
    // 从房间中移除自己
    const updateData = {};
    if (game.myColor === 'black') {
      updateData['players.black'] = null;
      if (game.whitePlayer) {
        updateData.status = 'waiting';
      }
    } else {
      updateData['players.white'] = null;
      updateData.status = 'waiting';
    }

    roomsCollection.doc(game.docId).update({
      data: updateData
    }).catch(err => {
      console.error('离开房间失败:', err);
    });
  }

  game.scene = 'menu';
  game.roomId = null;
  game.docId = null;
  game.myColor = null;
  game.isCreator = false;
  game.blackPlayer = null;
  game.whitePlayer = null;
  game.gameOver = false;
  game.winner = null;
  game.gameOverShown = false;
  initBoard();
  drawBoard();
}

// ==================== 胜负检测 ====================
function checkWinnerOnBoard(board, x, y, piece) {
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (const [dx, dy] of dirs) {
    let count = 1;
    for (let i = 1; i < 5; i++) {
      const nx = x + dx * i, ny = y + dy * i;
      if (nx >= 0 && nx < 15 && ny >= 0 && ny < 15 && board[nx][ny] === piece) count++;
      else break;
    }
    for (let i = 1; i < 5; i++) {
      const nx = x - dx * i, ny = y - dy * i;
      if (nx >= 0 && nx < 15 && ny >= 0 && ny < 15 && board[nx][ny] === piece) count++;
      else break;
    }
    if (count >= 5) return true;
  }
  return false;
}

// ==================== 棋盘逻辑 ====================
function initBoard() {
  game.board = createEmptyBoard();
  game.currentPlayer = 'black';
  game.moveCount = 0;
  game.gameOver = false;
  game.winner = null;
}

function checkWinner(x, y, player) {
  return checkWinnerOnBoard(game.board, x, y, player);
}

// ==================== 绘制函数 ====================
function drawBoard() {
  ctx.clearRect(0, 0, windowWidth, windowHeight);

  const gradient = ctx.createLinearGradient(0, 0, windowWidth, windowHeight);
  gradient.addColorStop(0, '#667eea');
  gradient.addColorStop(1, '#764ba2');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, windowWidth, windowHeight);

  switch (game.scene) {
    case 'menu': drawMenu(); break;
    case 'lobby': drawLobby(); break;
    case 'game': drawGame(); break;
  }
}

// 绘制菜单界面
function drawMenu() {
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 36px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('五子棋对战', windowWidth / 2, 80);

  ctx.font = '16px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('与好友实时对弈', windowWidth / 2, 110);

  // 玩家名称输入区域
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  roundRect(30, 150, windowWidth - 60, 60, 10);
  ctx.fill();

  ctx.fillStyle = '#999';
  ctx.font = '14px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('你的昵称：', 50, 175);

  ctx.fillStyle = '#333';
  ctx.font = '18px Arial';
  ctx.fillText(game.playerName, 130, 175);

  // 创建房间按钮
  drawMenuButton(30, 240, '创建房间', '#28a745');

  // 加入房间按钮
  drawMenuButton(30, 310, '加入房间', '#4a90e2');

  // 快速匹配按钮
  drawMenuButton(30, 380, '快速匹配', '#ffc107', '#333');

  // 连接状态
  ctx.fillStyle = game.connected ? '#28a745' : '#dc3545';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(game.connected ? '● 云服务已连接' : '● 云服务未连接', windowWidth / 2, windowHeight - 30);
}

function drawMenuButton(x, y, text, color, textColor = '#fff') {
  ctx.fillStyle = color;
  roundRect(x, y, windowWidth - 60, 50, 10);
  ctx.fill();

  ctx.fillStyle = textColor;
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(text, windowWidth / 2, y + 30);
}

// 绘制房间大厅
function drawLobby() {
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('等待对战', windowWidth / 2, 50);

  // 房间信息卡片
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  roundRect(20, 80, windowWidth - 40, 100, 10);
  ctx.fill();

  ctx.fillStyle = '#333';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('房间号: ' + (game.roomId || '...'), windowWidth / 2, 115);

  ctx.fillStyle = '#666';
  ctx.font = '14px Arial';
  ctx.fillText('将房间号分享给好友即可邀请对战', windowWidth / 2, 145);

  // 玩家列表
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  roundRect(20, 200, windowWidth - 40, 200, 10);
  ctx.fill();

  ctx.fillStyle = '#333';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('玩家列表', 40, 230);

  drawPlayerSlot(40, 250, '黑方', game.blackPlayer);
  drawPlayerSlot(40, 320, '白方', game.whitePlayer);

  // 操作按钮
  if (game.isCreator) {
    drawMenuButton(30, 430, '开始游戏', '#28a745');
  } else {
    drawMenuButton(30, 430, '准备', '#4a90e2');
  }

  drawMenuButton(30, 500, '邀请好友', '#17a2b8');
  drawMenuButton(30, 570, '返回', '#6c757d');
}

function drawPlayerSlot(x, y, label, player) {
  ctx.fillStyle = '#999';
  ctx.font = '14px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y + 15);

  if (player) {
    ctx.fillStyle = '#333';
    ctx.font = '16px Arial';
    ctx.fillText(player.name + (player.id === game.playerId ? ' (我)' : ''), x + 60, y + 15);
  } else {
    ctx.fillStyle = '#ccc';
    ctx.font = '14px Arial';
    ctx.fillText('等待加入...', x + 60, y + 15);
  }
}

// 绘制游戏界面
function drawGame() {
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('五子棋对战', windowWidth / 2, 30);

  const turnText = game.gameOver ? (game.winner ? (game.winner === game.myColor ? '你赢了！' : '你输了！') : '平局！') :
                    (game.currentPlayer === 'black' ? '黑方回合' : '白方回合');
  ctx.font = '14px Arial';
  ctx.fillText(turnText, windowWidth / 2, 50);

  const boardPadding = 20;
  const boardWidth = windowWidth - boardPadding * 2;
  game.cellSize = boardWidth / (game.boardSize - 1);
  game.boardOffset = boardPadding;

  const boardTop = 65;

  // 棋盘背景
  ctx.fillStyle = '#d4a373';
  roundRect(boardPadding - 10, boardTop - 10, boardWidth + 20, boardWidth + 20, 8);
  ctx.fill();

  // 网格线
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  for (let i = 0; i < game.boardSize; i++) {
    ctx.beginPath();
    ctx.moveTo(boardPadding, boardTop + i * game.cellSize);
    ctx.lineTo(boardPadding + boardWidth, boardTop + i * game.cellSize);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(boardPadding + i * game.cellSize, boardTop);
    ctx.lineTo(boardPadding + i * game.cellSize, boardTop + boardWidth);
    ctx.stroke();
  }

  // 星位
  const stars = [[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]];
  for (const [sx, sy] of stars) {
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(boardPadding + sx * game.cellSize, boardTop + sy * game.cellSize, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // 棋子
  for (let i = 0; i < game.boardSize; i++) {
    for (let j = 0; j < game.boardSize; j++) {
      if (game.board[i] && game.board[i][j] !== 0) {
        drawPiece(boardPadding + i * game.cellSize, boardTop + j * game.cellSize, game.board[i][j]);
      }
    }
  }

  // 当前回合指示
  if (!game.gameOver && game.myColor === game.currentPlayer) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('轮到你了', windowWidth / 2, boardTop + boardWidth + 25);
  }

  // 底部玩家信息
  const bottomY = windowHeight - 100;
  drawPlayerInfo(60, bottomY, '黑', game.blackPlayer, game.currentPlayer === 'black');
  drawPlayerInfo(windowWidth - 60, bottomY, '白', game.whitePlayer, game.currentPlayer === 'white');

  // 操作按钮
  const btnY = windowHeight - 45;
  const btnW = 70;
  const gap = 15;
  const startX = (windowWidth - (btnW * 3 + gap * 2)) / 2;

  drawSmallButton(startX, btnY, btnW, 30, '重新开始', '#4a90e2');
  drawSmallButton(startX + btnW + gap, btnY, btnW, 30, '认输', '#dc3545');
  drawSmallButton(startX + (btnW + gap) * 2, btnY, btnW, 30, '返回', '#6c757d');
}

function drawPiece(x, y, player) {
  const r = game.cellSize * 0.4;

  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.arc(x + 1, y + 1, r, 0, Math.PI * 2);
  ctx.fill();

  if (player === 1) {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    g.addColorStop(0, '#555');
    g.addColorStop(1, '#000');
    ctx.fillStyle = g;
  } else {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    g.addColorStop(0, '#fff');
    g.addColorStop(1, '#ddd');
    ctx.fillStyle = g;
  }

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  if (player === 2) {
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawPlayerInfo(x, y, label, player, isActive) {
  if (label === '黑') {
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  if (isActive && !game.gameOver) {
    ctx.strokeStyle = '#4a90e2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = '#fff';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(player ? player.name : '等待中', x, y + 28);
}

function drawSmallButton(x, y, w, h, text, color) {
  ctx.fillStyle = color;
  roundRect(x, y, w, h, 5);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ==================== 触摸事件 ====================
canvas.addEventListener('touchstart', (e) => {
  const touch = e.touches[0];
  const x = touch.clientX;
  const y = touch.clientY;

  switch (game.scene) {
    case 'menu': handleMenuTouch(x, y); break;
    case 'lobby': handleLobbyTouch(x, y); break;
    case 'game': handleGameTouch(x, y); break;
  }
});

function handleMenuTouch(x, y) {
  // 昵称输入区域
  if (y >= 150 && y <= 210 && x >= 30 && x <= windowWidth - 30) {
    wx.showModal({
      title: '修改昵称',
      editable: true,
      placeholderText: '请输入昵称',
      success: (res) => {
        if (res.confirm && res.content) {
          game.playerName = res.content.trim() || game.playerName;
          drawBoard();
        }
      }
    });
    return;
  }

  // 创建房间
  if (y >= 240 && y <= 290 && x >= 30 && x <= windowWidth - 30) {
    wx.showModal({
      title: '创建房间',
      editable: true,
      placeholderText: '请输入房间名称',
      success: (res) => {
        if (res.confirm) {
          const roomName = res.content || '五子棋房间';
          createRoom(roomName);
        }
      }
    });
    return;
  }

  // 加入房间
  if (y >= 310 && y <= 360 && x >= 30 && x <= windowWidth - 30) {
    wx.showModal({
      title: '加入房间',
      editable: true,
      placeholderText: '请输入6位房间号',
      success: (res) => {
        if (res.confirm && res.content) {
          joinRoom(res.content.trim().toUpperCase());
        }
      }
    });
    return;
  }

  // 快速匹配
  if (y >= 380 && y <= 430 && x >= 30 && x <= windowWidth - 30) {
    quickMatch();
    return;
  }
}

function handleLobbyTouch(x, y) {
  // 开始游戏/准备
  if (y >= 430 && y <= 480 && x >= 30 && x <= windowWidth - 30) {
    if (game.isCreator) {
      startGame();
    } else {
      playerReady();
    }
    return;
  }

  // 邀请好友
  if (y >= 500 && y <= 550 && x >= 30 && x <= windowWidth - 30) {
    wx.shareAppMessage({
      title: '五子棋对战 - 房间号: ' + game.roomId,
      path: '/game.js?room=' + game.roomId
    });
    return;
  }

  // 返回
  if (y >= 570 && y <= 620 && x >= 30 && x <= windowWidth - 30) {
    leaveRoom();
    return;
  }
}

function handleGameTouch(x, y) {
  const boardTop = 65;
  const boardPadding = 20;

  // 棋盘区域
  if (y >= boardTop && y <= boardTop + (game.boardSize - 1) * game.cellSize + 20) {
    if (x >= boardPadding && x <= boardPadding + (game.boardSize - 1) * game.cellSize + 20) {
      const bx = Math.round((x - boardPadding) / game.cellSize);
      const by = Math.round((y - boardTop) / game.cellSize);

      if (bx >= 0 && bx < game.boardSize && by >= 0 && by < game.boardSize) {
        if (game.myColor === game.currentPlayer && !game.gameOver) {
          cloudMakeMove(bx, by);
        }
      }
      return;
    }
  }

  // 按钮区域
  const btnY = windowHeight - 45;
  if (y >= btnY && y <= btnY + 30) {
    const btnW = 70;
    const gap = 15;
    const startX = (windowWidth - (btnW * 3 + gap * 2)) / 2;

    // 重新开始
    if (x >= startX && x <= startX + btnW) {
      restartGame();
      return;
    }

    // 认输
    if (x >= startX + btnW + gap && x <= startX + (btnW + gap) * 2) {
      wx.showModal({
        title: '确认认输',
        content: '确定要认输吗？',
        success: (res) => {
          if (res.confirm) surrender();
        }
      });
      return;
    }

    // 返回
    if (x >= startX + (btnW + gap) * 2 && x <= startX + (btnW + gap) * 3) {
      leaveRoom();
      return;
    }
  }
}

// ==================== 分享 ====================
wx.showShareMenu({ withShareTicket: true });
wx.onShareAppMessage(() => ({
  title: '五子棋对战 - 来和我对弈吧！',
  path: game.roomId ? '/game.js?room=' + game.roomId : '/game.js'
}));

// ==================== 启动 ====================
initBoard();
drawBoard();

// 初始化云开发
initCloud();

// 检查启动参数（通过分享链接进入）
const launchOptions = wx.getLaunchOptionsSync();
if (launchOptions.query && launchOptions.query.room) {
  // 延迟一点等云开发初始化完成
  setTimeout(() => {
    joinRoom(launchOptions.query.room);
  }, 1000);
}
