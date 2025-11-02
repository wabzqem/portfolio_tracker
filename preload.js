const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getTrades: (options) => ipcRenderer.invoke('get-trades', options),
  getPortfolioSummary: (options) => ipcRenderer.invoke('get-portfolio-summary', options),
  getPositions: () => ipcRenderer.invoke('get-positions'),
  getCapitalGains: (financialYear, method) => ipcRenderer.invoke('get-capital-gains', financialYear, method),
  getCapitalGainsAggregated: (financialYear, method) => ipcRenderer.invoke('get-capital-gains-aggregated', financialYear, method),
  getBestWorstTrades: (options) => ipcRenderer.invoke('get-best-worst-trades', options),
  getFinancialYears: () => ipcRenderer.invoke('get-financial-years'),
  
  // File operations
  loadTradesFile: (filePath) => ipcRenderer.invoke('load-trades-file', filePath),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  checkTradesLoaded: () => ipcRenderer.invoke('check-trades-loaded'),
  
  // Performance data
  getPerformanceData: (options) => ipcRenderer.invoke('get-performance-data', options)
});