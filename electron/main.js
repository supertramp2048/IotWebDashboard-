// Đổi 'app' thành 'electronApp' để tránh trùng tên
import { app as electronApp, BrowserWindow, Notification } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (process.platform === 'win32') {
    // Sử dụng tên mới ở đây
    electronApp.setAppUserModelId("SmartHomeHKI");
  }

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools(); 
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// Sử dụng tên mới ở đây
electronApp.whenReady().then(() => {
  createWindow();

  electronApp.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

electronApp.on('window-all-closed', () => {
  if (process.platform !== 'darwin') electronApp.quit();
});