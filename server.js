const express = require('express');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

// Currency conversion data
let currencyRates = new Map(); // Date string -> USD to AUD rate

// Load currency conversion rates from CSV
function loadCurrencyRates() {
  return new Promise((resolve, reject) => {
    console.log('Loading currency conversion rates...');
    
    fs.createReadStream('usd-aud.csv')
      .pipe(csv())
      .on('data', (row) => {
        const dateStr = row.Date;
        const rate = parseFloat(row['USD to AUD']);
        
        if (dateStr && !isNaN(rate) && rate > 0) {
          // Parse date and store in YYYY-MM-DD format for easy lookup
          // Handle "DD MMM YYYY" format correctly by adding timezone info
          const date = new Date(dateStr + ' 12:00:00 UTC');
          if (!isNaN(date.getTime())) {
            const dateKey = date.toISOString().split('T')[0];
            currencyRates.set(dateKey, rate);
          }
        }
      })
      .on('end', () => {
        console.log(`Loaded ${currencyRates.size} currency rates`);
        resolve();
      })
      .on('error', (error) => {
        console.error('Error loading currency rates:', error);
        reject(error);
      });
  });
}

// Get USD to AUD rate for a specific date (with fallback logic)
function getUSDToAUDRate(date) {
  const dateKey = date.toISOString().split('T')[0];
  
  // Try exact date first
  if (currencyRates.has(dateKey)) {
    return currencyRates.get(dateKey);
  }
  
  // Find nearest date (within 7 days)
  const targetTime = date.getTime();
  let nearestRate = null;
  let nearestDiff = Infinity;
  
  for (const [dateStr, rate] of currencyRates.entries()) {
    const rateDate = new Date(dateStr);
    const diff = Math.abs(targetTime - rateDate.getTime());
    const daysDiff = diff / (1000 * 60 * 60 * 24);
    
    if (daysDiff <= 7 && diff < nearestDiff) {
      nearestDiff = diff;
      nearestRate = rate;
    }
  }
  
  // Fallback to a reasonable default if no rate found
  return nearestRate || 1.5; // Approximate long-term average
}

// Determine market from trade data
function getTradeMarket(trade) {
  // Check if there's an explicit Markets column
  if (trade.Markets && trade.Markets.trim() !== '') {
    return trade.Markets.toUpperCase();
  }
  
  // Fallback: infer from Currency column if Markets is missing
  if (trade.Currency && trade.Currency.trim() !== '') {
    return trade.Currency === 'AUD' ? 'AU' : 'US';
  }
  
  // Fallback: infer from symbol patterns for AU stocks
  if (trade.Symbol) {
    const symbol = trade.Symbol.toUpperCase();
    // Common AU stock patterns (3-letter codes, some specific symbols)
    if (/^[A-Z]{3}$/.test(symbol) && ['LYC', 'NXL', 'BHP', 'CBA', 'ANZ', 'WBC', 'CSL', 'WOW', 'WES'].includes(symbol)) {
      return 'AU';
    }
  }
  
  // Default to US for unknown cases
  return 'US';
}

// Convert amount between currencies based on trade date and market
function convertCurrency(amount, fromMarket, toCurrency, tradeDate) {
  // Normalize inputs
  const fromCurrency = fromMarket === 'AU' ? 'AUD' : 'USD';
  const targetCurrency = toCurrency === 'AU' ? 'AUD' : (toCurrency === 'US' ? 'USD' : toCurrency);
  
  if (fromCurrency === targetCurrency) {
    return amount;
  }
  
  const usdToAudRate = getUSDToAUDRate(tradeDate);
  
  if (fromCurrency === 'USD' && targetCurrency === 'AUD') {
    // USD to AUD
    return amount * usdToAudRate;
  } else if (fromCurrency === 'AUD' && targetCurrency === 'USD') {
    // AUD to USD
    return amount / usdToAudRate;
  }
  
  return amount; // No conversion needed/possible
}

// Get currency symbol for display
function getCurrencySymbol(currency) {
  return currency === 'AU' || currency === 'AUD' ? 'AUD' : 'USD';
}

const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Store portfolio data
let portfolioData = [];

function parseFilledAvg(column, symbol) {
  const [qty, price] = (column||"0@0").split('@');
  const rawPrice = parseFloat(price.replace(",", "")) || 0;
  const multiplier = symbol ? getMultiplier(symbol) : 1;
  return { 
    qty: parseFloat(qty.replace(",", "")) || 0, 
    price: rawPrice * multiplier // Always return effective price including multiplier
  };
}

// Parse date from CSV format: "Sep 4, 2025 10:56:57 ET"
function parseCSVDate(dateString) {
  if (!dateString) return new Date('1900-01-01');
  
  // Remove ET timezone and parse
  const cleanDate = dateString.replace(' ET', '').replace(' AEST', '').replace(' AEDT', '');
  const parsed = new Date(cleanDate);
  
  // If parsing failed, try alternative format
  if (isNaN(parsed.getTime())) {
    // Try parsing without timezone
    const parts = cleanDate.split(' ');
    if (parts.length >= 4) {
      const month = parts[0];
      const day = parts[1].replace(',', '');
      const year = parts[2];
      const time = parts[3];
      return new Date(`${month} ${day}, ${year} ${time}`);
    }
  }
  
  return parsed;
}

// Load CSV data on startup
// load CSV data, keep only real Filled trades
function loadPortfolioData() {
  return new Promise((resolve, reject) => {
    const all = [];
    fs.createReadStream('trades.csv')
      .pipe(csv())
      .on('data', row => {
        // Read all rows to preserve continuation fill lines for aggregation
        // (continuation rows often omit Side/Status)
        // Add market information to each row
        row.market = getTradeMarket(row);
        all.push(row);
      })
      .on('end', () => {
        // First, aggregate partial fills across continuation rows
        //const aggregated = aggregatePartialFills(all);
        // Then, keep only executed header trades (have Symbol+Side and executed status)
        portfolioData = all.filter(row => row.Symbol && row.Side && isExecutedStatus(row.Status));
        console.log(`Loaded ${portfolioData.length} executed aggregated trades (Filled/Partially Cancelled)`);
        resolve(portfolioData);
      })
      .on('error', reject);
  });
}

// Helper: option contract multiplier
function getMultiplier(symbol) {
  return isOption(symbol) ? 100 : 1;
}

// Aggregate partial fills into single trades
function aggregatePartialFills(rawTrades) {
  const aggregatedTrades = [];
  let currentTrade = null;
  
  for (let i = 0; i < rawTrades.length; i++) {
    const row = rawTrades[i];
    
    // Check if this is a new trade (has Symbol and Side)
    if (row.Symbol && row.Symbol.trim() !== '' && row.Side && row.Side.trim() !== '') {
      // Save previous trade if exists
      if (currentTrade) {
        aggregatedTrades.push(currentTrade);
      }
      
      // Start new trade
      currentTrade = {
        ...row,
        aggregatedFills: []
      };
      
      // Add fill if present - check Fill Qty for individual fills
      if (row['Fill Qty'] && row['Fill Qty'].trim() !== '' && parseFloat(row['Fill Qty']) > 0) {
        currentTrade.aggregatedFills.push({
          qty: parseFloat(row['Fill Qty']) || 0,
          price: parseFloat(row['Fill Price']) || 0,
          time: row['Fill Time']
        });
      }
    } else if (currentTrade && row['Fill Qty'] && row['Fill Qty'].trim() !== '' && parseFloat(row['Fill Qty']) > 0) {
      // This is a continuation row for the current trade
      currentTrade.aggregatedFills.push({
        qty: parseFloat(row['Fill Qty']) || 0,
        price: parseFloat(row['Fill Price']) || 0,
        time: row['Fill Time']
      });
    }
  }
  
  // Add the last trade
  if (currentTrade) {
    aggregatedTrades.push(currentTrade);
  }
  
  // Recompute totals using weighted price and update Filled@Avg Price and Total Fill Amount
  return aggregatedTrades.map(trade => {
    if (trade.aggregatedFills && trade.aggregatedFills.length > 0) {
      const totalQty = trade.aggregatedFills.reduce((sum, f) => sum + f.qty, 0);
      const weightedPrice = totalQty > 0 ? (trade.aggregatedFills.reduce((sum, f) => sum + f.qty * f.price, 0) / totalQty) : 0;
      // Use original Fill Amount if it exists and seems correct, otherwise calculate raw amount
      const originalAmount = parseFloat((trade['Fill Amount'] || '0').replace(/,/g, ''));
      const calculatedAmount = trade.aggregatedFills.reduce((sum, f) => sum + (f.qty * f.price), 0);
      const totalFillAmount = originalAmount > 0 ? originalAmount : calculatedAmount;
      
      // If original Filled@Avg Price exists and makes sense, use it; otherwise compute from fills
      if (trade.Symbol == 'KC') {
        console.log(`KC Filled@Avg price: ${trade['Filled@Avg Price']}`)
      }
      const originalFill = parseFilledAvg(trade['Filled@Avg Price'], trade.Symbol);
      const shouldUseOriginal = originalFill.qty > 0 && Math.abs(originalFill.qty - totalQty) < 0.01;
      
      return {
        ...trade,
        'Filled@Avg Price': shouldUseOriginal ? trade['Filled@Avg Price'] : `${totalQty}@${weightedPrice.toFixed(2)}`,
        'Fill Amount': totalFillAmount.toString(),
        'Fill Time': trade.aggregatedFills[0].time // Use first fill time
      };
    }
    
    return trade;
  });
}

// Parse options symbol to extract details
function parseOptionsSymbol(symbol) {
  // Format: Symbol ExpiryDate StrikePrice{C/P}
  // Example: SOFI251121C26000 = SOFI, expiry 25/11/21, Call, strike $26.00
  const optionsRegex = /^([A-Z]+)(\d{6})([CP])(\d+)$/;
  const match = symbol.match(optionsRegex);
  
  if (match) {
    const [, underlying, expiryStr, optionType, strikeStr] = match;
    const expiryYear = 2000 + parseInt(expiryStr.substring(0, 2));
    const expiryMonth = parseInt(expiryStr.substring(2, 4));
    const expiryDay = parseInt(expiryStr.substring(4, 6));
    const expiryDate = new Date(expiryYear, expiryMonth - 1, expiryDay);
    const strikePrice = parseFloat(strikeStr) / 1000; // Convert from cents to dollars
    
    return {
      underlying,
      expiryDate: expiryDate.toISOString(), // Convert to ISO string for JSON serialization
      optionType: optionType === 'C' ? 'Call' : 'Put',
      strikePrice,
      isExpired: expiryDate < new Date()
    };
  }
  
  return null;
}

// Check if a symbol is an option
function isOption(symbol) {
  return parseOptionsSymbol(symbol) !== null;
}

// Helper to determine if a trade status represents an executed trade row
function isExecutedStatus(status) {
  return status === 'Filled' || status === 'Partially Cancelled';
}

// API Routes
app.get('/api/trades', (req, res) => {
  const displayCurrency = req.query.currency || 'AUD';
  const includeExpired = req.query.includeExpired === 'true';
  
  // Get base trades - only executed trades
  const allTrades = portfolioData.filter(trade => isExecutedStatus(trade.Status));
  
  let finalTrades = [...allTrades];
  
  // Add expired options if requested
  if (includeExpired) {
    finalTrades = addExpiredOptionsToTrades(allTrades);
  }
  
  // Convert currency for trades if needed
  const convertedTrades = finalTrades.map(trade => {
    const tradeDate = parseCSVDate(trade['Fill Time'] || trade['Order Time']);
    const originalMarket = trade.market || 'US';
    const fillAmount = parseFloat((trade['Fill Amount'] || '0').replace(/,/g, '')) || 0;
    const commission = parseFloat(trade['Commission']) || 0;
    const fees = parseFloat(trade['Total']) || 0;
    
    // Use parsed quantity from Filled@Avg Price as authoritative source
    const fillData = parseFilledAvg(trade['Filled@Avg Price'], trade.Symbol);
    const correctFillQty = fillData.qty;
    
    // Calculate correct fill amount: qty × price per contract
    // For options: fillData.price = $9.60 × 100 = $960 (already includes multiplier)
    // For stocks: fillData.price = actual price per share
    // Total amount = qty × (price per share × shares per unit)
    const pricePerShare = fillData.price / getMultiplier(trade.Symbol); // $9.60 for options
    const correctFillAmount = correctFillQty * pricePerShare * getMultiplier(trade.Symbol);
    
    // Convert amounts if currency is different from trade's original currency
    const originalCurrency = originalMarket === 'US' ? 'USD' : 'AUD';
    const needsConversion = originalCurrency !== displayCurrency;
    
    if (needsConversion && correctFillAmount > 0) {
      const convertedFillAmount = convertCurrency(correctFillAmount, originalMarket, displayCurrency, tradeDate);
      const convertedCommission = convertCurrency(commission, originalMarket, displayCurrency, tradeDate);
      const convertedFees = convertCurrency(fees, originalMarket, displayCurrency, tradeDate);
      
      return {
        ...trade,
        'Fill Qty': correctFillQty.toString(),
        'Fill Amount': convertedFillAmount.toLocaleString(),
        'Commission': convertedCommission.toFixed(2),
        'Total': convertedFees.toFixed(2),
        displayCurrency: displayCurrency,
        originalCurrency: originalCurrency
      };
    }
    
    return {
      ...trade,
      'Fill Qty': correctFillQty.toString(),
      'Fill Amount': correctFillAmount.toLocaleString(),
      displayCurrency: displayCurrency,
      originalCurrency: originalCurrency
    };
  });
  
  res.json(convertedTrades);
});

app.get('/api/portfolio-summary', (req, res) => {
  const currency = req.query.currency || 'AUD'; // Default to AUD, allow USD
  const summary = calculatePortfolioSummary(portfolioData, currency);
  res.json(summary);
});

app.get('/api/capital-gains', (req, res) => {
  const financialYear = req.query.financialYear;
  const capitalGains = calculateCapitalGains(portfolioData, financialYear);
  res.json(capitalGains);
});

app.get('/api/financial-years', (req, res) => {
  const financialYears = getAvailableFinancialYears(portfolioData);
  res.json(financialYears);
});

app.get('/api/historical-positions', (req, res) => {
  const historicalPositions = calculateHistoricalCostBasis(portfolioData);
  res.json(historicalPositions);
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

// Add expired options as trades for the All Trades view
function addExpiredOptionsToTrades(trades) {
  const allFilledTrades = trades.filter(trade => isExecutedStatus(trade.Status));
  const symbolGroups = {};
  
  // Group all trades by symbol to calculate remaining holdings
  allFilledTrades.forEach(trade => {
    const symbol = trade.Symbol;
    if (!symbolGroups[symbol]) symbolGroups[symbol] = [];
    
    const fillData = parseFilledAvg(trade['Filled@Avg Price'], symbol);
    symbolGroups[symbol].push({
      side: trade.Side,
      qty: fillData.qty,
      price: fillData.price,
      date: parseCSVDate(trade['Fill Time']),
      symbol: symbol,
      name: trade.Name,
      market: trade.market,
      originalTrade: trade
    });
  });
  
  const syntheticTrades = [];
  
  // Check each symbol for expired options with remaining holdings
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
    if (remainingHoldings > 0.01) {
      const sampleTrade = trades.find(t => t.originalTrade) || trades[0];
      
      // Create a synthetic trade that looks like a real trade
      syntheticTrades.push({
        Symbol: symbol,
        Side: 'Sell',
        'Filled@Avg Price': `${remainingHoldings}@0.00`,
        'Fill Qty': remainingHoldings.toString(),
        'Fill Price': '0.00',
        'Fill Amount': '0.00',
        'Fill Time': expiryDate.toLocaleDateString() + ' 4:00:00 PM',
        'Order Time': expiryDate.toLocaleDateString() + ' 4:00:00 PM',
        Commission: '0.00',
        Total: '0.00',
        Status: 'Filled',
        Name: sampleTrade ? sampleTrade.name : symbol + ' (Expired)',
        market: sampleTrade ? sampleTrade.market : 'US',
        isExpired: true // Mark as expired for styling
      });
    }
  });
  
  // Also check for historical positions that expired after cutoff but have no recent trades
  const historicalPositions = calculateHistoricalCostBasis(allFilledTrades);
  Object.keys(historicalPositions).forEach(symbol => {
    // Skip if we already processed this symbol above
    if (symbolGroups[symbol]) return;
    
    const optionsInfo = parseOptionsSymbol(symbol);
    if (!optionsInfo || !optionsInfo.isExpired) return;
    
    const expiryDate = new Date(optionsInfo.expiryDate);
    const position = historicalPositions[symbol];
    
    if (position.netPosition > 0.01) {
      syntheticTrades.push({
        Symbol: symbol,
        Side: 'Sell',
        'Filled@Avg Price': `${position.netPosition}@0.00`,
        'Fill Qty': position.netPosition.toString(),
        'Fill Price': '0.00',
        'Fill Amount': '0.00',
        'Fill Time': expiryDate.toLocaleDateString() + ' 4:00:00 PM',
        'Order Time': expiryDate.toLocaleDateString() + ' 4:00:00 PM',
        Commission: '0.00',
        Total: '0.00',
        Status: 'Filled',
        Name: symbol + ' (Expired)',
        market: 'US',
        isExpired: true
      });
    }
  });
  
  // Combine original trades with synthetic expired option trades
  return [...allFilledTrades, ...syntheticTrades];
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

// Get available financial years from trades data
function getAvailableFinancialYears(trades) {
  const filledTrades = trades.filter(trade => isExecutedStatus(trade.Status));
  const years = new Set();
  
  filledTrades.forEach(trade => {
    const tradeDate = parseCSVDate(trade['Fill Time']);
    if (trade.Side === 'Sell') { // Only consider sell trades for financial year selection
      const financialYear = getFinancialYearFromDate(tradeDate);
      years.add(financialYear);
    }
  });
  
  // Sort years in descending order (most recent first)
  return Array.from(years).sort((a, b) => b - a).map(year => ({
    year: year,
    label: `FY ${String(year).slice(-2)}/${String(year + 1).slice(-2)}`,
    startDate: `${year}-07-01`,
    endDate: `${year + 1}-06-30`
  }));
}

// Get financial year from a date (July 1 to June 30)
function getFinancialYearFromDate(date) {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed (0 = January)
  
  // If month is July (6) or later, it's the current calendar year's financial year
  // If month is June (5) or earlier, it's the previous calendar year's financial year
  return month >= 6 ? year : year - 1;
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
    
    // Debug logging removed - FIFO fix complete
    
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
          let totalCost = 0;
          let soldHoldings = []; // Track which holdings were sold for holding period calculation
          
          while (remainingQty > 0 && holdings.length > 0) {
            const holding = holdings[0];
            const qtyToSell = Math.min(remainingQty, holding.qty);
            
            const costPerShare = holding.cost / holding.qty;
            const costBasis = costPerShare * qtyToSell;
            
            // Track this sold holding for holding period calculation
            soldHoldings.push({
              date: holding.date,
              qty: qtyToSell
            });
            
            totalCost += costBasis;
            remainingQty -= qtyToSell;
            holding.qty -= qtyToSell;
            holding.cost -= costBasis; // Reduce cost proportionally when qty is reduced
            
            if (holding.qty === 0) {
              holdings.shift();
            }
          }
          
          // Use AUD amounts for Capital Gains (ATO requirement)
          const netProceeds = (trade.amountAUD || 0) - (trade.commissionAUD || 0) - (trade.feesAUD || 0);
          const capitalGain = netProceeds - totalCost;
          
          // Calculate holding period based on sold holdings (not remaining holdings)
          const holdingPeriod = calculateHoldingPeriodFromSold(soldHoldings, trade.date);
          
          // Calculate sell price per unit safely
          const sellPricePerUnit = trade.qty > 0 ? (trade.amountAUD || 0) / trade.qty : 0;
          
          capitalGains.push({
            symbol: symbol,
            name: trade.name,
            isOption: optionsInfo !== null,
            optionsInfo: optionsInfo,
            sellDate: trade.date,
            buyDate: soldHoldings.length > 0 ? soldHoldings[0].date : null,
            qty: trade.qty,
            sellPrice: sellPricePerUnit, // AUD price per unit
            costBasis: totalCost,
            proceeds: netProceeds,
            capitalGain: capitalGain,
            holdingPeriod: holdingPeriod,
            currency: 'AUD', // Mark as AUD for display
            market: trade.market // Original market for reference
          });
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

// Calculate historical cost basis for existing positions up to (but excluding) a cutoff date
function calculateHistoricalCostBasisUntil(trades, endDateExclusive) {
  const allExecutedTrades = trades.filter(trade => isExecutedStatus(trade.Status));
  const symbolGroups = {};

  allExecutedTrades.forEach(trade => {
    const tradeDate = parseCSVDate(trade['Fill Time']);
    if (endDateExclusive && !(tradeDate < endDateExclusive)) return;

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
      date: tradeDate,
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

    // Include positions that had historical trades, even if fully sold
    if (trades.length > 0) {
      const avgCostBasis = totalQuantity > 0 ? totalCostBasis / totalQuantity : 0;
      historicalPositions[symbol] = {
        symbol,
        netPosition,
        avgCostBasis,
        totalCostBasis,
        totalQuantity
      };
    }
  });

  return historicalPositions;
}

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
async function startServer() {
  try {
    // Load currency rates first
    await loadCurrencyRates();
    
    // Then load portfolio data
    await loadPortfolioData();
    
    // Log market distribution for verification
    const marketCounts = portfolioData.reduce((acc, trade) => {
      acc[trade.market] = (acc[trade.market] || 0) + 1;
      return acc;
    }, {});
    console.log('Market distribution:', marketCounts);
    
    app.listen(PORT, () => {
      console.log(`Portfolio Tracker running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
