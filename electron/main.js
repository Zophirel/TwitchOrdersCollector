const { app, BrowserWindow, ipcMain, Notification, shell } = require('electron');
const path = require('path');
const { initializeDatabase } = require('../core/db/database');
const { createSettingsRepository } = require('../core/repositories/settingsRepository');
const { createRequestRepository } = require('../core/repositories/requestRepository');
const { createOrderRepository } = require('../core/repositories/orderRepository');
const { createDashboardService } = require('../core/services/dashboardService');
const { createRequestService } = require('../core/services/requestService');
const { createOrderService } = require('../core/services/orderService');
const { TwitchEventSubClient } = require('../core/services/twitchEventSubClient');
const { TwitchOAuthService } = require('../core/services/twitchOAuthService');
const { MkcertService } = require('../core/services/mkcertService');
const { normalizeRequestedText } = require('../core/utils/normalization');

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
app.setAppUserModelId('com.franc.twitchorderscollector');
let mainWindow;
let botClient;
let settingsRepository;
let requestRepository;
let orderRepository;
let dashboardService;
let requestService;
let orderService;
let oauthService;
let mkcertService;

function getDatabasePath() {
  const baseDir = isDev ? path.join(__dirname, '..', 'data') : path.join(app.getPath('userData'), 'data');
  return path.join(baseDir, 'twitch-orders-collector.sqlite3');
}

function getCertificatesDirectory() {
  return isDev ? path.join(__dirname, '..', 'data', 'certs') : path.join(app.getPath('userData'), 'certs');
}

function sendRendererEvent(type, payload = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:event', { type, payload });
  }
}

async function withCurrentSettings() {
  return settingsRepository.getSettings();
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: '#11161c',
    title: 'Twitch Orders Collector',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'renderer', 'index.html'));
  }
}

function registerBotEventHandlers() {
  botClient.on('state', (state) => {
    sendRendererEvent('bot:state', state);
  });

  botClient.on('request:stored', async (requestRecord) => {
    sendRendererEvent('request:new', requestRecord);

    if (Notification.isSupported()) {
      new Notification({
        title: 'New Twitch request',
        body: `${requestRecord.chatter_user_name}: ${requestRecord.requested_text}`
      }).show();
    }

    const settings = settingsRepository.getSettings();
    const summary = dashboardService.getDashboardSummary(settings.popularityDemotions || {});
    sendRendererEvent('dashboard:summary', summary);
  });

  botClient.on('order:stored', async (orderRecord) => {
    sendRendererEvent('order:new', orderRecord);

    if (Notification.isSupported()) {
      new Notification({
        title: 'New Twitch order',
        body: `${orderRecord.chatter_user_name}: ${orderRecord.ordered_text} (€${Number(orderRecord.price_amount || 0).toFixed(2)})`
      }).show();
    }

    const settings = settingsRepository.getSettings();
    const summary = dashboardService.getDashboardSummary(settings.popularityDemotions || {});
    sendRendererEvent('dashboard:summary', summary);
  });

  botClient.on('error', (error) => {
    sendRendererEvent('bot:error', {
      message: error.message
    });
  });
}

function registerOAuthEventHandlers() {
  oauthService.on('status', (payload) => {
    sendRendererEvent('oauth:status', payload);
  });

  oauthService.on('complete', (payload) => {
    sendRendererEvent('oauth:complete', payload);
  });

  oauthService.on('error', (error) => {
    sendRendererEvent('oauth:error', {
      message: error.message
    });
  });
}

function registerIpcHandlers() {
  ipcMain.handle('settings:get', async () => withCurrentSettings());
  ipcMain.handle('settings:save', async (_, payload) => settingsRepository.saveSettings(payload));
  ipcMain.handle('mkcert:ensure', async (_, payload) => {
    const settings = settingsRepository.saveSettings(payload || {});
    const result = await mkcertService.ensureCertificate(settings, {
      force: Boolean(payload && payload.forceMkcertRegenerate)
    });
    const nextSettings = settingsRepository.saveSettings({
      mkcertCertPath: result.certPath,
      mkcertKeyPath: result.keyPath
    });
    return {
      ...result,
      settings: nextSettings
    };
  });
  ipcMain.handle('oauth:getRedirectUrl', async (_, payload) => {
    const settings = {
      ...(await withCurrentSettings()),
      ...(payload || {})
    };
    return oauthService.getRedirectUrl(settings);
  });
  ipcMain.handle('oauth:begin', async (_, payload) => {
    const settings = settingsRepository.saveSettings(payload || {});
    return oauthService.beginAuthorization(settings);
  });
  ipcMain.handle('oauth:cancel', async () => oauthService.cancelPendingAuthorization());

  ipcMain.handle('bot:start', async () => {
    const settings = await withCurrentSettings();
    return botClient.start(settings);
  });

  ipcMain.handle('bot:stop', async () => botClient.stop());

  ipcMain.handle('bot:testConnection', async (_, payload) => {
    const settings = {
      ...(await withCurrentSettings()),
      ...(payload || {})
    };
    return botClient.testConnection(settings);
  });
  ipcMain.handle('twitch:resolveChannel', async (_, payload) => {
    const settings = {
      ...(await withCurrentSettings()),
      ...(payload || {})
    };
    const result = await botClient.getUserByLogin(settings.channelLogin, settings);
    if (!result) {
      throw new Error(`The configured channel login "${settings.channelLogin}" does not exist on Twitch.`);
    }

    const nextSettings = settingsRepository.saveSettings({
      channelUserId: result.id,
      channelLogin: result.login,
      channelName: result.display_name
    });

    return {
      user: result,
      settings: nextSettings
    };
  });

  ipcMain.handle('dashboard:getSummary', async () => {
    const settings = await withCurrentSettings();
    const summary = dashboardService.getDashboardSummary(settings.popularityDemotions || {});
    return {
      ...summary,
      connectionState: botClient.getState()
    };
  });

  ipcMain.handle('requests:getRecent', async (_, filters) => requestRepository.listRecentRequests(filters));
  ipcMain.handle('requests:getTopItems', async (_, limit) => {
    const settings = await withCurrentSettings();
    return requestRepository.listTopRequestedItems(limit, settings.popularityDemotions || {});
  });
  ipcMain.handle('requests:getPopularityGroups', async (_, limit) => {
    const settings = await withCurrentSettings();
    return requestRepository.listPopularityGroups(
      limit,
      settings.popularityDemotions || {},
      settings.popularityGroupTailOrder || []
    );
  });
  ipcMain.handle('requests:demotePopularityGroup', async (_, groupKey) => {
    const settings = await withCurrentSettings();
    const normalizedGroupKey = String(groupKey || '').trim();

    if (!normalizedGroupKey) {
      throw new Error('A popularity group key is required.');
    }

    const currentTailOrder = Array.isArray(settings.popularityGroupTailOrder)
      ? settings.popularityGroupTailOrder.map((value) => String(value || '').trim()).filter(Boolean)
      : [];

    const nextTailOrder = [
      ...currentTailOrder.filter((value) => value !== normalizedGroupKey),
      normalizedGroupKey
    ];

    settingsRepository.saveSettings({
      popularityGroupTailOrder: nextTailOrder
    });

    return {
      groupKey: normalizedGroupKey,
      tailPosition: nextTailOrder.indexOf(normalizedGroupKey) + 1
    };
  });
  ipcMain.handle('requests:demotePopularityItem', async (_, normalizedItem) => {
    const settings = await withCurrentSettings();
    const normalizedKey = String(normalizedItem || '').trim();

    if (!normalizedKey) {
      throw new Error('A normalized popularity item is required.');
    }

    const currentDemotions = settings.popularityDemotions || {};
    const nextDemotions = {
      ...currentDemotions,
      [normalizedKey]: Number(currentDemotions[normalizedKey] || 0) + 1
    };

    settingsRepository.saveSettings({
      popularityDemotions: nextDemotions
    });

    const summary = dashboardService.getDashboardSummary(nextDemotions);
    sendRendererEvent('dashboard:summary', summary);

    return {
      normalizedItem: normalizedKey,
      demotionCount: nextDemotions[normalizedKey]
    };
  });
  ipcMain.handle('requests:getUsers', async () => requestRepository.listUsers());
  ipcMain.handle('requests:getUserRequests', async (_, chatterUserId) => requestRepository.listRequestsByUser(chatterUserId));
  ipcMain.handle('requests:getItemRequests', async (_, normalizedItem) => requestRepository.listRequestsByItem(normalizedItem));
  ipcMain.handle('orders:getUsers', async () => orderRepository.listOrderUsers());
  ipcMain.handle('orders:getRecent', async (_, filters) => orderRepository.listRecentOrders(filters));
  ipcMain.handle('orders:update', async (_, payload) => {
    const orderId = Number(payload?.id);
    const orderedText = String(payload?.orderedText || '').trim();
    const priceAmount = Number(payload?.priceAmount);
    const settings = await withCurrentSettings();

    if (!Number.isInteger(orderId) || orderId <= 0) {
      throw new Error('A valid order ID is required.');
    }

    if (!orderedText) {
      throw new Error('Product name cannot be empty.');
    }

    if (!Number.isFinite(priceAmount) || priceAmount < 0) {
      throw new Error('Price must be a valid non-negative number.');
    }

    const normalizedOrderedText = normalizeRequestedText(orderedText, {
      stripEdgePunctuation: settings.stripEdgePunctuation
    });

    if (!normalizedOrderedText) {
      throw new Error('Product name cannot be normalized to an empty value.');
    }

    const updatedOrder = orderRepository.updateOrder(orderId, {
      ordered_text: orderedText,
      normalized_ordered_text: normalizedOrderedText,
      price_amount: priceAmount
    });

    const summary = dashboardService.getDashboardSummary(settings.popularityDemotions || {});
    sendRendererEvent('dashboard:summary', summary);

    return updatedOrder;
  });
  ipcMain.handle('orders:delete', async (_, orderIdPayload) => {
    const orderId = Number(orderIdPayload);
    const settings = await withCurrentSettings();

    if (!Number.isInteger(orderId) || orderId <= 0) {
      throw new Error('A valid order ID is required.');
    }

    const deletedOrder = orderRepository.deleteOrder(orderId);
    if (!deletedOrder) {
      throw new Error('Order not found.');
    }

    const summary = dashboardService.getDashboardSummary(settings.popularityDemotions || {});
    sendRendererEvent('dashboard:summary', summary);

    return deletedOrder;
  });
  ipcMain.handle('orders:restore', async (_, orderPayload) => {
    const orderId = Number(orderPayload?.id);
    const settings = await withCurrentSettings();

    if (!Number.isInteger(orderId) || orderId <= 0) {
      throw new Error('A valid order payload is required to restore an order.');
    }

    const restoredOrder = orderRepository.restoreOrder(orderPayload);
    const summary = dashboardService.getDashboardSummary(settings.popularityDemotions || {});
    sendRendererEvent('dashboard:summary', summary);

    return restoredOrder;
  });
}

async function bootstrap() {
  const database = await initializeDatabase(getDatabasePath());
  settingsRepository = createSettingsRepository(database);
  requestRepository = createRequestRepository(database);
  orderRepository = createOrderRepository(database);
  dashboardService = createDashboardService(requestRepository, orderRepository);
  requestService = createRequestService(requestRepository, settingsRepository);
  orderService = createOrderService(orderRepository, settingsRepository);

  botClient = new TwitchEventSubClient({
    requestService,
    orderService,
    settingsRepository
  });
  oauthService = new TwitchOAuthService({
    settingsRepository,
    openExternal: (url) => shell.openExternal(url)
  });
  mkcertService = new MkcertService({
    outputDir: getCertificatesDirectory()
  });

  registerBotEventHandlers();
  registerOAuthEventHandlers();
  registerIpcHandlers();
  await createMainWindow();
}

app.whenReady()
  .then(bootstrap)
  .catch((error) => {
    console.error('Application bootstrap failed:', error);
    app.quit();
  });

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  if (botClient) {
    await botClient.stop();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createMainWindow();
  }
});
