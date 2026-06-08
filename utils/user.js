/**
 * 用户相关工具函数
 */

// 模拟用户数据存储（实际项目中应该使用云数据库或自己的服务器）
const USER_KEY = 'userInfo';
const OPENID_KEY = 'openid';

/**
 * 保存用户信息到本地存储
 */
function saveUserInfo(userInfo, openid) {
  try {
    wx.setStorageSync(USER_KEY, userInfo);
    wx.setStorageSync(OPENID_KEY, openid);
    return true;
  } catch (e) {
    console.error('保存用户信息失败:', e);
    return false;
  }
}

/**
 * 获取本地存储的用户信息
 */
function getUserInfo() {
  try {
    const userInfo = wx.getStorageSync(USER_KEY);
    const openid = wx.getStorageSync(OPENID_KEY);
    return {
      userInfo: userInfo || null,
      openid: openid || null,
      isLoggedIn: !!(userInfo && openid)
    };
  } catch (e) {
    console.error('获取用户信息失败:', e);
    return {
      userInfo: null,
      openid: null,
      isLoggedIn: false
    };
  }
}

/**
 * 清除用户信息
 */
function clearUserInfo() {
  try {
    wx.removeStorageSync(USER_KEY);
    wx.removeStorageSync(OPENID_KEY);
    return true;
  } catch (e) {
    console.error('清除用户信息失败:', e);
    return false;
  }
}

/**
 * 模拟微信登录（实际项目中需要调用后端接口）
 */
function mockLogin() {
  return new Promise((resolve, reject) => {
    // 模拟获取openid
    const mockOpenid = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // 模拟用户信息
    const mockUserInfo = {
      nickName: '棋手' + Math.floor(Math.random() * 1000),
      avatarUrl: '/images/default-avatar.svg',
      gender: 0,
      country: '中国',
      province: '北京',
      city: '北京'
    };
    
    // 保存到本地存储
    const saved = saveUserInfo(mockUserInfo, mockOpenid);
    if (saved) {
      resolve({
        userInfo: mockUserInfo,
        openid: mockOpenid
      });
    } else {
      reject(new Error('保存用户信息失败'));
    }
  });
}

/**
 * 获取用户昵称显示
 */
function getDisplayName(userInfo) {
  if (!userInfo) return '未知用户';
  return userInfo.nickName || '匿名棋手';
}

/**
 * 获取用户头像
 */
function getAvatarUrl(userInfo) {
  if (!userInfo || !userInfo.avatarUrl) {
    return '/images/default-avatar.svg';
  }
  return userInfo.avatarUrl;
}

module.exports = {
  saveUserInfo,
  getUserInfo,
  clearUserInfo,
  mockLogin,
  getDisplayName,
  getAvatarUrl
};