/**
 * 游戏状态管理工具
 */

/**
 * 创建初始棋盘
 */
function createBoard(size = 15) {
  const board = [];
  for (let i = 0; i < size; i++) {
    board[i] = [];
    for (let j = 0; j < size; j++) {
      board[i][j] = 0;
    }
  }
  return board;
}

/**
 * 检查是否获胜
 */
function checkWinner(board, x, y, player) {
  const size = board.length;
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

      if (newX >= 0 && newX < size && newY >= 0 && newY < size && 
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

      if (newX >= 0 && newX < size && newY >= 0 && newY < size && 
          board[newX][newY] === player) {
        count++;
      } else {
        break;
      }
    }

    // 检查是否五连
    if (count >= 5) {
      return true;
    }
  }

  return false;
}

/**
 * 检查是否平局
 */
function isDraw(board) {
  for (let i = 0; i < board.length; i++) {
    for (let j = 0; j < board[i].length; j++) {
      if (board[i][j] === 0) {
        return false;
      }
    }
  }
  return true;
}

/**
 * 获取所有可能的落子位置
 */
function getPossibleMoves(board) {
  const moves = [];
  const size = board.length;

  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      if (board[i][j] === 0) {
        moves.push({ x: i, y: j });
      }
    }
  }

  return moves;
}

/**
 * 计算位置分数（用于AI评估）
 */
function evaluatePosition(board, x, y, player) {
  const size = board.length;
  const directions = [
    [1, 0],  // 水平
    [0, 1],  // 垂直
    [1, 1],  // 右下对角线
    [1, -1]  // 左下对角线
  ];

  let score = 0;

  for (const [dx, dy] of directions) {
    let count = 0;
    let openEnds = 0;

    // 正向检查
    for (let i = 1; i <= 4; i++) {
      const newX = x + dx * i;
      const newY = y + dy * i;

      if (newX >= 0 && newX < size && newY >= 0 && newY < size) {
        if (board[newX][newY] === player) {
          count++;
        } else if (board[newX][newY] === 0) {
          openEnds++;
          break;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    // 反向检查
    for (let i = 1; i <= 4; i++) {
      const newX = x - dx * i;
      const newY = y - dy * i;

      if (newX >= 0 && newX < size && newY >= 0 && newY < size) {
        if (board[newX][newY] === player) {
          count++;
        } else if (board[newX][newY] === 0) {
          openEnds++;
          break;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    // 根据连子数和开放端数计算分数
    if (count >= 4) {
      score += 100000; // 必胜
    } else if (count === 3) {
      if (openEnds === 2) {
        score += 10000; // 活四
      } else if (openEnds === 1) {
        score += 1000; // 冲四
      }
    } else if (count === 2) {
      if (openEnds === 2) {
        score += 1000; // 活三
      } else if (openEnds === 1) {
        score += 100; // 眠三
      }
    } else if (count === 1) {
      if (openEnds === 2) {
        score += 100; // 活二
      } else if (openEnds === 1) {
        score += 10; // 眠二
      }
    }
  }

  return score;
}

/**
 * 简单的AI移动（随机选择）
 */
function getAIMove(board, player) {
  const possibleMoves = getPossibleMoves(board);
  
  if (possibleMoves.length === 0) {
    return null;
  }

  // 随机选择一个位置
  const randomIndex = Math.floor(Math.random() * possibleMoves.length);
  return possibleMoves[randomIndex];
}

/**
 * 智能AI移动（基于评估函数）
 */
function getSmartAIMove(board, player) {
  const possibleMoves = getPossibleMoves(board);
  
  if (possibleMoves.length === 0) {
    return null;
  }

  let bestScore = -1;
  let bestMove = null;

  for (const move of possibleMoves) {
    // 临时放置棋子
    board[move.x][move.y] = player;
    
    // 评估这个位置
    const score = evaluatePosition(board, move.x, move.y, player);
    
    // 恢复棋盘
    board[move.x][move.y] = 0;
    
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

module.exports = {
  createBoard,
  checkWinner,
  isDraw,
  getPossibleMoves,
  evaluatePosition,
  getAIMove,
  getSmartAIMove
};