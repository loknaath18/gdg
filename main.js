const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const logger = require('./src/utils/logger');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, 'src/assets/logo.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        title: 'Street Behavior Coach AI – Control Dashboard',
        backgroundColor: '#0f172a',
    });

    mainWindow.loadFile('src/index.html');

    // Make sure to disable default menu for a cleaner app look
    mainWindow.setMenu(null);

    // Create uploads folder if it doesn't exist
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir);
    }

    logger.info('APP_START', 'Application started');

    mainWindow.on('closed', () => {
        logger.info('APP_CLOSE', 'Application closed');
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// IPC communication endpoints
ipcMain.handle('select-image', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg'] }]
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const sourcePath = result.filePaths[0];
    const fileName = `${Date.now()}-${path.basename(sourcePath)}`;
    const destPath = path.join(__dirname, 'uploads', fileName);

    fs.copyFileSync(sourcePath, destPath);
    logger.info('IMAGE_UPLOAD', `Image uploaded: ${fileName}`);

    return {
        fileName,
        path: `../uploads/${fileName}`
    };
});

ipcMain.on('log-action', (event, actionType, description) => {
    logger.info(actionType, description);
});

ipcMain.handle('get-logs', () => {
    return logger.getRecentLogs();
});

ipcMain.handle('save-captured-frame', async (event, base64Data) => {
    try {
        const base64Image = base64Data.replace(/^data:image\/png;base64,/, "");
        const fileName = `capture-${Date.now()}.png`;
        const destPath = path.join(__dirname, 'uploads', fileName);

        fs.writeFileSync(destPath, base64Image, 'base64');
        logger.info('FRAME_CAPTURED', `Frame captured and saved: ${fileName}`);

        return {
            fileName,
            path: `../uploads/${fileName}`,
            success: true
        };
    } catch (error) {
        logger.error('CAPTURE_ERROR', `Failed to save frame: ${error.message}`);
        return { success: false, error: error.message };
    }
});
