/**
 * 房间管理工具
 */

const ROOM_KEY = 'currentRoom';
const ROOM_LIST_KEY = 'roomList';

/**
 * 创建房间
 */
function createRoom(roomData) {
  const room = {
    code: generateRoomCode(),
    name: roomData.name || '未命名房间',
    creator: roomData.creator,
    creatorColor: roomData.creatorColor || 'black',
    createTime: Date.now(),
    status: 'waiting', // waiting, playing, finished
    players: {
      black: roomData.creator,
      white: null
    },
    board: null,
    moveHistory: []
  };

  try {
    // 保存当前房间
    wx.setStorageSync(ROOM_KEY, room);
    
    // 更新房间列表
    const roomList = getRoomList();
    roomList.push({
      code: room.code,
      name: room.name,
      createTime: room.createTime,
      status: room.status
    });
    wx.setStorageSync(ROOM_LIST_KEY, roomList);
    
    return room;
  } catch (err) {
    console.error('创建房间失败:', err);
    throw err;
  }
}

/**
 * 加入房间
 */
function joinRoom(roomCode, player) {
  try {
    // 获取房间列表
    const roomList = getRoomList();
    const roomIndex = roomList.findIndex(r => r.code === roomCode);
    
    if (roomIndex === -1) {
      throw new Error('房间不存在');
    }
    
    // 获取房间详情（实际项目中应该从服务器获取）
    const room = wx.getStorageSync(ROOM_KEY);
    
    if (!room || room.code !== roomCode) {
      throw new Error('房间数据不存在');
    }
    
    // 检查房间状态
    if (room.status !== 'waiting') {
      throw new Error('房间已开始游戏');
    }
    
    // 检查是否已满
    if (room.players.black && room.players.white) {
      throw new Error('房间已满');
    }
    
    // 加入房间
    if (!room.players.black) {
      room.players.black = player;
    } else if (!room.players.white) {
      room.players.white = player;
    }
    
    // 更新房间状态
    if (room.players.black && room.players.white) {
      room.status = 'ready';
    }
    
    // 保存房间
    wx.setStorageSync(ROOM_KEY, room);
    
    // 更新房间列表
    roomList[roomIndex].status = room.status;
    wx.setStorageSync(ROOM_LIST_KEY, roomList);
    
    return room;
  } catch (err) {
    console.error('加入房间失败:', err);
    throw err;
  }
}

/**
 * 离开房间
 */
function leaveRoom(roomCode, player) {
  try {
    const room = wx.getStorageSync(ROOM_KEY);
    
    if (!room || room.code !== roomCode) {
      return;
    }
    
    // 移除玩家
    if (room.players.black && room.players.black.openid === player.openid) {
      room.players.black = null;
    } else if (room.players.white && room.players.white.openid === player.openid) {
      room.players.white = null;
    }
    
    // 更新房间状态
    if (!room.players.black && !room.players.white) {
      room.status = 'empty';
    } else {
      room.status = 'waiting';
    }
    
    // 保存房间
    wx.setStorageSync(ROOM_KEY, room);
    
    // 如果房间为空，从列表中移除
    if (room.status === 'empty') {
      const roomList = getRoomList();
      const roomIndex = roomList.findIndex(r => r.code === roomCode);
      
      if (roomIndex !== -1) {
        roomList.splice(roomIndex, 1);
        wx.setStorageSync(ROOM_LIST_KEY, roomList);
      }
      
      wx.removeStorageSync(ROOM_KEY);
    }
  } catch (err) {
    console.error('离开房间失败:', err);
  }
}

/**
 * 获取房间列表
 */
function getRoomList() {
  try {
    return wx.getStorageSync(ROOM_LIST_KEY) || [];
  } catch (err) {
    console.error('获取房间列表失败:', err);
    return [];
  }
}

/**
 * 获取当前房间
 */
function getCurrentRoom() {
  try {
    return wx.getStorageSync(ROOM_KEY) || null;
  } catch (err) {
    console.error('获取当前房间失败:', err);
    return null;
  }
}

/**
 * 生成房间号
 */
function generateRoomCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 格式化房间时间
 */
function formatRoomTime(timestamp) {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

module.exports = {
  createRoom,
  joinRoom,
  leaveRoom,
  getRoomList,
  getCurrentRoom,
  formatRoomTime
};