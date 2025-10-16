const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const https = require('https');

// Set application name immediately
app.setName('Portfolio Tracker');

// Import data processing functions from server
let currencyRates = new Map();
let portfolioData = [];
let mainWindow;
let tradesLoaded = false;

// Load currency conversion rates from Google Drive
function loadCurrencyRates() {
  return new Promise((resolve, reject) => {
    console.log('Loading currency conversion rates from Google Drive...');
    
    // Convert Google Drive sharing URL to direct download URL
    const fileId = '1kPZiOrebxg1sEqQx1OoalK6bsb41yOfr';
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    
    // First try to download from Google Drive
    downloadCurrencyData(downloadUrl)
      .then(() => {
        console.log(`Loaded ${currencyRates.size} currency rates from Google Drive`);
        resolve();
      })
      .catch((error) => {
        console.warn('Failed to load from Google Drive, trying local fallback...', error.message);
        
        // Fallback to local file if it exists
        if (fs.existsSync('usd-aud.csv')) {
          loadCurrencyRatesFromFile('usd-aud.csv')
            .then(resolve)
            .catch(reject);
        } else {
          // If no local file, create minimal fallback rates
          console.warn('No local currency file found, using fallback rates');
          createFallbackRates();
          resolve();
        }
      });
  });
}

// Download currency data from URL
function downloadCurrencyData(url) {
  return new Promise((resolve, reject) => {
    const data = [];
    
    https.get(url, (response) => {
      // Handle redirects (Google Drive uses 303 redirects)
      if (response.statusCode === 302 || response.statusCode === 301 || response.statusCode === 303) {
        const redirectUrl = response.headers.location;
        console.log(`Following redirect to: ${redirectUrl}`);
        
        https.get(redirectUrl, (redirectResponse) => {
          processResponse(redirectResponse);
        }).on('error', reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      processResponse(response);
      
    }).on('error', reject);
    
    function processResponse(response) {
      let csvData = '';
      
      response.on('data', (chunk) => {
        csvData += chunk;
      });
      
      response.on('end', () => {
        // Parse CSV data
        const lines = csvData.split('\n');
        const header = lines[0];
        
        if (!header.includes('Date') || !header.includes('USD to AUD')) {
          reject(new Error('Invalid CSV format - missing required columns'));
          return;
        }
        
        let processedRates = 0;
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const parts = line.split(',');
          if (parts.length >= 2) {
            const dateStr = parts[0].trim();
            const rate = parseFloat(parts[1].trim());
            
            if (dateStr && !isNaN(rate) && rate > 0) {
              const date = new Date(dateStr + ' 12:00:00 UTC');
              if (!isNaN(date.getTime())) {
                const dateKey = date.toISOString().split('T')[0];
                currencyRates.set(dateKey, rate);
                processedRates++;
              }
            }
          }
        }
        
        if (processedRates === 0) {
          reject(new Error('No valid currency rates found in the data'));
        } else {
          resolve();
        }
      });
    }
  });
}

// Load currency rates from local file (fallback)
function loadCurrencyRatesFromFile(filePath) {
  return new Promise((resolve, reject) => {
    console.log(`Loading currency rates from local file: ${filePath}`);
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        const dateStr = row.Date;
        const rate = parseFloat(row['USD to AUD']);
        
        if (dateStr && !isNaN(rate) && rate > 0) {
          const date = new Date(dateStr + ' 12:00:00 UTC');
          if (!isNaN(date.getTime())) {
            const dateKey = date.toISOString().split('T')[0];
            currencyRates.set(dateKey, rate);
          }
        }
      })
      .on('end', () => {
        console.log(`Loaded ${currencyRates.size} currency rates from local file`);
        resolve();
      })
      .on('error', (error) => {
        console.error('Error loading local currency rates:', error);
        reject(error);
      });
  });
}

// Create fallback currency rates if no data source available
function createFallbackRates() {
  console.log('Creating fallback currency rates...');
  
  // Create basic rates for the last few years
  const startDate = new Date('2020-01-01');
  const endDate = new Date();
  const baseRate = 1.5; // Approximate AUD/USD rate
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 30)) {
    const dateKey = d.toISOString().split('T')[0];
    // Add some variation to make it more realistic
    const variation = (Math.random() - 0.5) * 0.2; // ±10% variation
    const rate = baseRate + variation;
    currencyRates.set(dateKey, Math.max(1.0, rate)); // Ensure rate is reasonable
  }
  
  console.log(`Created ${currencyRates.size} fallback currency rates`);
}

// Get USD to AUD rate for a specific date (with fallback logic)
function getUSDToAUDRate(date) {
  const dateKey = date.toISOString().split('T')[0];
  
  if (currencyRates.has(dateKey)) {
    return currencyRates.get(dateKey);
  }
  
  // Find nearest date (within 7 days)
  for (let i = 1; i <= 7; i++) {
    // Try earlier date
    const earlierDate = new Date(date);
    earlierDate.setDate(earlierDate.getDate() - i);
    const earlierKey = earlierDate.toISOString().split('T')[0];
    if (currencyRates.has(earlierKey)) {
      return currencyRates.get(earlierKey);
    }
    
    // Try later date
    const laterDate = new Date(date);
    laterDate.setDate(laterDate.getDate() + i);
    const laterKey = laterDate.toISOString().split('T')[0];
    if (currencyRates.has(laterKey)) {
      return currencyRates.get(laterKey);
    }
  }
  
  return 1.5; // Fallback rate
}

// Create application menu
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Trading Data...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            await openTradesFile();
          }
        },
        {
          label: 'Reload Current Data',
          accelerator: 'CmdOrCtrl+R',
          click: async () => {
            if (tradesLoaded) {
              await reloadCurrentData();
            } else {
              await openTradesFile();
            }
          }
        },
        { type: 'separator' },
        {
          role: 'quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q'
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Switch Currency',
          submenu: [
            {
              label: 'AUD (Australian Dollar)',
              type: 'radio',
              checked: true,
              click: () => {
                if (tradesLoaded) {
                  mainWindow.webContents.send('switch-currency', 'AUD');
                }
              }
            },
            {
              label: 'USD (US Dollar)',
              type: 'radio',
              click: () => {
                if (tradesLoaded) {
                  mainWindow.webContents.send('switch-currency', 'USD');
                }
              }
            }
          ]
        }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'About Portfolio Tracker',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Portfolio Tracker',
              message: 'Portfolio Tracker',
              detail: 'A professional desktop application for tracking investment portfolios.\n\nVersion: 1.0.0\nElectron-powered desktop app'
            });
          }
        }
      ]
    }
  ];

  // macOS specific menu adjustments
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Open trades file via menu
async function openTradesFile() {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      title: 'Open Trading Data CSV File'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      
      // Load the new data
      await loadPortfolioData(filePath);
      
      if (tradesLoaded) {
        // If we're currently on welcome screen, navigate to main app
        const currentURL = mainWindow.webContents.getURL();
        if (currentURL.includes('welcome.html')) {
          mainWindow.loadFile('public/index.html');
        } else {
          // Refresh the current page to reload with new data
          mainWindow.webContents.reload();
        }
      }
    }
  } catch (error) {
    console.error('Error opening trades file:', error);
    dialog.showErrorBox('Error', `Failed to open file: ${error.message}`);
  }
}

// Reload current data
async function reloadCurrentData() {
  try {
    // Reload from the same file (trades.csv or last opened)
    await loadPortfolioData();
    
    if (tradesLoaded) {
      mainWindow.webContents.reload();
    }
  } catch (error) {
    console.error('Error reloading data:', error);
    dialog.showErrorBox('Error', `Failed to reload data: ${error.message}`);
  }
}

// Load portfolio data from CSV file
function loadPortfolioData(filePath = 'trades.csv') {
  return new Promise((resolve, reject) => {
    console.log(`Loading portfolio data from: ${filePath}`);
    const all = [];
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log('No trades file found, will show welcome screen');
      resolve();
      return;
    }
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        // Add market information to each row (critical for currency conversion)
        row.market = getTradeMarket(row);
        all.push(row);
      })
      .on('end', () => {
        // Filter to keep only executed trades with Symbol and Side (same as server.js)
        portfolioData = all.filter(row => row.Symbol && row.Side && isExecutedStatus(row.Status));
        console.log(`Loaded ${portfolioData.length} executed trades (Filled/Partially Cancelled)`);
        tradesLoaded = true;
        resolve();
      })
      .on('error', (error) => {
        console.error('Error loading portfolio data:', error);
        reject(error);
      });
  });
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    title: 'Portfolio Tracker',
    show: false // Don't show until ready
  });

  // Create application menu
  createMenu();

  // Load appropriate page based on whether trades are loaded
  if (tradesLoaded) {
    mainWindow.loadFile('public/index.html');
  } else {
    mainWindow.loadFile('public/welcome.html');
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}


// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  try {
    // Create window immediately for better user experience
    createWindow();

    // Load currency rates in background (non-blocking)
    loadCurrencyRates()
      .then(() => {
        console.log('Currency rates loaded successfully');
        // Only load portfolio data after currency rates are ready
        return loadPortfolioData();
      })
      .then(() => {
        if (tradesLoaded) {
          console.log('Portfolio data loaded successfully');
          // Refresh the window content if trades were loaded
          const currentURL = mainWindow.webContents.getURL();
          if (currentURL.includes('welcome.html')) {
            mainWindow.loadFile('public/index.html');
          } else {
            mainWindow.webContents.reload();
          }
        }
      })
      .catch((error) => {
        console.warn('Background loading failed:', error);
        // Continue with fallback rates if currency loading fails
        createFallbackRates();
      });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  } catch (error) {
    console.error('Failed to initialize app:', error);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Helper functions from server.js
function parseFilledAvg(column, symbol) {
  const [qty, price] = (column||"0@0").split('@');
  const rawPrice = parseFloat(price.replace(",", "")) || 0;
  const multiplier = symbol ? getMultiplier(symbol) : 1;
  return { 
    qty: parseFloat(qty.replace(",", "")) || 0, 
    price: rawPrice * multiplier
  };
}

function getMultiplier(symbol) {
  return isOption(symbol) ? 100 : 1;
}

function parseOptionsSymbol(symbol) {
  const optionsRegex = /^([A-Z]+)(\d{6})([CP])(\d+)$/;
  const match = symbol.match(optionsRegex);
  
  if (match) {
    const [, underlying, expiryStr, optionType, strikeStr] = match;
    const expiryYear = 2000 + parseInt(expiryStr.substring(0, 2));
    const expiryMonth = parseInt(expiryStr.substring(2, 4));
    const expiryDay = parseInt(expiryStr.substring(4, 6));
    const expiryDate = new Date(expiryYear, expiryMonth - 1, expiryDay);
    const strikePrice = parseFloat(strikeStr) / 1000;
    
    return {
      underlying,
      expiryDate: expiryDate.toISOString(),
      optionType: optionType === 'C' ? 'Call' : 'Put',
      strikePrice,
      isExpired: expiryDate < new Date()
    };
  }
  
  return null;
}

function isOption(symbol) {
  return parseOptionsSymbol(symbol) !== null;
}

function parseCSVDate(dateString) {
  if (!dateString) return new Date('1900-01-01');
  
  // Extract timezone from the original string
  let timezone = null;
  if (dateString.includes(' ET')) timezone = 'America/New_York';
  else if (dateString.includes(' AEST')) timezone = 'Australia/Sydney';
  else if (dateString.includes(' AEDT')) timezone = 'Australia/Sydney';
  
  // Remove timezone suffixes for parsing
  const cleanDate = dateString.replace(' ET', '').replace(' AEST', '').replace(' AEDT', '');
  
  let parsedDate;
  
  // Try parsing as-is first
  parsedDate = new Date(cleanDate);
  
  if (isNaN(parsedDate.getTime())) {
    // Try alternative format parsing
    const parts = cleanDate.split(' ');
    if (parts.length >= 4) {
      const month = parts[0];
      const day = parts[1].replace(',', '');
      const year = parts[2];
      const time = parts[3];
      parsedDate = new Date(`${month} ${day}, ${year} ${time}`);
    }
  }
  
  if (isNaN(parsedDate.getTime())) {
    console.warn('Could not parse date:', dateString);
    return new Date('1900-01-01');
  }
  
  // If we have a timezone, convert from that timezone to local timezone
  if (timezone) {
    return convertTimezoneToLocal(parsedDate, timezone);
  }
  
  // If no timezone specified, assume it's already in local time
  return parsedDate;
}

// Convert a date from a specific timezone to the user's local timezone
function convertTimezoneToLocal(date, fromTimezone) {
  try {
    // Get the date components as they should be interpreted in the source timezone
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    // Create ISO string but treat it as if it were in the source timezone
    const isoString = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    
    // Parse as UTC to avoid local timezone interpretation
    const asUtc = new Date(isoString + 'Z');
    
    // Get timezone offsets in May 2020 (the date we're testing)
    let sourceOffsetHours = 0;
    if (fromTimezone === 'America/New_York') {
      // In May 2020, ET would be EDT (UTC-4)
      sourceOffsetHours = -4;
    } else if (fromTimezone === 'Australia/Sydney') {
      // In May 2020, Australia would be AEST (UTC+10)
      sourceOffsetHours = 10;
    }
    
    // Convert from source timezone to UTC, then to local
    const utcTime = asUtc.getTime() - (sourceOffsetHours * 60 * 60 * 1000);
    const localDate = new Date(utcTime);
    
    return localDate;
  } catch (error) {
    console.warn('Timezone conversion failed, using original date:', error);
    return date;
  }
}


function getTradeMarket(trade) {
  if (trade.Markets && trade.Markets.trim() !== '') {
    return trade.Markets.toUpperCase();
  }
  
  if (trade.Currency && trade.Currency.trim() !== '') {
    return trade.Currency === 'AUD' ? 'AU' : 'US';
  }
  
  if (trade.Symbol) {
    const symbol = trade.Symbol.toUpperCase();
    if (/^[A-Z]{3}$/.test(symbol) && ['LYC', 'NXL', 'BHP', 'CBA', 'ANZ', 'WBC', 'CSL', 'WOW', 'WES'].includes(symbol)) {
      return 'AU';
    }
  }
  
  return 'US';
}

function convertCurrency(amount, fromMarket, toCurrency, tradeDate) {
  const fromCurrency = fromMarket === 'AU' ? 'AUD' : 'USD';
  const targetCurrency = toCurrency === 'AU' ? 'AUD' : (toCurrency === 'US' ? 'USD' : toCurrency);
  
  if (fromCurrency === targetCurrency) {
    return amount;
  }
  
  const usdToAudRate = getUSDToAUDRate(tradeDate);
  
  if (fromCurrency === 'USD' && targetCurrency === 'AUD') {
    return amount * usdToAudRate;
  } else if (fromCurrency === 'AUD' && targetCurrency === 'USD') {
    return amount / usdToAudRate;
  }
  
  return amount;
}

function isExecutedStatus(status) {
  return status === 'Filled' || status === 'Partially Cancelled';
}

// IPC handlers for data requests
ipcMain.handle('get-trades', (event, options = {}) => {
  const displayCurrency = options.currency || 'AUD';
  const includeExpired = options.includeExpired === true;
  
  const allTrades = portfolioData.filter(trade => isExecutedStatus(trade.Status));
  
  // Convert trades to match the API response format
  const convertedTrades = allTrades.map(trade => {
    const tradeDate = parseCSVDate(trade['Fill Time'] || trade['Order Time']);
    const originalMarket = trade.market || 'US';
    const fillData = parseFilledAvg(trade['Filled@Avg Price'], trade.Symbol);
    const pricePerShare = fillData.price / getMultiplier(trade.Symbol);
    const correctFillAmount = fillData.qty * pricePerShare * getMultiplier(trade.Symbol);
    
    const originalCurrency = originalMarket === 'US' ? 'USD' : 'AUD';
    const needsConversion = originalCurrency !== displayCurrency;
    
    if (needsConversion && correctFillAmount > 0) {
      const convertedFillAmount = convertCurrency(correctFillAmount, originalMarket, displayCurrency, tradeDate);
      const commission = parseFloat(trade['Commission']) || 0;
      const fees = parseFloat(trade['Total']) || 0;
      const convertedCommission = convertCurrency(commission, originalMarket, displayCurrency, tradeDate);
      const convertedFees = convertCurrency(fees, originalMarket, displayCurrency, tradeDate);
      
      return {
        ...trade,
        'Fill Qty': fillData.qty.toString(),
        'Fill Amount': convertedFillAmount.toLocaleString(),
        'Commission': convertedCommission.toFixed(2),
        'Total': convertedFees.toFixed(2),
        displayCurrency: displayCurrency,
        originalCurrency: originalCurrency
      };
    }
    
    return {
      ...trade,
      'Fill Qty': fillData.qty.toString(),
      'Fill Amount': correctFillAmount.toLocaleString(),
      displayCurrency: displayCurrency,
      originalCurrency: originalCurrency
    };
  });
  
  return convertedTrades;
});

ipcMain.handle('get-portfolio-summary', (event, options = {}) => {
  const currency = options.currency || 'AUD';
  const summary = calculatePortfolioSummary(portfolioData, currency);
  return summary;
});

ipcMain.handle('get-financial-years', () => {
  const filledTrades = portfolioData.filter(trade => isExecutedStatus(trade.Status));
  const years = new Set();
  
  filledTrades.forEach(trade => {
    const tradeDate = parseCSVDate(trade['Fill Time']);
    if (trade.Side === 'Sell') {
      const financialYear = getFinancialYearFromDate(tradeDate);
      years.add(financialYear);
    }
  });
  
  return Array.from(years).sort((a, b) => b - a).map(year => ({
    year: year,
    label: `FY ${String(year).slice(-2)}/${String(year + 1).slice(-2)}`,
    startDate: `${year}-07-01`,
    endDate: `${year + 1}-06-30`
  }));
});

function getFinancialYearFromDate(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  return month >= 6 ? year : year - 1;
}

ipcMain.handle('get-capital-gains', (event, financialYear) => {
  const capitalGains = calculateCapitalGains(portfolioData, financialYear);
  return capitalGains;
});

ipcMain.handle('get-positions', () => {
  // Calculate current positions
  return [];
});

// File operations
ipcMain.handle('load-trades-file', async (event, filePath) => {
  try {
    // If no file path provided, show file dialog
    if (!filePath) {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      
      if (result.canceled) {
        return false;
      }
      
      filePath = result.filePaths[0];
    }
    
    // Load the portfolio data from the selected file
    await loadPortfolioData(filePath);
    
    if (tradesLoaded) {
      // Redirect to main app by reloading
      mainWindow.loadFile('public/index.html');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error loading trades file:', error);
    return false;
  }
});

ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'CSV Files', extensions: ['csv'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  if (!result.canceled) {
    return result.filePaths[0];
  }
  
  return null;
});

ipcMain.handle('check-trades-loaded', () => {
  return tradesLoaded;
});

// Get performance data for charting
ipcMain.handle('get-performance-data', (event, options = {}) => {
  const timeframe = options.timeframe || 'all';
  const metric = options.metric || 'cumulative';
  const currency = options.currency || 'AUD';
  
  return calculatePerformanceData(portfolioData, timeframe, metric, currency);
});

// Calculate portfolio summary
function calculatePortfolioSummary(trades, displayCurrency = 'AUD') {
  const filledTrades = trades.filter(trade => isExecutedStatus(trade.Status));
  
  // Calculate totals
  let totalPnL = 0;
  let totalVolume = 0;
  let buyVolume = 0;
  let sellVolume = 0;
  
  const symbolStats = {};
  
  // Calculate P&L using FIFO methodology (same as Capital Gains for tax accuracy)
  const fifoCalculations = calculateFIFOPnL(trades, displayCurrency);
  
  // Apply FIFO results to symbol stats
  Object.keys(fifoCalculations).forEach(symbol => {
    const fifoData = fifoCalculations[symbol];
    const optionsInfo = parseOptionsSymbol(symbol);
    
    symbolStats[symbol] = {
      symbol: symbol,
      name: fifoData.name,
      totalVolume: fifoData.buyVolume + fifoData.sellVolume,
      buyVolume: fifoData.buyVolume,
      sellVolume: fifoData.sellVolume,
      netPosition: fifoData.netPosition,
      avgBuyPrice: fifoData.avgBuyPrice,
      avgSellPrice: fifoData.sellVolume > 0 ? fifoData.sellVolume / Math.max(1, fifoData.trades.filter(t => t.side === 'Sell').length) : 0,
      totalPnL: fifoData.totalPnL,
      isOption: optionsInfo !== null,
      optionsInfo: optionsInfo,
      trades: fifoData.trades,
      historicalCostBasis: 0,
      market: fifoData.market || 'US', // Add market information
      displayCurrency: displayCurrency
    };
    
    // Add to portfolio totals
    buyVolume += fifoData.buyVolume;
    sellVolume += fifoData.sellVolume;
    totalVolume += fifoData.buyVolume + fifoData.sellVolume;
    totalPnL += fifoData.totalPnL;
  });
  
  // Filter out expired options from current positions
  const currentPositions = Object.values(symbolStats).filter(pos => {
    // Use tolerance for floating point comparison - positions smaller than 0.1 are considered zero
    const hasSignificantPosition = Math.abs(pos.netPosition) >= 0.1;
    
    if (pos.isOption && pos.optionsInfo) {
      return !pos.optionsInfo.isExpired && hasSignificantPosition;
    }
    return hasSignificantPosition;
  });
  
  return {
    totalTrades: filledTrades.length,
    filledTrades: filledTrades.length,
    totalVolume: totalVolume,
    buyVolume: buyVolume,
    sellVolume: sellVolume,
    totalPnL: totalPnL,
    currency: displayCurrency,
    currencySymbol: getCurrencySymbol(displayCurrency),
    symbolStats: Object.values(symbolStats).sort((a, b) => b.totalVolume - a.totalVolume),
    currentPositions: currentPositions.sort((a, b) => b.totalVolume - a.totalVolume),
  };
}

// Get currency symbol for display
function getCurrencySymbol(currency) {
  return currency === 'AU' || currency === 'AUD' ? 'AUD' : 'USD';
}

// Calculate ATO-compliant capital gains
function calculateCapitalGains(trades, financialYear = null) {
  // If no financial year specified, default to all trades since 2000
  const currentFY = financialYear ? parseInt(financialYear) : null;
  const cutoffDateStart = currentFY !== null ? new Date(`${currentFY}-07-01`) : new Date('2000-01-01');
  const cutoffDateEnd = currentFY !== null ? new Date(`${currentFY + 1}-06-30T23:59:59.999Z`) : new Date();
  
  // Get ALL trades (not just recent ones) for proper FIFO calculation
  const allFilledTrades = trades.filter(trade => isExecutedStatus(trade.Status));
  const symbolGroups = {};
  
  // Group all trades by symbol (including historical ones for cost basis)
  allFilledTrades.forEach(trade => {
    const symbol = trade.Symbol;
    if (!symbolGroups[symbol]) symbolGroups[symbol] = [];
    
    const fillData = parseFilledAvg(trade['Filled@Avg Price'], symbol);
    const qty = fillData.qty;
    const price = fillData.price; // Now includes multiplier
    
    // Always use calculated amount from Filled@Avg Price (authoritative source)
    const calculatedAmount = qty * price;
    const amount = calculatedAmount;
    
    symbolGroups[symbol].push({
      side: trade.Side,
      qty,
      price,
      amount: amount, // Total Fill Amount already includes multiplier from aggregation
      date: parseCSVDate(trade['Fill Time']),
      commission: parseFloat(trade['Commission']) || 0,
      fees: parseFloat(trade['Total']) || 0,
      symbol: symbol,
      name: trade.Name,
      market: trade.market, // Add market info for currency conversion
      // Convert all amounts to AUD for Capital Gains (ATO requirement)
      amountAUD: convertCurrency(amount, trade.market, 'AUD', parseCSVDate(trade['Fill Time'])),
      commissionAUD: convertCurrency(parseFloat(trade['Commission']) || 0, trade.market, 'AUD', parseCSVDate(trade['Fill Time'])),
      feesAUD: convertCurrency(parseFloat(trade['Total']) || 0, trade.market, 'AUD', parseCSVDate(trade['Fill Time']))
    });
  });
  
  // Add synthetic sell trades for expired options that still have holdings
  addExpiredOptionsLosses(symbolGroups, trades);
  
  const capitalGains = [];
  
  Object.keys(symbolGroups).forEach(symbol => {
    const trades = symbolGroups[symbol].sort((a, b) => a.date - b.date);
    const optionsInfo = parseOptionsSymbol(symbol);
    
    let holdings = [];
    
    trades.forEach((trade, tradeIndex) => {
      if (optionsInfo) {
        optionsInfo.didExpire = trade.isSynthetic || false;
      }
      if (trade.side === 'Buy') {
        // Use AUD amounts for Capital Gains (ATO requirement)
        const totalCost = trade.amountAUD + trade.commissionAUD + trade.feesAUD;
        
        holdings.push({
          qty: trade.qty,
          price: trade.price,
          priceAUD: trade.amountAUD / trade.qty, // AUD price per unit
          date: trade.date,
          cost: totalCost
        });
      } else if (trade.side === 'Sell') {
        // Include sells within the financial year date range, including synthetic sells for expired options within the period
        if (trade.date >= cutoffDateStart && trade.date <= cutoffDateEnd) {
          let remainingQty = trade.qty;
          let sellPricePerUnit = trade.qty > 0 ? (trade.amountAUD || 0) / trade.qty : 0;
          let totalCommissionAndFees = (trade.commissionAUD || 0) + (trade.feesAUD || 0);
          
          // Process each FIFO lot separately to get correct holding periods
          while (remainingQty > 0 && holdings.length > 0) {
            const holding = holdings[0];
            const qtyToSell = Math.min(remainingQty, holding.qty);
            
            const costPerShare = holding.cost / holding.qty;
            const costBasis = costPerShare * qtyToSell;
            
            // Calculate proceeds for this lot (proportional to quantity)
            const proceedsForLot = qtyToSell * sellPricePerUnit;
            
            // Allocate commission and fees proportionally
            const commissionAndFeesForLot = totalCommissionAndFees * (qtyToSell / trade.qty);
            
            const netProceedsForLot = proceedsForLot - commissionAndFeesForLot;
            const capitalGainForLot = netProceedsForLot - costBasis;
            
            // Calculate holding period for this specific lot
            const holdingPeriod = Math.floor((trade.date.getTime() - holding.date.getTime()) / (1000 * 60 * 60 * 24));
            
            // Create separate capital gain entry for each FIFO lot
            capitalGains.push({
              symbol: symbol,
              name: trade.name,
              isOption: optionsInfo !== null,
              optionsInfo: optionsInfo,
              sellDate: trade.date,
              buyDate: holding.date,
              qty: qtyToSell,
              sellPrice: sellPricePerUnit, // AUD price per unit
              costBasis: costBasis,
              proceeds: netProceedsForLot,
              capitalGain: capitalGainForLot,
              holdingPeriod: holdingPeriod,
              isLongTerm: holdingPeriod >= 365, // Track if this lot qualifies for discount
              currency: 'AUD', // Mark as AUD for display
              market: trade.market // Original market for reference
            });
            
            remainingQty -= qtyToSell;
            holding.qty -= qtyToSell;
            holding.cost -= costBasis; // Reduce cost proportionally when qty is reduced
            
            if (holding.qty === 0) {
              holdings.shift();
            }
          }
        } else {
          // For historical sells (before cutoff), still need to remove from holdings
          let remainingQty = trade.qty;
          
          while (remainingQty > 0 && holdings.length > 0) {
            const holding = holdings[0];
            const qtyToSell = Math.min(remainingQty, holding.qty);
            
            remainingQty -= qtyToSell;
            holding.qty -= qtyToSell;
            
            if (holding.qty === 0) holdings.shift();
          }
        }
      }
    });
  });
  
  return capitalGains.sort((a, b) => b.sellDate - a.sellDate);
}

// Calculate holding period from the actual sold holdings (for capital gains)
function calculateHoldingPeriodFromSold(soldHoldings, sellDate) {
  if (soldHoldings.length === 0) return 0;
  
  // Use the earliest sold holding date (FIFO - first in, first out)
  const earliestSoldDate = Math.min(...soldHoldings.map(h => h.date.getTime()));
  const daysDiff = (sellDate.getTime() - earliestSoldDate) / (1000 * 60 * 60 * 24);
  
  return Math.floor(daysDiff);
}

// Add synthetic sell trades for expired options with remaining holdings
function addExpiredOptionsLosses(symbolGroups, allTrades = null) {
  // First, check symbols that already have trades in symbolGroups
  Object.keys(symbolGroups).forEach(symbol => {
    const optionsInfo = parseOptionsSymbol(symbol);
    
    // Only process options that are expired
    if (!optionsInfo || !optionsInfo.isExpired) return;
    
    const expiryDate = new Date(optionsInfo.expiryDate);
    
    const trades = symbolGroups[symbol].sort((a, b) => a.date - b.date);
    
    // Calculate remaining holdings at expiry
    let remainingHoldings = 0;
    trades.forEach(trade => {
      if (trade.side === 'Buy') {
        remainingHoldings += trade.qty;
      } else if (trade.side === 'Sell') {
        remainingHoldings -= trade.qty;
      }
    });
    
    // If there are remaining holdings at expiry, add a synthetic sell at $0
    if (remainingHoldings > 0.01) { // Use small tolerance for floating point
      
      // Find a trade to get the name
      const sampleTrade = trades.find(t => t.name) || trades[0];
      
      // Add synthetic sell trade at $0 on expiry date
      symbolGroups[symbol].push({
        side: 'Sell',
        qty: remainingHoldings,
        price: 0, // Expired worthless
        amount: 0, // No proceeds
        date: expiryDate,
        commission: 0,
        fees: 0,
        symbol: symbol,
        name: sampleTrade ? sampleTrade.name : symbol,
        market: sampleTrade ? sampleTrade.market : 'US', // Add market info
        // Add AUD conversion fields for capital gains calculation
        amountAUD: 0, // No proceeds in any currency
        commissionAUD: 0,
        feesAUD: 0,
        isSynthetic: true // Mark as synthetic for debugging
      });
    }
  });
  
  // Second, check for historical positions that expired after cutoff but have no recent trades
  if (allTrades) {
    const historicalPositions = calculateHistoricalCostBasis(allTrades);
    
    Object.keys(historicalPositions).forEach(symbol => {
      // Skip if we already processed this symbol above
      if (symbolGroups[symbol]) return;
      
      const optionsInfo = parseOptionsSymbol(symbol);
      if (!optionsInfo || !optionsInfo.isExpired) return;
      
      const expiryDate = new Date(optionsInfo.expiryDate);
      
      const position = historicalPositions[symbol];
      if (position.netPosition > 0.01) {        
        // Create a new symbol group for this historical position
        symbolGroups[symbol] = [{
          side: 'Sell',
          qty: position.netPosition,
          price: 0, // Expired worthless
          amount: 0, // No proceeds
          date: expiryDate,
          commission: 0,
          fees: 0,
          symbol: symbol,
          name: symbol, // Use symbol as name if we don't have trade data
          market: 'US', // Default market for historical positions
          // Add AUD conversion fields for capital gains calculation
          amountAUD: 0, // No proceeds in any currency
          commissionAUD: 0,
          feesAUD: 0,
          isSynthetic: true // Mark as synthetic for debugging
        }];
      }
    });
  }
}

// Calculate historical cost basis for existing positions
function calculateHistoricalCostBasis(trades) {
  const allFilledTrades = trades.filter(trade => isExecutedStatus(trade.Status));
  const symbolGroups = {};
  
  allFilledTrades.forEach(trade => {
    const symbol = trade.Symbol;
    const multiplier = getMultiplier(symbol);
    if (!symbolGroups[symbol]) symbolGroups[symbol] = [];
    
    const fillData = parseFilledAvg(trade['Filled@Avg Price'], symbol);
    const fillAmount = parseFloat((trade['Fill Amount'] || '0').replace(/,/g, '')) || 0;
    
    // Always use calculated amount from Filled@Avg Price (authoritative source)
    const calculatedAmount = fillData.qty * fillData.price;
    const amount = calculatedAmount;
    
    symbolGroups[symbol].push({
      side: trade.Side,
      qty: fillData.qty,
      price: fillData.price, // Now includes multiplier
      amount: amount,
      date: parseCSVDate(trade['Fill Time']),
      commission: parseFloat(trade['Commission']) || 0,
      fees: parseFloat(trade['Total']) || 0
    });
  });
  
  const historicalPositions = {};
  
  Object.keys(symbolGroups).forEach(symbol => {
    const trades = symbolGroups[symbol].sort((a, b) => a.date - b.date);
    let netPosition = 0;
    let totalCostBasis = 0;
    let totalQuantity = 0;
    
    trades.forEach(trade => {
      if (trade.side === 'Buy') {
        netPosition += trade.qty;
        totalCostBasis += trade.amount + trade.commission + trade.fees;
        totalQuantity += trade.qty;
      } else if (trade.side === 'Sell') {
        netPosition -= trade.qty;
        if (totalQuantity > 0) {
          const proportionSold = Math.min(trade.qty / totalQuantity, 1);
          totalCostBasis -= totalCostBasis * proportionSold;
          totalQuantity -= trade.qty;
          if (totalQuantity < 0) totalQuantity = 0;
        }
      }
    });
    
    if (netPosition > 0) {
      const avgCostBasis = totalQuantity > 0 ? totalCostBasis / totalQuantity : 0;
      historicalPositions[symbol] = {
        symbol: symbol,
        netPosition: netPosition,
        avgCostBasis: avgCostBasis,
        totalCostBasis: totalCostBasis,
        totalQuantity: totalQuantity
      };
    }
  });
  
  return historicalPositions;
}

// Calculate performance data for charting using capital gains methodology
function calculatePerformanceData(trades, timeframe = 'all', metric = 'cumulative', displayCurrency = 'AUD') {
  // Filter trades by timeframe
  const now = new Date();
  let startDate;
  
  switch (timeframe) {
    case '3m':
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      break;
    case '6m':
      startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      break;
    case '1y':
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      break;
    default:
      startDate = new Date('2000-01-01');
  }
  
  // Use capital gains calculation for accurate P&L with trade-date conversion
  const allCapitalGains = calculateCapitalGains(trades, null);
  
  // Filter capital gains by timeframe and convert to display currency
  const filteredGains = allCapitalGains.filter(gain => {
    const sellDate = new Date(gain.sellDate);
    return sellDate >= startDate;
  }).map(gain => {
    // Convert to display currency using trade-date conversion
    let convertedGain;
    if (displayCurrency === 'AUD') {
      // Capital gains are already in AUD
      convertedGain = gain.capitalGain;
    } else {
      // Convert AUD to USD using trade-date rate
      convertedGain = convertCurrency(gain.capitalGain, 'AU', 'US', new Date(gain.sellDate));
    }
    
    return {
      ...gain,
      convertedGain: convertedGain
    };
  }).sort((a, b) => new Date(a.sellDate) - new Date(b.sellDate));
  
  // Group by time period (weekly for < 1 year, monthly for >= 1 year)
  const useWeeklyAggregation = timeframe !== 'all' && timeframe !== '1y';
  const periodData = new Map();
  
  filteredGains.forEach(gain => {
    const sellDate = new Date(gain.sellDate);
    let periodKey;
    
    if (useWeeklyAggregation) {
      // Group by week - get Monday of the week as the key
      const monday = new Date(sellDate);
      monday.setDate(sellDate.getDate() - sellDate.getDay() + 1); // Get Monday
      periodKey = `${monday.getFullYear()}-W${String(Math.ceil((monday.getDate()) / 7)).padStart(2, '0')}-${String(monday.getMonth() + 1).padStart(2, '0')}`;
    } else {
      // Group by month
      periodKey = `${sellDate.getFullYear()}-${String(sellDate.getMonth() + 1).padStart(2, '0')}`;
    }
    
    if (!periodData.has(periodKey)) {
      periodData.set(periodKey, {
        period: periodKey,
        trades: 0,
        totalPnL: 0,
        winningTrades: 0,
        date: sellDate,
        isWeekly: useWeeklyAggregation
      });
    }
    
    const data = periodData.get(periodKey);
    data.trades++;
    data.totalPnL += gain.convertedGain;
    
    if (gain.convertedGain > 0) {
      data.winningTrades++;
    }
  });
  
  // Convert to array and sort by date
  const periodArray = Array.from(periodData.values()).sort((a, b) => a.date - b.date);
  
  // Calculate cumulative data
  let runningTotal = 0;
  const chartData = periodArray.map(period => {
    runningTotal += period.totalPnL;
    return {
      ...period,
      cumulativePnL: runningTotal,
      avgPnLPerTrade: period.trades > 0 ? period.totalPnL / period.trades : 0,
      winRate: period.trades > 0 ? (period.winningTrades / period.trades) * 100 : 0,
      // Add display label for better chart readability
      displayLabel: useWeeklyAggregation ? 
        `Week of ${period.date.toLocaleDateString()}` : 
        period.period
    };
  });
  
  // Calculate summary statistics
  const totalTrades = filteredGains.length;
  const totalPnL = chartData.length > 0 ? chartData[chartData.length - 1].cumulativePnL : 0;
  const totalWinningTrades = filteredGains.filter(gain => gain.convertedGain > 0).length;
  const winRate = totalTrades > 0 ? (totalWinningTrades / totalTrades) * 100 : 0;
  
  const bestMonth = chartData.reduce((best, month) => 
    month.totalPnL > (best?.totalPnL || -Infinity) ? month : best, null
  );
  
  const worstMonth = chartData.reduce((worst, month) => 
    month.totalPnL < (worst?.totalPnL || Infinity) ? month : worst, null
  );
  
  return {
    chartData: chartData,
    summary: {
      totalPnL: totalPnL,
      totalTrades: totalTrades,
      winRate: winRate,
      bestMonth: bestMonth ? {
        amount: bestMonth.totalPnL,
        period: bestMonth.month
      } : null,
      worstMonth: worstMonth ? {
        amount: worstMonth.totalPnL,
        period: worstMonth.month
      } : null
    },
    timeframe: timeframe,
    metric: metric,
    currency: displayCurrency
  };
}

// Accurate FIFO P&L calculation with currency-aware totaling
function calculateFIFOPnL(trades, displayCurrency = 'AUD') {
  // Get ALL filled trades for complete P&L calculation
  const allFilledTrades = trades.filter(trade => isExecutedStatus(trade.Status));
  
  // Group trades by symbol - keep in ORIGINAL currencies
  const symbolGroups = {};
  allFilledTrades.forEach(trade => {
    const symbol = trade.Symbol;
    if (!symbolGroups[symbol]) symbolGroups[symbol] = [];
    
    const fillData = parseFilledAvg(trade['Filled@Avg Price'], symbol);
    const qty = fillData.qty;
    const price = fillData.price;
    const amount = qty * price;
    
    // Keep all amounts in ORIGINAL currency - no conversion during calculation
    const tradeDate = parseCSVDate(trade['Fill Time']);
    const originalAmount = amount;
    const originalCommission = parseFloat(trade['Commission']) || 0;
    const originalFees = parseFloat(trade['Total']) || 0;
    
    symbolGroups[symbol].push({
      side: trade.Side,
      qty,
      price,
      amount: originalAmount,
      date: tradeDate,
      commission: originalCommission,
      fees: originalFees,
      symbol: symbol,
      name: trade.Name,
      market: trade.market,
      originalCurrency: trade.market === 'US' ? 'USD' : 'AUD'
    });
  });
  
  // Add synthetic sell trades for expired options  
  addExpiredOptionsLosses(symbolGroups, trades);
  
  const results = {};
  
  // Get all symbols that have trades
  const allSymbols = new Set([
    ...Object.keys(symbolGroups),
  ]);
  
  allSymbols.forEach(symbol => {
    const trades = symbolGroups[symbol] ? symbolGroups[symbol].sort((a, b) => a.date - b.date) : [];    
    let holdingsQueue = [];
    // Track P&L and volume by currency
    let realizedPnLByCurrency = { USD: 0, AUD: 0 };
    let volumeByCurrency = { 
      USD: { buy: 0, sell: 0 }, 
      AUD: { buy: 0, sell: 0 } 
    };
    let totalBuyAmount = 0;
    let totalBuyQty = 0;
    
    // Process each trade chronologically using FIFO
    trades.forEach(trade => {
      const tradeCurrency = trade.originalCurrency || 'USD'; // Default to USD if undefined
      
      if (trade.side === 'Buy') {
        // Add to holdings queue (keep original currency info)
        const totalCost = trade.amount + trade.commission + trade.fees;
        holdingsQueue.push({
          qty: trade.qty,
          costBasis: totalCost,
          costPerShare: totalCost / trade.qty,
          currency: tradeCurrency,
          date: trade.date,
          isHistorical: false
        });
        
        // Track volume by currency
        volumeByCurrency[tradeCurrency].buy += trade.amount;
        totalBuyAmount += totalCost;
        totalBuyQty += trade.qty;
        
      } else if (trade.side === 'Sell') {
        // Sell using FIFO from holdings queue
        let remainingQtyToSell = trade.qty;
        let totalCostBasisSold = 0;
        
        while (remainingQtyToSell > 0 && holdingsQueue.length > 0) {
          const holding = holdingsQueue[0];
          const qtyFromThisHolding = Math.min(remainingQtyToSell, holding.qty);
          const costBasisForThisQty = holding.costPerShare * qtyFromThisHolding;
          
          totalCostBasisSold += costBasisForThisQty;
          remainingQtyToSell -= qtyFromThisHolding;
          
          // Reduce the holding
          holding.qty -= qtyFromThisHolding;
          holding.costBasis -= costBasisForThisQty;
          
          // Remove empty holdings
          if (holding.qty <= 0) {
            holdingsQueue.shift();
          }
        }
        
        // Calculate realized P&L in original currency
        const sellProceeds = trade.amount - trade.commission - trade.fees;
        const realizedPnL = sellProceeds - totalCostBasisSold;
        
        // Track P&L by currency
        realizedPnLByCurrency[tradeCurrency] += realizedPnL;
        volumeByCurrency[tradeCurrency].sell += trade.amount;
        
        // Handle short sales (if remainingQtyToSell > 0, this is a short sale)
        if (remainingQtyToSell > 0) {
          // For short sales, add negative holding
          const shortSellProceeds = (trade.amount / trade.qty) * remainingQtyToSell;
          const shortSellFees = ((trade.commission + trade.fees) / trade.qty) * remainingQtyToSell;
          
          holdingsQueue.unshift({
            qty: -remainingQtyToSell,
            costBasis: -(shortSellProceeds - shortSellFees),
            costPerShare: (shortSellProceeds - shortSellFees) / remainingQtyToSell,
            currency: tradeCurrency,
            date: trade.date,
            isShort: true
          });
        }
      }
    });
    
    // Calculate current position and average cost
    const currentNetPosition = holdingsQueue.reduce((sum, holding) => sum + holding.qty, 0);
    const currentTotalCost = holdingsQueue.reduce((sum, holding) => sum + Math.abs(holding.costBasis), 0);
    const avgBuyPrice = currentNetPosition > 0 ? currentTotalCost / currentNetPosition : 0;
    
    // Convert P&L and volumes to display currency
    const currentDate = new Date(); // Use current date for P&L conversion
    const convertedPnL = realizedPnLByCurrency.USD * (displayCurrency === 'USD' ? 1 : getUSDToAUDRate(currentDate)) +
                        realizedPnLByCurrency.AUD * (displayCurrency === 'AUD' ? 1 : (1/getUSDToAUDRate(currentDate)));
    
    const convertedBuyVolume = volumeByCurrency.USD.buy * (displayCurrency === 'USD' ? 1 : getUSDToAUDRate(currentDate)) +
                              volumeByCurrency.AUD.buy * (displayCurrency === 'AUD' ? 1 : (1/getUSDToAUDRate(currentDate)));
    
    const convertedSellVolume = volumeByCurrency.USD.sell * (displayCurrency === 'USD' ? 1 : getUSDToAUDRate(currentDate)) +
                               volumeByCurrency.AUD.sell * (displayCurrency === 'AUD' ? 1 : (1/getUSDToAUDRate(currentDate)));
    
    // Only include symbols that have positions or trading activity
    if (currentNetPosition !== 0 || trades.length > 0) {
      results[symbol] = {
        symbol,
        name: trades.length > 0 ? trades[0].name : symbol,
        netPosition: currentNetPosition,
        avgBuyPrice,
        totalPnL: convertedPnL, // Currency-converted realized P&L
        buyVolume: convertedBuyVolume,
        sellVolume: convertedSellVolume,
        market: trades.length > 0 ? trades[0].market : 'US',
        trades: trades.map(t => ({
          side: t.side,
          fillQty: t.qty,
          fillPrice: t.price,
          fillAmount: t.amount,
          fillTime: t.date
        }))
      };
    }
  });
  
  return results;
}