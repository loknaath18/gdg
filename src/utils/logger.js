const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../'); 
const logsDir = path.join(rootDir, 'logs');
const logFile = path.join(logsDir, 'app.log');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Ensure the log file exists
if (!fs.existsSync(logFile)) {
  fs.writeFileSync(logFile, '');
}

function formatLog(type, description) {
  const now = new Date();
  const dateStr = now.getFullYear() + '-' + 
    String(now.getMonth() + 1).padStart(2, '0') + '-' + 
    String(now.getDate()).padStart(2, '0') + ' ' + 
    String(now.getHours()).padStart(2, '0') + ':' + 
    String(now.getMinutes()).padStart(2, '0') + ':' + 
    String(now.getSeconds()).padStart(2, '0');
  return `[${dateStr}] ${type} - ${description}\n`;
}

function info(type, description) {
  const entry = formatLog(type, description);
  fs.appendFileSync(logFile, entry);
}

function error(type, description) {
  const entry = formatLog(`ERROR: ${type}`, description);
  fs.appendFileSync(logFile, entry);
}

function getRecentLogs(lines = 50) {
  if (!fs.existsSync(logFile)) return [];
  const content = fs.readFileSync(logFile, 'utf8');
  const allLines = content.trim().split('\n').filter(line => line.length > 0);
  return allLines.slice(-lines).map(line => {
    // Parse the log line (e.g. "[2026-02-27 01:12:20] APP_START - Application started")
    const match = line.match(/^\[(.*?)\] (.*?) - (.*)$/);
    if (match) {
      return { timestamp: match[1], type: match[2], description: match[3], status: 'Processed' };
    }
    return { timestamp: '', type: 'UNKNOWN', description: line, status: 'Processed' };
  }).reverse();
}

module.exports = {
  info,
  error,
  getRecentLogs
};
