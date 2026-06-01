const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('twitchOrders', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (payload) => ipcRenderer.invoke('settings:save', payload),
  ensureMkcertCertificate: (payload) => ipcRenderer.invoke('mkcert:ensure', payload),
  getOAuthRedirectUrl: (payload) => ipcRenderer.invoke('oauth:getRedirectUrl', payload),
  beginOAuthLogin: (payload) => ipcRenderer.invoke('oauth:begin', payload),
  cancelOAuthLogin: () => ipcRenderer.invoke('oauth:cancel'),
  resolveChannelFromLogin: (payload) => ipcRenderer.invoke('twitch:resolveChannel', payload),
  startBot: () => ipcRenderer.invoke('bot:start'),
  stopBot: () => ipcRenderer.invoke('bot:stop'),
  testConnection: (payload) => ipcRenderer.invoke('bot:testConnection', payload),
  getDashboardSummary: () => ipcRenderer.invoke('dashboard:getSummary'),
  getRecentRequests: (filters) => ipcRenderer.invoke('requests:getRecent', filters),
  getTopItems: (limit) => ipcRenderer.invoke('requests:getTopItems', limit),
  getPopularityGroups: (limit) => ipcRenderer.invoke('requests:getPopularityGroups', limit),
  demotePopularityGroup: (groupKey) => ipcRenderer.invoke('requests:demotePopularityGroup', groupKey),
  demotePopularityItem: (normalizedItem) => ipcRenderer.invoke('requests:demotePopularityItem', normalizedItem),
  getUsers: () => ipcRenderer.invoke('requests:getUsers'),
  getUserRequests: (userId) => ipcRenderer.invoke('requests:getUserRequests', userId),
  getItemRequests: (normalizedItem) => ipcRenderer.invoke('requests:getItemRequests', normalizedItem),
  getOrderUsers: () => ipcRenderer.invoke('orders:getUsers'),
  getRecentOrders: (filters) => ipcRenderer.invoke('orders:getRecent', filters),
  updateOrder: (payload) => ipcRenderer.invoke('orders:update', payload),
  deleteOrder: (orderId) => ipcRenderer.invoke('orders:delete', orderId),
  restoreOrder: (payload) => ipcRenderer.invoke('orders:restore', payload),
  subscribeToEvents: (handler) => {
    const wrappedHandler = (_, event) => handler(event);
    ipcRenderer.on('app:event', wrappedHandler);
    return () => ipcRenderer.removeListener('app:event', wrappedHandler);
  }
});
