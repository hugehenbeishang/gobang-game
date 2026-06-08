/**
 * 五子棋实时对战WebSocket服务器
 */

const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const http = require('http');

// 创建HTTP服务器
const server = http.createServer((req, res) => {
  // 健康检查接口
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', rooms: rooms.size, players: players.size, uptime: process.uptime() }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('五子棋WebSocket服务器运行中');
});

// 创建WebSocket服务器
const wss = new WebSocket.Server({ server });

// 房间管理
const rooms = new Map();
const players = new Map();

// 消息类型
const MESSAGE_TYPES = {
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  CREATE_ROOM: 'create_room',
  READY: 'ready',
  MAKE_MOVE: 'make_move',
  UNDO_MOVE: 'undo_move',
  RESTART_GAME: 'restart_game',
  SURRENDER: 'surrender',
  GAME_STATE: 'game_state',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  GAME_START: 'game_start',
  GAME_OVER: 'game_over',
  ERROR: 'error'
};

// 房间类
class Room {
  constructor(id, name, creator) {
    this.id = id;
    this.name = name;
    this.creator = creator;
    this.players = new Map();
    this.board = this.createBoard();
    this.currentPlayer = 'black';
    this.moveCount = 0;
    this.gameOver = false;
    this.winner = null;
    this.status = 'waiting'; // waiting, ready, playing, finished
    this.createdAt = Date.now();
  }

  // 创建棋盘
  createBoard() {
    const board = [];
    for (let i = 0; i < 15; i++) {
      board[i] = [];
      for (let j = 0; j < 15; j++) {
        board[i][j] = 0;
      }
    }
    return board;
  }

  // 添加玩家
  addPlayer(player) {
    if (this.players.size >= 2) {
      return false;
    }

    // 分配棋色
    let color = 'black';
    if (this.players.has('black')) {
      color = 'white';
    }

    player.color = color;
    this.players.set(color, player);

    // 更新房间状态
    if (this.players.size === 2) {
      this.status = 'ready';
    }

    return true;
  }

  // 移除玩家
  removePlayer(playerId) {
    for (const [color, player] of this.players.entries()) {
      if (player.id === playerId) {
        this.players.delete(color);
        break;
      }
    }

    // 更新房间状态
    if (this.players.size === 0) {
      this.status = 'empty';
    } else {
      this.status = 'waiting';
    }

    return this.players.size;
  }

  // 开始游戏
  startGame() {
    if (this.players.size !== 2) {
      return false;
    }

    this.status = 'playing';
    this.board = this.createBoard();
    this.currentPlayer = 'black';
    this.moveCount = 0;
    this.gameOver = false;
    this.winner = null;

    return true;
  }

  // 落子
  makeMove(x, y, playerId) {
    if (this.gameOver || this.status !== 'playing') {
      return { success: false, message: '游戏未在进行中' };
    }

    // 检查是否轮到该玩家
    const player = this.players.get(this.currentPlayer);
    if (!player || player.id !== playerId) {
      return { success: false, message: '不是你的回合' };
    }

    // 检查位置是否有效
    if (x < 0 || x >= 15 || y < 0 || y >= 15) {
      return { success: false, message: '位置无效' };
    }

    if (this.board[x][y] !== 0) {
      return { success: false, message: '该位置已有棋子' };
    }

    // 落子
    this.board[x][y] = this.currentPlayer === 'black' ? 1 : 2;
    this.moveCount++;

    // 检查是否获胜
    const winner = this.checkWinner(x, y);
    if (winner) {
      this.gameOver = true;
      this.winner = this.currentPlayer;
      this.status = 'finished';
      return { 
        success: true, 
        gameOver: true, 
        winner: this.currentPlayer,
        winnerId: player.id
      };
    }

    // 检查是否平局
    if (this.moveCount === 15 * 15) {
      this.gameOver = true;
      this.status = 'finished';
      return { success: true, gameOver: true, winner: null };
    }

    // 切换玩家
    this.currentPlayer = this.currentPlayer === 'black' ? 'white' : 'black';

    return { success: true, gameOver: false };
  }

  // 检查是否获胜
  checkWinner(x, y) {
    const player = this.currentPlayer === 'black' ? 1 : 2;
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

        if (newX >= 0 && newX < 15 && newY >= 0 && newY < 15 && 
            this.board[newX][newY] === player) {
          count++;
        } else {
          break;
        }
      }

      // 反向检查
      for (let i = 1; i < 5; i++) {
        const newX = x - dx * i;
        const newY = y - dy * i;

        if (newX >= 0 && newX < 15 && newY >= 0 && newY < 15 && 
            this.board[newX][newY] === player) {
          count++;
        } else {
          break;
        }
      }

      if (count >= 5) {
        return true;
      }
    }

    return false;
  }

  // 获取房间状态
  getState() {
    const players = {};
    for (const [color, player] of this.players.entries()) {
      players[color] = {
        id: player.id,
        name: player.name,
        ready: player.ready || false
      };
    }

    return {
      id: this.id,
      name: this.name,
      creator: this.creator,
      players,
      board: this.board,
      currentPlayer: this.currentPlayer,
      moveCount: this.moveCount,
      gameOver: this.gameOver,
      winner: this.winner,
      status: this.status
    };
  }
}

// WebSocket连接处理
wss.on('connection', (ws) => {
  const playerId = uuidv4();
  console.log(`玩家连接: ${playerId}`);

  // 发送玩家ID
  ws.send(JSON.stringify({
    type: 'connected',
    playerId
  }));

  // 处理消息
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleMessage(ws, playerId, message);
    } catch (err) {
      console.error('解析消息失败:', err);
      ws.send(JSON.stringify({
        type: MESSAGE_TYPES.ERROR,
        message: '消息格式错误'
      }));
    }
  });

  // 处理断开连接
  ws.on('close', () => {
    console.log(`玩家断开连接: ${playerId}`);
    handlePlayerDisconnect(playerId);
  });
});

// 处理消息
function handleMessage(ws, playerId, message) {
  const { type, payload } = message;

  switch (type) {
    case MESSAGE_TYPES.CREATE_ROOM:
      createRoom(ws, playerId, payload);
      break;

    case MESSAGE_TYPES.JOIN_ROOM:
      joinRoom(ws, playerId, payload);
      break;

    case MESSAGE_TYPES.LEAVE_ROOM:
      leaveRoom(ws, playerId);
      break;

    case MESSAGE_TYPES.READY:
      playerReady(ws, playerId);
      break;

    case MESSAGE_TYPES.MAKE_MOVE:
      makeMove(ws, playerId, payload);
      break;

    case MESSAGE_TYPES.UNDO_MOVE:
      undoMove(ws, playerId);
      break;

    case MESSAGE_TYPES.RESTART_GAME:
      restartGame(ws, playerId);
      break;

    case MESSAGE_TYPES.SURRENDER:
      surrender(ws, playerId);
      break;

    default:
      ws.send(JSON.stringify({
        type: MESSAGE_TYPES.ERROR,
        message: '未知消息类型'
      }));
  }
}

// 创建房间
function createRoom(ws, playerId, payload) {
  const { roomName, playerName } = payload;
  const roomId = uuidv4().substring(0, 6).toUpperCase();
  
  const room = new Room(roomId, roomName, playerId);
  rooms.set(roomId, room);

  // 创建玩家
  const player = {
    id: playerId,
    name: playerName,
    ws,
    ready: false
  };

  // 添加玩家到房间
  room.addPlayer(player);
  players.set(playerId, { roomId, player });

  // 发送房间信息
  ws.send(JSON.stringify({
    type: 'room_created',
    roomId,
    room: room.getState()
  }));

  console.log(`房间创建: ${roomId}, 玩家: ${playerId}`);
}

// 加入房间
function joinRoom(ws, playerId, payload) {
  const { roomId, playerName } = payload;
  
  const room = rooms.get(roomId);
  if (!room) {
    ws.send(JSON.stringify({
      type: MESSAGE_TYPES.ERROR,
      message: '房间不存在'
    }));
    return;
  }

  if (room.players.size >= 2) {
    ws.send(JSON.stringify({
      type: MESSAGE_TYPES.ERROR,
      message: '房间已满'
    }));
    return;
  }

  // 创建玩家
  const player = {
    id: playerId,
    name: playerName,
    ws,
    ready: false
  };

  // 添加玩家到房间
  const added = room.addPlayer(player);
  if (!added) {
    ws.send(JSON.stringify({
      type: MESSAGE_TYPES.ERROR,
      message: '加入房间失败'
    }));
    return;
  }

  players.set(playerId, { roomId, player });

  // 通知房间内所有玩家
  broadcastToRoom(roomId, {
    type: MESSAGE_TYPES.PLAYER_JOINED,
    player: {
      id: playerId,
      name: playerName,
      color: player.color
    },
    room: room.getState()
  });

  // 发送房间信息给新玩家
  ws.send(JSON.stringify({
    type: 'room_joined',
    roomId,
    room: room.getState()
  }));

  console.log(`玩家加入房间: ${roomId}, 玩家: ${playerId}`);
}

// 离开房间
function leaveRoom(ws, playerId) {
  const playerInfo = players.get(playerId);
  if (!playerInfo) {
    return;
  }

  const { roomId } = playerInfo;
  const room = rooms.get(roomId);
  
  if (room) {
    const remainingPlayers = room.removePlayer(playerId);
    
    // 通知房间内剩余玩家
    broadcastToRoom(roomId, {
      type: MESSAGE_TYPES.PLAYER_LEFT,
      playerId,
      room: room.getState()
    });

    // 如果房间为空，删除房间
    if (remainingPlayers === 0) {
      rooms.delete(roomId);
      console.log(`房间删除: ${roomId}`);
    }
  }

  players.delete(playerId);
  console.log(`玩家离开房间: ${playerId}`);
}

// 玩家准备
function playerReady(ws, playerId) {
  const playerInfo = players.get(playerId);
  if (!playerInfo) {
    return;
  }

  const { roomId, player } = playerInfo;
  const room = rooms.get(roomId);
  
  if (!room) {
    return;
  }

  // 设置玩家准备状态
  player.ready = true;

  // 检查是否所有玩家都准备好了
  let allReady = true;
  for (const [, p] of room.players.entries()) {
    if (!p.ready) {
      allReady = false;
      break;
    }
  }

  // 如果所有玩家都准备好了，开始游戏
  if (allReady && room.players.size === 2) {
    room.startGame();
    
    // 通知所有玩家游戏开始
    broadcastToRoom(roomId, {
      type: MESSAGE_TYPES.GAME_START,
      room: room.getState()
    });

    console.log(`游戏开始: ${roomId}`);
  } else {
    // 通知房间内所有玩家准备状态
    broadcastToRoom(roomId, {
      type: MESSAGE_TYPES.READY,
      playerId,
      room: room.getState()
    });
  }
}

// 落子
function makeMove(ws, playerId, payload) {
  const { x, y } = payload;
  
  const playerInfo = players.get(playerId);
  if (!playerInfo) {
    return;
  }

  const { roomId } = playerInfo;
  const room = rooms.get(roomId);
  
  if (!room) {
    return;
  }

  // 执行落子
  const result = room.makeMove(x, y, playerId);
  
  if (result.success) {
    // 通知房间内所有玩家
    broadcastToRoom(roomId, {
      type: MESSAGE_TYPES.GAME_STATE,
      move: { x, y, player: room.currentPlayer === 'black' ? 'white' : 'black' },
      room: room.getState()
    });

    // 如果游戏结束，通知所有玩家
    if (result.gameOver) {
      broadcastToRoom(roomId, {
        type: MESSAGE_TYPES.GAME_OVER,
        winner: result.winner,
        winnerId: result.winnerId,
        room: room.getState()
      });

      console.log(`游戏结束: ${roomId}, 获胜者: ${result.winner}`);
    }
  } else {
    ws.send(JSON.stringify({
      type: MESSAGE_TYPES.ERROR,
      message: result.message
    }));
  }
}

// 悔棋
function undoMove(ws, playerId) {
  const playerInfo = players.get(playerId);
  if (!playerInfo) {
    return;
  }

  const { roomId } = playerInfo;
  const room = rooms.get(roomId);
  
  if (!room || room.moveCount === 0) {
    return;
  }

  // 简化处理：实际项目中需要记录历史步骤
  ws.send(JSON.stringify({
    type: MESSAGE_TYPES.ERROR,
    message: '悔棋功能开发中'
  }));
}

// 重新开始游戏
function restartGame(ws, playerId) {
  const playerInfo = players.get(playerId);
  if (!playerInfo) {
    return;
  }

  const { roomId } = playerInfo;
  const room = rooms.get(roomId);
  
  if (!room) {
    return;
  }

  // 重新开始游戏
  room.startGame();

  // 通知房间内所有玩家
  broadcastToRoom(roomId, {
    type: MESSAGE_TYPES.GAME_START,
    room: room.getState()
  });

  console.log(`游戏重新开始: ${roomId}`);
}

// 认输
function surrender(ws, playerId) {
  const playerInfo = players.get(playerId);
  if (!playerInfo) {
    return;
  }

  const { roomId, player } = playerInfo;
  const room = rooms.get(roomId);
  
  if (!room || room.gameOver) {
    return;
  }

  // 确定获胜者
  const winner = player.color === 'black' ? 'white' : 'black';
  const winnerPlayer = room.players.get(winner);

  room.gameOver = true;
  room.winner = winner;
  room.status = 'finished';

  // 通知房间内所有玩家
  broadcastToRoom(roomId, {
    type: MESSAGE_TYPES.GAME_OVER,
    winner,
    winnerId: winnerPlayer ? winnerPlayer.id : null,
    surrender: true,
    room: room.getState()
  });

  console.log(`玩家认输: ${playerId}, 获胜者: ${winner}`);
}

// 处理玩家断开连接
function handlePlayerDisconnect(playerId) {
  const playerInfo = players.get(playerId);
  if (!playerInfo) {
    return;
  }

  const { roomId } = playerInfo;
  const room = rooms.get(roomId);
  
  if (room) {
    const remainingPlayers = room.removePlayer(playerId);
    
    // 通知房间内剩余玩家
    broadcastToRoom(roomId, {
      type: MESSAGE_TYPES.PLAYER_LEFT,
      playerId,
      room: room.getState()
    });

    // 如果房间为空，删除房间
    if (remainingPlayers === 0) {
      rooms.delete(roomId);
      console.log(`房间删除: ${roomId}`);
    }
  }

  players.delete(playerId);
}

// 向房间内所有玩家广播消息
function broadcastToRoom(roomId, message) {
  const room = rooms.get(roomId);
  if (!room) {
    return;
  }

  const data = JSON.stringify(message);
  
  for (const [, player] of room.players.entries()) {
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(data);
    }
  }
}

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`五子棋WebSocket服务器运行在端口 ${PORT}`);
  console.log(`访问地址: http://localhost:${PORT}`);
});

// 定期清理空房间
setInterval(() => {
  for (const [roomId, room] of rooms.entries()) {
    if (room.players.size === 0) {
      rooms.delete(roomId);
      console.log(`清理空房间: ${roomId}`);
    }
  }
}, 60000); // 每分钟清理一次