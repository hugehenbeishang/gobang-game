/**
 * 五子棋小游戏 - 实时对战版
 */

// ==================== 基础配置 ====================
const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');
const { windowWidth, windowHeight, pixelRatio } = wx.getSystemInfoSync();

canvas.width = windowWidth * pixelRatio;
canvas.height = windowHeight * pixelRatio;
ctx.scale(pixelRatio, pixelRatio);

// WebSocket服务器地址（需要替换为实际地址）
const WS_URL = 'ws://localhost:3000';

// ==================== 游戏状态 ====================
const game = {
  // 当前界面：menu, lobby, game
  scene: 'menu',

  // 玩家信息
  playerId: null,
  playerName: '玩家' + Math.floor(Math.random() * 1000),
  myColor: null, // 'black' 或 'white'

  // 房间信息
  roomId: null,
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
  inputField: null, // 'roomName', 'roomCode', 'playerName'

  // 连接状态
  connected: false,
  ws: null
};

// ==================== WebSocket管理 ====================
function connectWebSocket() {
  return new Promise((resolve, reject) => {
    game.ws = wx.connectSocket({
      url: WS_URL,
      success: () => console.log('连接中...'),
      fail: (err) => reject(err)
    });

    game.ws.onOpen(() => {
      console.log('WebSocket连接成功');
      game.connected = true;
      resolve();
    });

    game.ws.onClose(() => {
      console.log('WebSocket连接关闭');
      game.connected = false;
    });

    game.ws.onError((err) => {
      console.error('WebSocket错误:', err);
      game.connected = false;
      reject(err);
    });

    game.ws.onMessage((res) => {
      handleServerMessage(JSON.parse(res.data));
    });
  });
}

function sendMessage(type, payload = {}) {
  if (!game.connected || !game.ws) return;
  game.ws.send({ data: JSON.stringify({ type, payload }) });
}

// ==================== 服务器消息处理 ====================
function handleServerMessage(msg) {
  switch (msg.type) {
    case 'connected':
      game.playerId = msg.playerId;
      console.log('获得玩家ID:', game.playerId);
      break;

    case 'room_created':
      game.roomId = msg.roomId;
      game.scene = 'lobby';
      updateLobbyState(msg.room);
      break;

    case 'room_joined':
      game.roomId = msg.roomId;
      game.scene = 'lobby';
      updateLobbyState(msg.room);
      break;

    case 'player_joined':
      updateLobbyState(msg.room);
      wx.showToast({ title: msg.player.name + ' 加入了房间', icon: 'none' });
      break;

    case 'player_left':
      updateLobbyState(msg.room);
      wx.showToast({ title: '对手已离开', icon: 'none' });
      break;

    case 'ready':
      updateLobbyState(msg.room);
      break;

    case 'game_start':
      game.scene = 'game';
      game.myColor = msg.room.players[game.playerId]?.color;
      updateGameState(msg.room);
      break;

    case 'game_state':
      updateGameState(msg.room);
      if (msg.move) {
        // 对手落子动画
        drawBoard();
      }
      break;

    case 'game_over':
      updateGameState(msg.room);
      game.gameOver = true;
      game.winner = msg.winner;
      drawBoard();
      const winnerText = msg.winner ? (msg.winner === game.myColor ? '你赢了！' : '你输了！') : '平局！';
      setTimeout(() => {
        wx.showModal({
          title: '游戏结束',
          content: winnerText,
          showCancel: false,
          success: () => {
            game.scene = 'menu';
            drawBoard();
          }
        });
      }, 500);
      break;

    case 'error':
      wx.showToast({ title: msg.message, icon: 'none' });
      break;
  }
  drawBoard();
}

function updateLobbyState(room) {
  if (!room) return;
  game.blackPlayer = room.players.black || null;
  game.whitePlayer = room.players.white || null;
}

function updateGameState(room) {
  if (!room) return;
  game.board = room.board;
  game.currentPlayer = room.currentPlayer;
  game.moveCount = room.moveCount;
  game.gameOver = room.gameOver;
  game.blackPlayer = room.players.black || null;
  game.whitePlayer = room.players.white || null;
}

// ==================== 棋盘逻辑 ====================
function initBoard() {
  game.board = [];
  for (let i = 0; i < game.boardSize; i++) {
    game.board[i] = [];
    for (let j = 0; j < game.boardSize; j++) {
      game.board[i][j] = 0;
    }
  }
  game.currentPlayer = 'black';
  game.moveCount = 0;
  game.gameOver = false;
  game.winner = null;
}

function checkWinner(x, y, player) {
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (const [dx, dy] of dirs) {
    let count = 1;
    for (let i = 1; i < 5; i++) {
      const nx = x + dx * i, ny = y + dy * i;
      if (nx >= 0 && nx < 15 && ny >= 0 && ny < 15 && game.board[nx][ny] === player) count++;
      else break;
    }
    for (let i = 1; i < 5; i++) {
      const nx = x - dx * i, ny = y - dy * i;
      if (nx >= 0 && nx < 15 && ny >= 0 && ny < 15 && game.board[nx][ny] === player) count++;
      else break;
    }
    if (count >= 5) return true;
  }
  return false;
}

// ==================== 绘制函数 ====================
function drawBoard() {
  ctx.clearRect(0, 0, windowWidth, windowHeight);

  // 背景
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
  // 标题
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
  ctx.fillText(game.connected ? '● 服务器已连接' : '● 服务器未连接', windowWidth / 2, windowHeight - 30);
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
  // 标题
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

  // 黑方
  drawPlayerSlot(40, 250, '黑方', game.blackPlayer);

  // 白方
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
  // 顶部信息
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('五子棋对战', windowWidth / 2, 30);

  const turnText = game.currentPlayer === 'black' ? '黑方回合' : '白方回合';
  ctx.font = '14px Arial';
  ctx.fillText(turnText, windowWidth / 2, 50);

  // 计算棋盘尺寸
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

  // 当前回合指示（如果是我的回合）
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
  // 棋子图标
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

  // 活跃指示
  if (isActive) {
    ctx.strokeStyle = '#4a90e2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 名称
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
    case 'menu':
      handleMenuTouch(x, y);
      break;
    case 'lobby':
      handleLobbyTouch(x, y);
      break;
    case 'game':
      handleGameTouch(x, y);
      break;
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
          joinRoom(res.content.trim());
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
      sendMessage('start_game');
    } else {
      sendMessage('ready');
    }
    return;
  }

  // 邀请好友
  if (y >= 500 && y <= 550 && x >= 30 && x <= windowWidth - 30) {
    wx.shareAppMessage({
      title: `五子棋对战 - 房间号: ${game.roomId}`,
      path: `/game.js?room=${game.roomId}`
    });
    return;
  }

  // 返回
  if (y >= 570 && y <= 620 && x >= 30 && x <= windowWidth - 30) {
    sendMessage('leave_room');
    game.scene = 'menu';
    game.roomId = null;
    drawBoard();
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
        // 只有自己的回合才能落子
        if (game.myColor === game.currentPlayer && !game.gameOver) {
          sendMessage('make_move', { x: bx, y: by });
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
      sendMessage('restart_game');
      return;
    }

    // 认输
    if (x >= startX + btnW + gap && x <= startX + (btnW + gap) * 2) {
      wx.showModal({
        title: '确认认输',
        content: '确定要认输吗？',
        success: (res) => {
          if (res.confirm) sendMessage('surrender');
        }
      });
      return;
    }

    // 返回
    if (x >= startX + (btnW + gap) * 2 && x <= startX + (btnW + gap) * 3) {
      sendMessage('leave_room');
      game.scene = 'menu';
      game.roomId = null;
      drawBoard();
      return;
    }
  }
}

// ==================== 游戏操作 ====================
function createRoom(roomName) {
  if (!game.connected) {
    wx.showToast({ title: '未连接服务器', icon: 'none' });
    return;
  }
  game.isCreator = true;
  sendMessage('create_room', { roomName, playerName: game.playerName });
}

function joinRoom(roomId) {
  if (!game.connected) {
    wx.showToast({ title: '未连接服务器', icon: 'none' });
    return;
  }
  if (!roomId || roomId.length < 4) {
    wx.showToast({ title: '请输入有效房间号', icon: 'none' });
    return;
  }
  game.isCreator = false;
  sendMessage('join_room', { roomId, playerName: game.playerName });
}

function quickMatch() {
  if (!game.connected) {
    wx.showToast({ title: '未连接服务器', icon: 'none' });
    return;
  }
  wx.showLoading({ title: '匹配中...' });
  // 创建一个房间等待他人加入
  game.isCreator = true;
  sendMessage('create_room', { roomName: '快速匹配', playerName: game.playerName });
}

// ==================== 分享 ====================
wx.showShareMenu({ withShareTicket: true });
wx.onShareAppMessage(() => ({
  title: '五子棋对战 - 来和我对弈吧！',
  path: game.roomId ? `/game.js?room=${game.roomId}` : '/game.js'
}));

// ==================== 启动 ====================
// 检查启动参数（通过分享链接进入）
const launchOptions = wx.getLaunchOptionsSync();
if (launchOptions.query && launchOptions.query.room) {
  // 通过分享链接加入房间
  game.scene = 'menu';
  connectWebSocket().then(() => {
    joinRoom(launchOptions.query.room);
  }).catch(err => {
    console.error('连接失败:', err);
  });
} else {
  // 正常启动
  connectWebSocket().catch(err => {
    console.error('连接失败:', err);
  });
}

// 初始化并绘制
initBoard();
drawBoard();