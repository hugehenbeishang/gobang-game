/**
 * WebSocket通信工具
 * 用于实时对战通信
 */

class WebSocketManager {
  constructor() {
    this.socketTask = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimer = null;
    this.messageHandlers = new Map();
    this.url = '';
    this.playerId = null;
    this.roomId = null;
  }

  /**
   * 连接WebSocket
   */
  connect(url) {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve();
        return;
      }

      this.url = url;
      
      this.socketTask = wx.connectSocket({
        url: url,
        success: () => {
          console.log('WebSocket连接建立中...');
        },
        fail: (err) => {
          console.error('WebSocket连接失败:', err);
          reject(err);
        }
      });

      this.socketTask.onOpen(() => {
        console.log('WebSocket连接成功');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        resolve();
      });

      this.socketTask.onClose(() => {
        console.log('WebSocket连接关闭');
        this.isConnected = false;
        this.handleReconnect();
      });

      this.socketTask.onError((err) => {
        console.error('WebSocket错误:', err);
        this.isConnected = false;
        reject(err);
      });

      this.socketTask.onMessage((res) => {
        this.handleMessage(res.data);
      });
    });
  }

  /**
   * 处理消息
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      const { type } = message;
      
      // 处理连接成功消息，保存玩家ID
      if (type === 'connected') {
        this.playerId = message.playerId;
        console.log('获得玩家ID:', this.playerId);
      }
      
      if (this.messageHandlers.has(type)) {
        this.messageHandlers.get(type)(message);
      }
      
      // 触发所有处理器
      this.messageHandlers.forEach((handler) => {
        handler(message);
      });
    } catch (err) {
      console.error('解析消息失败:', err);
    }
  }

  /**
   * 注册消息处理器
   */
  onMessage(type, handler) {
    this.messageHandlers.set(type, handler);
  }

  /**
   * 移除消息处理器
   */
  offMessage(type) {
    this.messageHandlers.delete(type);
  }

  /**
   * 发送消息
   */
  send(message) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('WebSocket未连接'));
        return;
      }

      const data = JSON.stringify(message);
      
      this.socketTask.send({
        data: data,
        success: () => {
          resolve();
        },
        fail: (err) => {
          reject(err);
        }
      });
    });
  }

  /**
   * 关闭连接
   */
  close() {
    if (this.socketTask) {
      this.socketTask.close();
      this.isConnected = false;
      
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    }
  }

  /**
   * 处理重连
   */
  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.url) {
      this.reconnectAttempts++;
      
      console.log(`尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      this.reconnectTimer = setTimeout(() => {
        this.connect(this.url).catch(() => {
          console.log('重连失败');
        });
      }, 2000 * this.reconnectAttempts);
    } else {
      console.log('达到最大重连次数，停止重连');
    }
  }
}

// 创建单例实例
const websocketManager = new WebSocketManager();

module.exports = websocketManager;