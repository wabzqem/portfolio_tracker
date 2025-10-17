class PortfolioTracker {
    constructor() {
        this.trades = [];
        this.summary = null;
        this.capitalGains = [];
        this.bestWorstTrades = [];
        this.financialYears = [];
        this.selectedFinancialYear = null;
        this.currentPage = 1;
        this.tradesPerPage = 100;
        this.tradeFilters = {
            symbol: '',
            exactSymbol: false, // Flag for exact symbol matching
            expiry: '',
            strikePrice: '',
            optionType: ''
        };
        this.includeExpiredOptions = true; // Include expired options by default
        this.capitalGainsViewMode = 'by-symbol'; // Toggle between 'by-symbol' and 'by-underlying'
        this.applyLongTermDiscount = true; // Apply 50% discount for long-term capital gains
        this.currentCurrency = 'AUD'; // Default currency for portfolio summary
        this.performanceChart = null; // Chart.js instance
        this.performanceData = null; // Performance data cache
        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.renderOverview();
    }

    async loadData() {
        try {
            // Load all currency-aware data
            await this.loadAllCurrencyAwareData();

            // Load financial years first
            await this.loadFinancialYears();

            await this.loadAllGains();

            console.log('Data loaded:', this.trades.length, 'trades');
            console.log('Financial years:', this.financialYears.length, 'years available');
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load portfolio data');
        }
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });
        
        // Global currency toggle
        document.querySelectorAll('#globalCurrencyAUD, #globalCurrencyUSD').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const currency = e.target.dataset.currency;
                this.switchGlobalCurrency(currency);
            });
        });

        // Financial year selector
        const financialYearSelect = document.getElementById('financialYearSelect');
        if (financialYearSelect) {
            financialYearSelect.addEventListener('change', (e) => {
                this.selectedFinancialYear = e.target.value ? parseInt(e.target.value) : null;
                this.loadCapitalGains();
            });
        }
    }

    switchGlobalCurrency(currency) {
        if (this.currentCurrency === currency) return;
        
        this.currentCurrency = currency;
        
        // Update global button states
        document.querySelectorAll('#globalCurrencyAUD, #globalCurrencyUSD').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.currency === currency);
        });
        
        // Reload performance data if performance tab is active
        if (document.getElementById('performance').classList.contains('active')) {
            this.performanceData = null; // Clear cache to force reload
            this.loadPerformanceData();
        }
        
        // Reload all data except Capital Gains
        this.loadAllCurrencyAwareData();
    }

    async loadAllCurrencyAwareData() {
        try {
            // Load portfolio summary with currency
            await this.loadPortfolioSummary();
            
            // Load best/worst trades with currency
            await this.loadAllGains();
            
            // Load trades with currency and expired options
            this.trades = await window.electronAPI.getTrades({
                currency: this.currentCurrency,
                includeExpired: this.includeExpiredOptions
            });
            
            // Update all views
            this.renderOverview(); // Updates header stats and best/worst trades
            this.renderTrades();   // Updates trades table
            this.renderPositions(); // Updates current positions
            
        } catch (error) {
            console.error('Error loading currency-aware data:', error);
        }
    }

    async loadPortfolioSummary() {
        try {
            this.summary = await window.electronAPI.getPortfolioSummary({
                currency: this.currentCurrency
            });
            this.renderOverview();
        } catch (error) {
            console.error('Error loading portfolio summary:', error);
        }
    }

    async loadFinancialYears() {
        try {
            this.financialYears = await window.electronAPI.getFinancialYears();
            this.setupFinancialYearDropdown();
            
            // Load capital gains for the most recent financial year by default
            if (this.financialYears.length > 0) {
                this.selectedFinancialYear = this.financialYears[0].year;
                await this.loadCapitalGains();
            }
        } catch (error) {
            console.error('Error loading financial years:', error);
        }
    }

    async loadCapitalGains() {
        try {
            this.capitalGains = await window.electronAPI.getCapitalGains(this.selectedFinancialYear);
            
            // Update the capital gains view if it's currently active
            if (document.getElementById('capital-gains').classList.contains('active')) {
                this.renderCapitalGains();
            }
        } catch (error) {
            console.error('Error loading capital gains:', error);
        }
    }

    async loadAllGains() {
        try {
            this.bestWorstTrades = await window.electronAPI.getBestWorstTrades({
                currency: this.currentCurrency
            });
            
            // Update the overview view if it's currently active
            if (document.getElementById('overview').classList.contains('active')) {
                this.renderOverview();
            }
        } catch (error) {
            console.error('Error loading best/worst trades:', error);
        }
    }

    setupFinancialYearDropdown() {
        const select = document.getElementById('financialYearSelect');
        if (!select) return;

        if (this.financialYears.length === 0) {
            select.innerHTML = '<option value="">No data available</option>';
            return;
        }

        select.innerHTML = this.financialYears.map(fy => 
            `<option value="${fy.year}" ${fy.year === this.selectedFinancialYear ? 'selected' : ''}>
                ${fy.label} (${fy.startDate} to ${fy.endDate})
            </option>`
        ).join('');
    }


    // Calculate the discounted capital gain for long-term holdings (> 1 year)
    calculateDiscountedCapitalGain(gain) {
        const fullGain = gain.capitalGain;
        const isLongTerm = gain.holdingPeriod >= 365;
        const shouldApplyDiscount = this.applyLongTermDiscount && isLongTerm && fullGain > 0;
        const discountedGain = shouldApplyDiscount ? fullGain / 2 : fullGain;
        
        return {
            fullGain: fullGain,
            discountedGain: discountedGain,
            isLongTerm: isLongTerm,
            discountApplied: shouldApplyDiscount,
            discount: shouldApplyDiscount ? fullGain - discountedGain : 0
        };
    }

    // Format capital gain display with both full and discounted amounts
    formatCapitalGainCell(gain) {
        const cgData = this.calculateDiscountedCapitalGain(gain);
        const fullAmount = this.formatCurrency(cgData.fullGain);
        const discountedAmount = this.formatCurrency(cgData.discountedGain);
        
        if (this.applyLongTermDiscount && cgData.isLongTerm && cgData.fullGain > 0) {
            return `
                <div style="display: flex; flex-direction: column; align-items: flex-end;">
                    <div style="font-size: 0.8rem; color: #6b7280; text-decoration: line-through;">
                        Full: ${fullAmount}
                    </div>
                    <div style="font-weight: 600;">
                        ${discountedAmount}
                    </div>
                    <div style="font-size: 0.7rem; color: #10b981;">
                        50% discount applied
                    </div>
                </div>
            `;
        } else if (!this.applyLongTermDiscount && cgData.isLongTerm && cgData.fullGain > 0) {
            return `
                <div style="display: flex; flex-direction: column; align-items: flex-end;">
                    <div style="font-weight: 600;">
                        ${fullAmount}
                    </div>
                    <div style="font-size: 0.7rem; color: #f59e0b;">
                        Long-term (discount available)
                    </div>
                </div>
            `;
        } else {
            return `<div style="font-weight: 600;">${discountedAmount}</div>`;
        }
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');

        // Render appropriate content
        switch (tabName) {
            case 'overview':
                this.renderOverview();
                break;
            case 'trades':
                this.currentPage = 1; // Reset to first page when switching to trades tab
                this.renderTrades();
                break;
            case 'positions':
                this.renderPositions();
                break;
            case 'performance':
                this.renderPerformance();
                break;
            case 'capital-gains':
                // Ensure financial year dropdown is set up and capital gains are loaded
                this.setupFinancialYearDropdown();
                if (this.capitalGains.length === 0 && this.selectedFinancialYear) {
                    this.loadCapitalGains();
                } else {
                    this.renderCapitalGains();
                }
                break;
        }
    }

    renderOverview() {
        if (!this.summary) return;

        // Render portfolio summary
        const summaryHtml = `
            <div class="summary-item">
                <span class="summary-label">Total Trades</span>
                <span class="summary-value">${this.summary.totalTrades.toLocaleString()}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Filled Trades</span>
                <span class="summary-value">${this.summary.filledTrades.toLocaleString()}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Total Volume</span>
                <span class="summary-value">${this.formatCurrency(this.summary.totalVolume)}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Buy Volume</span>
                <span class="summary-value">${this.formatCurrency(this.summary.buyVolume)}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Sell Volume</span>
                <span class="summary-value">${this.formatCurrency(this.summary.sellVolume)}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Total P&L</span>
                <span class="summary-value ${this.summary.totalPnL >= 0 ? 'positive' : 'negative'}">${this.formatCurrency(this.summary.totalPnL)}</span>
            </div>
        `;
        document.getElementById('portfolioSummary').innerHTML = summaryHtml;

        // Render top winning and losing trades
        this.renderTopTrades();
    }

    renderTopTrades() {
        if (!this.trades || this.bestWorstTrades.length === 0) {
            document.getElementById('topPositions').innerHTML = '<div class="loading">No completed trades found</div>';
            return;
        }

        // Sort capital gains by profit/loss
        const sortedTrades = [...this.bestWorstTrades].sort((a, b) => b.capitalGain - a.capitalGain);
        
        // Get top 5 winners and top 5 losers
        const topWinners = sortedTrades.slice(0, 5);
        const topLosers = sortedTrades.slice(-5).reverse(); // Reverse to show biggest losers first
        
        const winningTradesHtml = topWinners.map(trade => {
            const optionsInfo = trade.isOption ? trade.optionsInfo : null;
            const symbolDisplay = optionsInfo ? 
                `${optionsInfo.underlying} ${new Date(optionsInfo.expiryDate).toLocaleDateString()} ${optionsInfo.optionType} $${optionsInfo.strikePrice}` :
                trade.symbol;
            
            const sellDate = new Date(trade.sellDate).toLocaleDateString();
            const holdingPeriod = trade.holdingPeriod >= 365 ? 
                `${Math.floor(trade.holdingPeriod / 365)}y` : `${trade.holdingPeriod}d`;
            
            return `
                <div class="trade-item winning-trade">
                    <div class="trade-info">
                        <div class="trade-symbol">${symbolDisplay}</div>
                        <div class="trade-details">
                            <span class="trade-date">${sellDate}</span>
                            <span class="trade-qty">${trade.qty.toFixed(0)} ${optionsInfo ? 'contracts' : 'shares'}</span>
                            <span class="trade-holding">${holdingPeriod}</span>
                        </div>
                        ${optionsInfo ? '<div class="trade-type">OPTION</div>' : '<div class="trade-type">STOCK</div>'}
                    </div>
                    <div class="trade-pnl positive">
                        ${this.formatCurrency(trade.capitalGain)}
                    </div>
                </div>
            `;
        }).join('');

        const losingTradesHtml = topLosers.map(trade => {
            const optionsInfo = trade.isOption ? trade.optionsInfo : null;
            const symbolDisplay = optionsInfo ? 
                `${optionsInfo.underlying} ${new Date(optionsInfo.expiryDate).toLocaleDateString()} ${optionsInfo.optionType} $${optionsInfo.strikePrice}` :
                trade.symbol;
            
            const sellDate = new Date(trade.sellDate).toLocaleDateString();
            const holdingPeriod = trade.holdingPeriod >= 365 ? 
                `${Math.floor(trade.holdingPeriod / 365)}y` : `${trade.holdingPeriod}d`;
            
            return `
                <div class="trade-item losing-trade">
                    <div class="trade-info">
                        <div class="trade-symbol">${symbolDisplay}</div>
                        <div class="trade-details">
                            <span class="trade-date">${sellDate}</span>
                            <span class="trade-qty">${trade.qty.toFixed(0)} ${optionsInfo ? 'contracts' : 'shares'}</span>
                            <span class="trade-holding">${holdingPeriod}</span>
                        </div>
                        ${optionsInfo ? '<div class="trade-type">OPTION</div>' : '<div class="trade-type">STOCK</div>'}
                    </div>
                    <div class="trade-pnl negative">
                        ${this.formatCurrency(trade.capitalGain)}
                    </div>
                </div>
            `;
        }).join('');

        const topTradesHtml = `
            <div class="top-trades-container">
                <div class="winning-trades-section">
                    <h4><i class="fas fa-trophy" style="color: #10b981;"></i> Top 5 Winning Trades</h4>
                    <div class="trades-list">
                        ${winningTradesHtml}
                    </div>
                </div>
                <div class="losing-trades-section">
                    <h4><i class="fas fa-exclamation-triangle" style="color: #ef4444;"></i> Top 5 Losing Trades</h4>
                    <div class="trades-list">
                        ${losingTradesHtml}
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('topPositions').innerHTML = topTradesHtml;
    }

    renderTrades() {
        if (!this.trades.length) return;

        // Render filter controls first
        this.renderTradeFilters();

        // Apply filters to trades
        const filteredTrades = this.applyTradeFilters(this.trades);

        // Calculate pagination
        const totalTrades = filteredTrades.length;
        const totalPages = Math.ceil(totalTrades / this.tradesPerPage);
        const startIndex = (this.currentPage - 1) * this.tradesPerPage;
        const endIndex = startIndex + this.tradesPerPage;
        const currentTrades = filteredTrades.slice(startIndex, endIndex);

        const tableBody = document.querySelector('#tradesTable tbody');
        const tradesHtml = currentTrades.map(trade => {
            // Handle date parsing more robustly
            let orderTime = 'N/A';
            try {
                const dateStr = trade['Order Time'];
                if (dateStr && dateStr.trim() !== '') {
                    // Remove timezone suffixes
                    const cleanDate = dateStr.replace(' ET', '').replace(' AEST', '').replace(' AEDT', '');
                    
                    // Check if it's in DD/MM/YYYY format (common for expired options)
                    const ddmmyyyy = cleanDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(.*)/);
                    if (ddmmyyyy) {
                        // Convert DD/MM/YYYY to MM/DD/YYYY format
                        const [, day, month, year, timeStr] = ddmmyyyy;
                        const convertedDate = `${month}/${day}/${year}${timeStr}`;
                        const parsedDate = new Date(convertedDate);
                        if (!isNaN(parsedDate.getTime())) {
                            orderTime = parsedDate.toLocaleDateString();
                        }
                    } else {
                        // Try parsing as-is (for other formats)
                        const parsedDate = new Date(cleanDate);
                        if (!isNaN(parsedDate.getTime())) {
                            orderTime = parsedDate.toLocaleDateString();
                        }
                    }
                }
            } catch (error) {
                console.warn('Failed to parse date:', trade['Order Time'], error);
            }
            const fillPrice = parseFloat(trade['Fill Price']) || 0;
            const fillQty = parseFloat(trade['Fill Qty']) || 0;
            // Handle currency-converted Fill Amount (may be a formatted string)
            const fillAmountStr = trade['Fill Amount'] || '0';
            const fillAmount = typeof fillAmountStr === 'string' ? 
                parseFloat(fillAmountStr.replace(/,/g, '')) : parseFloat(fillAmountStr);
            
            // Parse options symbol if it's an option
            const optionsInfo = this.parseOptionsSymbol(trade.Symbol);
            const symbolDisplay = optionsInfo ? 
                `${optionsInfo.underlying} ${new Date(optionsInfo.expiryDate).toLocaleDateString()} ${optionsInfo.optionType} $${optionsInfo.strikePrice}` :
                trade.Symbol;
            
            const isExpired = trade.isExpired === true;
            const expiredClass = isExpired ? ' expired-option' : '';
            const expiredLabel = isExpired ? '<br><small style="color: #ef4444;">EXPIRED</small>' : '';
            
            return `
                <tr class="${expiredClass}">
                    <td>${orderTime}</td>
                    <td><strong>${symbolDisplay}</strong>${optionsInfo ? '<br><small style="color: #f59e0b;">OPTION</small>' : ''}${expiredLabel}</td>
                    <td><span class="side-${trade.Side.toLowerCase()}">${trade.Side}</span></td>
                    <td>${fillQty.toFixed(0)}</td>
                    <td>$${fillPrice.toFixed(2)}</td>
                    <td>${this.formatCurrency(fillAmount)}</td>
                    <td><span class="status-${trade.Status.toLowerCase()}">${trade.Status}</span></td>
                </tr>
            `;
        }).join('');

        tableBody.innerHTML = tradesHtml;

        // Render pagination controls
        this.renderTradesPagination(totalTrades, totalPages);
    }

    renderTradesPagination(totalTrades, totalPages) {
        const paginationContainer = document.querySelector('#trades .pagination-container') || this.createPaginationContainer();
        
        // Calculate range of trades being shown
        const startIndex = (this.currentPage - 1) * this.tradesPerPage + 1;
        const endIndex = Math.min(this.currentPage * this.tradesPerPage, totalTrades);
        
        // Generate pagination HTML
        const paginationHtml = `
            <div class="pagination-info">
                Showing ${startIndex.toLocaleString()}-${endIndex.toLocaleString()} of ${totalTrades.toLocaleString()} trades
            </div>
            <div class="pagination-controls">
                <button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} data-page="first">
                    <i class="fas fa-angle-double-left"></i> First
                </button>
                <button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} data-page="prev">
                    <i class="fas fa-angle-left"></i> Previous
                </button>
                <span class="page-info">Page ${this.currentPage} of ${totalPages}</span>
                <button class="pagination-btn" ${this.currentPage === totalPages ? 'disabled' : ''} data-page="next">
                    Next <i class="fas fa-angle-right"></i>
                </button>
                <button class="pagination-btn" ${this.currentPage === totalPages ? 'disabled' : ''} data-page="last">
                    Last <i class="fas fa-angle-double-right"></i>
                </button>
            </div>
        `;
        
        paginationContainer.innerHTML = paginationHtml;
        
        // Add event listeners for pagination buttons
        paginationContainer.querySelectorAll('.pagination-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = e.currentTarget.dataset.page;
                this.handlePagination(page, totalPages);
            });
        });
    }

    createPaginationContainer() {
        const tradesSection = document.querySelector('#trades .card');
        const paginationContainer = document.createElement('div');
        paginationContainer.className = 'pagination-container';
        tradesSection.appendChild(paginationContainer);
        return paginationContainer;
    }

    handlePagination(action, totalPages) {
        switch (action) {
            case 'first':
                this.currentPage = 1;
                break;
            case 'prev':
                this.currentPage = Math.max(1, this.currentPage - 1);
                break;
            case 'next':
                this.currentPage = Math.min(totalPages, this.currentPage + 1);
                break;
            case 'last':
                this.currentPage = totalPages;
                break;
        }
        this.renderTrades();
    }

    renderTradeFilters() {
        const tradesSection = document.querySelector('#trades .card');
        let filterContainer = tradesSection.querySelector('.trades-filter-container');
        
        if (!filterContainer) {
            filterContainer = document.createElement('div');
            filterContainer.className = 'trades-filter-container';
            // Insert before the table container
            const tableContainer = tradesSection.querySelector('.table-container');
            tradesSection.insertBefore(filterContainer, tableContainer);
            
            // Create initial HTML structure
            filterContainer.innerHTML = `
                <div class="filter-header">
                    <h4><i class="fas fa-filter"></i> Filter Trades</h4>
                    <button class="clear-filters-btn" onclick="portfolioTracker.clearAllFilters()">
                        <i class="fas fa-times"></i> Clear All
                    </button>
                </div>
                <div class="filter-controls">
                    <div class="filter-group">
                        <label for="symbolFilter">Symbol/Underlying:</label>
                        <div class="symbol-filter-container">
                            <input type="text" id="symbolFilter" placeholder="e.g., TSLA, AAPL..." 
                                   oninput="portfolioTracker.updateFilter('symbol', this.value)"
                                   onkeydown="portfolioTracker.handleSymbolKeydown(event)">
                            <button class="exact-match-btn" id="exactMatchBtn" 
                                    onclick="portfolioTracker.toggleExactMatch()"
                                    title="Toggle exact symbol match">
                                <i class="fas fa-equals"></i>
                            </button>
                        </div>
                        <div class="filter-hint">
                            <span id="filterModeText">Partial match</span> • Press Enter or click = for exact match
                        </div>
                    </div>
                    <div class="filter-group">
                        <label for="expiryFilter">Expiry Date:</label>
                        <select id="expiryFilter" onchange="portfolioTracker.updateFilter('expiry', this.value)">
                            <option value="">All Expiries</option>
                        </select>
                        <div class="filter-hint filter-spacer">&nbsp;</div>
                    </div>
                    <div class="filter-group">
                        <label for="strikePriceFilter">Strike Price:</label>
                        <select id="strikePriceFilter" onchange="portfolioTracker.updateFilter('strikePrice', this.value)">
                            <option value="">All Strikes</option>
                        </select>
                        <div class="filter-hint filter-spacer">&nbsp;</div>
                    </div>
                    <div class="filter-group">
                        <label for="optionTypeFilter">Option Type:</label>
                        <select id="optionTypeFilter" onchange="portfolioTracker.updateFilter('optionType', this.value)">
                            <option value="">All Types</option>
                        </select>
                        <div class="filter-hint filter-spacer">&nbsp;</div>
                    </div>
                    <div class="filter-group">
                        <label for="expiredOptionsToggle">Include Expired Options:</label>
                        <label class="switch">
                            <input type="checkbox" id="expiredOptionsToggle" onchange="portfolioTracker.toggleExpiredOptions()" checked>
                            <span class="slider"></span>
                        </label>
                        <div class="filter-hint">Show synthetic sells for expired options</div>
                    </div>
                </div>
            `;
        }

        // Update input value and exact match state without losing focus
        const symbolInput = filterContainer.querySelector('#symbolFilter');
        if (symbolInput && symbolInput.value !== this.tradeFilters.symbol) {
            symbolInput.value = this.tradeFilters.symbol;
        }
        
        // Update exact match button state and hint text
        const exactMatchBtn = filterContainer.querySelector('#exactMatchBtn');
        const filterModeText = filterContainer.querySelector('#filterModeText');
        if (exactMatchBtn && filterModeText) {
            if (this.tradeFilters.exactSymbol) {
                exactMatchBtn.classList.add('active');
                filterModeText.textContent = 'Exact match';
            } else {
                exactMatchBtn.classList.remove('active');
                filterModeText.textContent = 'Partial match';
            }
        }

        // Update expired options toggle state
        const expiredToggle = filterContainer.querySelector('#expiredOptionsToggle');
        if (expiredToggle) {
            expiredToggle.checked = this.includeExpiredOptions;
        }

        // Update dropdown options based on current symbol filter
        this.updateFilterDropdowns(filterContainer);
    }

    updateFilterDropdowns(container) {
        // Get trades that match the current symbol filter
        const symbolFilteredTrades = this.tradeFilters.symbol ? 
            this.trades.filter(trade => {
                const symbolLower = this.tradeFilters.symbol.toLowerCase();
                const tradeLower = trade.Symbol.toLowerCase();
                const optionsInfo = this.parseOptionsSymbol(trade.Symbol);
                const underlyingMatch = optionsInfo ? optionsInfo.underlying.toLowerCase().includes(symbolLower) : false;
                return tradeLower.includes(symbolLower) || underlyingMatch;
            }) : this.trades;

        // Get unique values from symbol-filtered trades
        const uniqueExpiries = new Set();
        const uniqueStrikes = new Set();
        const uniqueOptionTypes = new Set();
        
        symbolFilteredTrades.forEach(trade => {
            const optionsInfo = this.parseOptionsSymbol(trade.Symbol);
            if (optionsInfo) {
                uniqueExpiries.add(optionsInfo.expiryDate);
                uniqueStrikes.add(optionsInfo.strikePrice);
                uniqueOptionTypes.add(optionsInfo.optionType);
            }
        });

        // Sort arrays for dropdowns
        const sortedExpiries = Array.from(uniqueExpiries).sort();
        const sortedStrikes = Array.from(uniqueStrikes).sort((a, b) => a - b);
        const sortedOptionTypes = Array.from(uniqueOptionTypes).sort();

        // Update expiry dropdown
        const expirySelect = container.querySelector('#expiryFilter');
        const currentExpiry = expirySelect.value;
        expirySelect.innerHTML = `
            <option value="">All Expiries</option>
            ${sortedExpiries.map(exp => `
                <option value="${exp}" ${this.tradeFilters.expiry === exp ? 'selected' : ''}>
                    ${new Date(exp).toLocaleDateString()}
                </option>
            `).join('')}
        `;

        // Update strike price dropdown
        const strikeSelect = container.querySelector('#strikePriceFilter');
        strikeSelect.innerHTML = `
            <option value="">All Strikes</option>
            ${sortedStrikes.map(strike => `
                <option value="${strike}" ${this.tradeFilters.strikePrice == strike ? 'selected' : ''}>
                    $${strike}
                </option>
            `).join('')}
        `;

        // Update option type dropdown
        const typeSelect = container.querySelector('#optionTypeFilter');
        typeSelect.innerHTML = `
            <option value="">All Types</option>
            ${sortedOptionTypes.map(type => `
                <option value="${type}" ${this.tradeFilters.optionType === type ? 'selected' : ''}>
                    ${type}
                </option>
            `).join('')}
        `;

        // Clear filters that are no longer valid
        if (this.tradeFilters.expiry && !uniqueExpiries.has(this.tradeFilters.expiry)) {
            this.tradeFilters.expiry = '';
        }
        if (this.tradeFilters.strikePrice && !uniqueStrikes.has(parseFloat(this.tradeFilters.strikePrice))) {
            this.tradeFilters.strikePrice = '';
        }
        if (this.tradeFilters.optionType && !uniqueOptionTypes.has(this.tradeFilters.optionType)) {
            this.tradeFilters.optionType = '';
        }
    }

    applyTradeFilters(trades) {
        return trades.filter(trade => {
            // Symbol filter (works on both stock symbols and underlying for options)
            if (this.tradeFilters.symbol) {
                const symbolLower = this.tradeFilters.symbol.toLowerCase();
                const tradeLower = trade.Symbol.toLowerCase();
                const optionsInfo = this.parseOptionsSymbol(trade.Symbol);
                
                if (this.tradeFilters.exactSymbol) {
                    // Exact matching: symbol must exactly match stock symbol or underlying
                    const exactStockMatch = tradeLower === symbolLower;
                    //const exactUnderlyingMatch = optionsInfo ? optionsInfo.underlying.toLowerCase() === symbolLower : false;
                    
                    if (!exactStockMatch) {// && !exactUnderlyingMatch) {
                        return false;
                    }
                } else {
                    // Partial matching: symbol can be contained in stock symbol or underlying
                    const partialStockMatch = tradeLower.includes(symbolLower);
                    const partialUnderlyingMatch = optionsInfo ? optionsInfo.underlying.toLowerCase().includes(symbolLower) : false;
                    
                    if (!partialStockMatch && !partialUnderlyingMatch) {
                        return false;
                    }
                }
            }

            // Options-specific filters only apply to options
            const optionsInfo = this.parseOptionsSymbol(trade.Symbol);
            if (optionsInfo) {
                if (this.tradeFilters.expiry && optionsInfo.expiryDate !== this.tradeFilters.expiry) {
                    return false;
                }
                if (this.tradeFilters.strikePrice && optionsInfo.strikePrice != this.tradeFilters.strikePrice) {
                    return false;
                }
                if (this.tradeFilters.optionType && optionsInfo.optionType !== this.tradeFilters.optionType) {
                    return false;
                }
            } else {
                // If this is a stock but we have options filters set, exclude it
                if (this.tradeFilters.expiry || this.tradeFilters.strikePrice || this.tradeFilters.optionType) {
                    return false;
                }
            }

            return true;
        });
    }

    updateFilter(filterType, value) {
        this.tradeFilters[filterType] = value;
        this.currentPage = 1; // Reset to first page when filters change
        this.renderTrades();
    }

    handleSymbolKeydown(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.tradeFilters.exactSymbol = true;
            this.renderTrades();
        }
    }

    toggleExactMatch() {
        this.tradeFilters.exactSymbol = !this.tradeFilters.exactSymbol;
        this.renderTrades();
    }

    clearAllFilters() {
        this.tradeFilters = {
            symbol: '',
            exactSymbol: false,
            expiry: '',
            strikePrice: '',
            optionType: ''
        };
        this.currentPage = 1;
        this.renderTrades();
    }

    toggleExpiredOptions() {
        this.includeExpiredOptions = !this.includeExpiredOptions;
        this.currentPage = 1;
        // Reload trades data with new setting
        this.loadAllCurrencyAwareData();
    }

    toggleLongTermDiscount() {
        this.applyLongTermDiscount = !this.applyLongTermDiscount;
        // Update table header
        this.updateCapitalGainTableHeader();
        // Re-render capital gains to update calculations and display
        this.renderCapitalGains();
    }

    updateCapitalGainTableHeader() {
        const header = document.getElementById('capitalGainHeader');
        if (header) {
            if (this.applyLongTermDiscount) {
                header.innerHTML = 'Capital Gain/Loss<br><small style="font-weight: normal; color: #10b981;">50% discount applied for assets held >1yr</small>';
            } else {
                header.innerHTML = 'Capital Gain/Loss<br><small style="font-weight: normal; color: #f59e0b;">Full amounts (no discount applied)</small>';
            }
        }
    }

    renderPositions() {
        if (!this.summary) return;

        const positions = this.summary.currentPositions || [];

        // Separate equity vs options
        const equityPositions = positions.filter(p => !p.isOption);
        const optionPositions = positions.filter(p => p.isOption && p.optionsInfo);

        // Group options by underlying symbol
        const optionGroups = optionPositions.reduce((acc, pos) => {
            const underlying = pos.optionsInfo.underlying;
            if (!acc[underlying]) acc[underlying] = [];
            acc[underlying].push(pos);
            return acc;
        }, {});

        // Build HTML for equity positions (ungrouped)
        const equityHtml = equityPositions.map(position => {
            const symbolDisplay = position.symbol;
            return `
                <div class="position-item">
                    <div>
                        <div class="position-symbol">${symbolDisplay}</div>
                        <div style="font-size: 0.8rem; color: #64748b;">${position.name}</div>
                    </div>
                    <div class="position-details">
                        <div class="position-qty ${position.netPosition >= 0 ? 'positive' : 'negative'}">
                            ${position.netPosition >= 0 ? '+' : ''}${position.netPosition.toFixed(0)} shares
                        </div>
                        <div class="position-value">Avg Buy: $${position.avgBuyPrice.toFixed(2)}</div>
                        ${position.historicalCostBasis > 0 ? `<div class="position-value">Historical Cost: ${this.formatCurrency(position.historicalCostBasis)}</div>` : ''}
                        <div class="position-value ${position.totalPnL >= 0 ? 'positive' : 'negative'}">
                            P&L: ${this.formatCurrency(position.totalPnL)}
                        </div>
                        <div class="position-value">Volume: ${this.formatCurrency(position.totalVolume)}</div>
                    </div>
                </div>
            `;
        }).join('');

        // Build HTML for option groups (expandable)
        const optionGroupsHtml = Object.keys(optionGroups).sort().map(underlying => {
            const items = optionGroups[underlying]
                .sort((a, b) => new Date(a.optionsInfo.expiryDate) - new Date(b.optionsInfo.expiryDate) || a.optionsInfo.strikePrice - b.optionsInfo.strikePrice)
                .map(position => {
                    const oi = position.optionsInfo;
                    const symbolDisplay = `${oi.underlying} ${new Date(oi.expiryDate).toLocaleDateString()} ${oi.optionType} $${oi.strikePrice}`;
                    return `
                        <div class="position-item option-item" data-underlying="${underlying}">
                            <div>
                                <div class="position-symbol">${symbolDisplay}</div>
                                <div style="font-size: 0.8rem; color: #64748b;">${position.name}</div>
                                <div style="font-size: 0.7rem; color: #f59e0b;">OPTION</div>
                            </div>
                            <div class="position-details">
                                <div class="position-qty ${position.netPosition >= 0 ? 'positive' : 'negative'}">
                                    ${position.netPosition >= 0 ? '+' : ''}${position.netPosition.toFixed(0)} contracts
                                </div>
                                <div class="position-value">Avg Buy: $${position.avgBuyPrice.toFixed(2)}</div>
                                ${position.historicalCostBasis > 0 ? `<div class="position-value">Historical Cost: ${this.formatCurrency(position.historicalCostBasis)}</div>` : ''}
                                <div class="position-value ${position.totalPnL >= 0 ? 'positive' : 'negative'}">
                                    P&L: ${this.formatCurrency(position.totalPnL)}
                                </div>
                                <div class="position-value">Volume: ${this.formatCurrency(position.totalVolume)}</div>
                            </div>
                        </div>
                    `;
                }).join('');

            const groupNet = optionGroups[underlying].reduce((sum, p) => sum + p.netPosition, 0);
            const groupHeader = `
                <div class="option-group-header" data-toggle-group="${underlying}" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:#eeeeee; border:1px solid #1f2a44; border-radius:8px; margin-top:12px;">
                    <div style="display:flex; gap:8px; align-items:center;">
                        <span class="chevron" data-chevron-for="${underlying}" style="transition: transform 0.2s;">▸</span>
                        <span class="position-symbol">${underlying}</span>
                        <span style="font-size:0.8rem; color:#64748b;">Options</span>
                    </div>
                    <div class="position-qty ${groupNet >= 0 ? 'positive' : 'negative'}">${groupNet >= 0 ? '+' : ''}${groupNet.toFixed(0)} total</div>
                </div>
            `;

            const groupBody = `
                <div class="option-group-body" data-group="${underlying}" style="display:none; margin-left:18px; border-left:2px solid #1f2a44; padding-left:10px;">
                    ${items}
                </div>
            `;

            return `<div class="option-group">${groupHeader}${groupBody}</div>`;
        }).join('');

        const combinedHtml = [equityHtml, optionGroupsHtml].filter(Boolean).join('');
        document.getElementById('positionsTable').innerHTML = combinedHtml || '<div class="loading">No open positions</div>';

        // Attach toggles
        document.querySelectorAll('[data-toggle-group]').forEach(header => {
            header.addEventListener('click', () => {
                const key = header.getAttribute('data-toggle-group');
                const body = document.querySelector(`.option-group-body[data-group="${key}"]`);
                const chev = document.querySelector(`.chevron[data-chevron-for="${key}"]`);
                if (body) {
                    const open = body.style.display !== 'none';
                    body.style.display = open ? 'none' : 'block';
                    if (chev) {
                        chev.style.transform = open ? 'rotate(0deg)' : 'rotate(90deg)';
                    }
                }
            });
        });
    }

    renderCapitalGains() {
        if (!this.capitalGains.length) return;

        // Calculate total capital gains for summary (using discounted amounts)
        const totalCapitalGains = this.capitalGains.reduce((sum, gain) => {
            const cgData = this.calculateDiscountedCapitalGain(gain);
            return sum + cgData.discountedGain;
        }, 0);
        
        // Clear and rebuild the entire container
        const capitalGainsContainer = document.querySelector('#capital-gains .card');
        
        // Update table header to reflect current toggle state
        this.updateCapitalGainTableHeader();
        
        // Get selected financial year info for display
        const selectedFY = this.financialYears.find(fy => fy.year === this.selectedFinancialYear);
        const fyDisplayText = selectedFY ? selectedFY.label : 'Current Financial Year';
        
        // Create header with toggle buttons
        const headerHtml = `
            <h3><i class="fas fa-calculator"></i> Capital Gains (Tax Reporting - ATO Compliant)</h3>

            <div class="financial-year-selector" style="margin-bottom: 20px; padding: 20px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
                <div class="filter-header" style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #e5e7eb;">
                    <h4 style="margin: 0; color: #374151; font-size: 1.1rem; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-calendar-alt"></i> Financial Year Selection
                    </h4>
                </div>
                <div class="filter-group" style="display: flex; flex-direction: column; gap: 6px; min-height: auto;">
                    <label for="financialYearSelect" style="font-size: 0.9rem; font-weight: 500; color: #374151;">
                        Select Financial Year:
                    </label>
                    <select id="financialYearSelect">
                        <option value="">Loading...</option>
                    </select>
                </div>
            </div>
                        <div style="margin-bottom: 20px; padding: 15px; background: rgba(59, 130, 246, 0.1); border-radius: 10px; border: 1px solid rgba(59, 130, 246, 0.2);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-percent" style="color: #3b82f6;"></i>
                        <strong style="color: #1e40af;">Long-Term Capital Gains Discount (50%)</strong>
                    </div>
                    <label class="switch">
                        <input type="checkbox" id="longTermDiscountToggle" onchange="portfolioTracker.toggleLongTermDiscount()" ${this.applyLongTermDiscount ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                <div style="font-size: 0.85rem; color: #1e40af;">
                    ${this.applyLongTermDiscount ? 
                        '<i class="fas fa-check-circle"></i> Applying 50% discount to assets held for more than 1 year (tax-optimized view)' : 
                        '<i class="fas fa-info-circle"></i> Showing full capital gains without discount (performance analysis view)'
                    }
                </div>
            </div>
            
            <!-- Summary Section -->
            <div class="cg-summary" style="margin-bottom: 20px; padding: 15px; background: rgba(34, 197, 94, 0.1); border-radius: 10px; text-align: center;">
                <div style="font-size: 1.1rem; color: #166534; font-weight: 600;">
                    <i class="fas fa-receipt"></i> Total Realized Capital Gains: 
                    <span class="${totalCapitalGains >= 0 ? 'positive' : 'negative'}" style="font-size: 1.3rem;">
                        ${this.formatCurrency(totalCapitalGains)}
                    </span>
                </div>
                <div style="font-size: 0.85rem; color: #16a34a; margin-top: 5px; font-style: italic;">
                    <strong>Tax-Accurate FIFO Calculation:</strong> This calculation uses proper First-In-First-Out methodology for tax reporting. Use this figure for ATO tax declarations
                </div>
            </div>
            
            <!-- View Toggle Buttons -->
            <div class="cg-view-toggle" style="margin-bottom: 20px; text-align: center;">
                <div style="display: inline-flex; background: #f1f5f9; border-radius: 8px; padding: 4px;">
                    <button class="cg-toggle-btn ${this.capitalGainsViewMode === 'by-symbol' ? 'active' : ''}" 
                            onclick="portfolioTracker.toggleCapitalGainsView('by-symbol')"
                            style="padding: 8px 16px; border: none; background: ${this.capitalGainsViewMode === 'by-symbol' ? '#4c51bf' : 'transparent'}; color: ${this.capitalGainsViewMode === 'by-symbol' ? 'white' : '#64748b'}; border-radius: 6px; cursor: pointer; transition: all 0.2s; font-weight: 500;">
                        <i class="fas fa-list"></i> By Symbol
                    </button>
                    <button class="cg-toggle-btn ${this.capitalGainsViewMode === 'by-underlying' ? 'active' : ''}" 
                            onclick="portfolioTracker.toggleCapitalGainsView('by-underlying')"
                            style="padding: 8px 16px; border: none; background: ${this.capitalGainsViewMode === 'by-underlying' ? '#4c51bf' : 'transparent'}; color: ${this.capitalGainsViewMode === 'by-underlying' ? 'white' : '#64748b'}; border-radius: 6px; cursor: pointer; transition: all 0.2s; font-weight: 500;">
                        <i class="fas fa-layer-group"></i> By Underlying
                    </button>
                </div>
                <div style="font-size: 0.8rem; color: #64748b; margin-top: 8px;">
                    ${this.capitalGainsViewMode === 'by-symbol' ? 'Individual symbols and option contracts' : 'Grouped by underlying stock symbol'}
                </div>
            </div>
        `;
        
        // Render appropriate view content
        const viewContent = this.capitalGainsViewMode === 'by-symbol' ? 
            this.renderCapitalGainsBySymbol() : 
            this.renderCapitalGainsByUnderlying();
            
        capitalGainsContainer.innerHTML = headerHtml + viewContent;
        
        // Set up the financial year dropdown after rendering
        this.setupFinancialYearDropdown();
        
        // Re-attach the financial year selector event listener
        const financialYearSelect = document.getElementById('financialYearSelect');
        if (financialYearSelect) {
            financialYearSelect.addEventListener('change', (e) => {
                this.selectedFinancialYear = e.target.value ? parseInt(e.target.value) : null;
                this.loadCapitalGains();
            });
        }
        
        // Add toggle functionality for collapsible groups
        this.attachCapitalGainsToggleHandlers();
    }

    toggleCapitalGainsView(mode) {
        this.capitalGainsViewMode = mode;
        this.renderCapitalGains();
    }

    renderCapitalGainsBySymbol() {
        // Group capital gains by symbol (original logic)
        const symbolGroups = this.capitalGains.reduce((acc, gain) => {
            const symbol = gain.symbol;
            if (!acc[symbol]) {
                acc[symbol] = {
                    symbol: symbol,
                    isOption: gain.isOption,
                    optionsInfo: gain.optionsInfo,
                    trades: [],
                    totalGain: 0,
                    totalProceeds: 0,
                    totalCostBasis: 0,
                    totalQty: 0
                };
            }
            
            acc[symbol].trades.push(gain);
            const cgData = this.calculateDiscountedCapitalGain(gain);
            acc[symbol].totalGain += cgData.discountedGain;
            acc[symbol].totalProceeds += gain.proceeds;
            acc[symbol].totalCostBasis += gain.costBasis;
            acc[symbol].totalQty += gain.qty;
            
            return acc;
        }, {});

        // Sort groups by total gain (winners first)
        const sortedGroups = Object.values(symbolGroups).sort((a, b) => b.totalGain - a.totalGain);

        return `
            <div class="capital-gains-grouped">
                ${sortedGroups.map(group => {
                    const optionsInfo = group.isOption ? group.optionsInfo : null;
                    const symbolDisplay = optionsInfo ? 
                        `${optionsInfo.underlying} ${new Date(optionsInfo.expiryDate).toLocaleDateString()} ${optionsInfo.optionType} $${optionsInfo.strikePrice}` :
                        group.symbol;
                    
                    const tradesHtml = group.trades
                        .sort((a, b) => new Date(b.sellDate) - new Date(a.sellDate))
                        .map(gain => {
                            const sellDate = new Date(gain.sellDate).toLocaleDateString();
                            const holdingPeriodText = gain.holdingPeriod >= 365 ? 
                                `${Math.floor(gain.holdingPeriod / 365)} years` : 
                                `${gain.holdingPeriod} days`;
                            
                            return `
                                <tr class="trade-detail">
                                    <td>${sellDate}</td>
                                    <td>${gain.qty.toFixed(0)}</td>
                                    <td>$${(gain.sellPrice || 0).toFixed(2)}</td>
                                    <td>${this.formatCurrency(gain.costBasis)}</td>
                                    <td>${this.formatCurrency(gain.proceeds)}</td>
                                    <td class="${gain.capitalGain >= 0 ? 'positive' : 'negative'}">
                                        ${this.formatCapitalGainCell(gain)}
                                    </td>
                                    <td>${holdingPeriodText}</td>
                                </tr>
                            `;
                        }).join('');
                    
                    return `
                        <div class="capital-gains-group">
                            <div class="group-header" data-toggle-group="${group.symbol}" style="cursor: pointer;">
                                <div class="group-header-left">
                                    <span class="chevron" data-chevron-for="${group.symbol}">▸</span>
                                    <div class="symbol-info">
                                        <strong class="symbol-name">${symbolDisplay}</strong>
                                        ${optionsInfo ? '<span class="option-badge">OPTION</span>' : '<span class="stock-badge">STOCK</span>'}
                                        <button class="view-trades-btn" onclick="event.stopPropagation(); portfolioTracker.viewTradesForSymbol('${group.symbol.replace(/'/g, "\\'")}')">
                                            <i class="fas fa-external-link-alt"></i> View trades
                                        </button>
                                    </div>
                                </div>
                                <div class="group-summary">
                                    <span class="summary-item">${group.trades.length} trade${group.trades.length > 1 ? 's' : ''}</span>
                                    <span class="summary-item">${group.totalQty.toFixed(0)} ${optionsInfo ? 'contracts' : 'shares'}</span>
                                    <span class="summary-item total-gain ${group.totalGain >= 0 ? 'positive' : 'negative'}">
                                        ${this.formatCurrency(group.totalGain)}
                                    </span>
                                </div>
                            </div>
                            <div class="group-body" data-group="${group.symbol}" style="display: none;">
                                <table class="trades-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Qty</th>
                                            <th>Price</th>
                                            <th>Cost Basis</th>
                                            <th>Proceeds</th>
                                            <th>Gain/Loss</th>
                                            <th>Holding Period</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${tradesHtml}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    renderCapitalGainsByUnderlying() {
        // Group capital gains by underlying symbol
        const underlyingGroups = this.capitalGains.reduce((acc, gain) => {
            const underlying = gain.isOption && gain.optionsInfo ? 
                gain.optionsInfo.underlying : gain.symbol;
                
            if (!acc[underlying]) {
                acc[underlying] = {
                    underlying: underlying,
                    symbols: {},
                    totalGain: 0,
                    totalProceeds: 0,
                    totalCostBasis: 0,
                    totalQty: 0,
                    totalTrades: 0
                };
            }
            
            // Group by symbol within underlying
            const symbol = gain.symbol;
            if (!acc[underlying].symbols[symbol]) {
                acc[underlying].symbols[symbol] = {
                    symbol: symbol,
                    isOption: gain.isOption,
                    optionsInfo: gain.optionsInfo,
                    trades: [],
                    totalGain: 0,
                    totalProceeds: 0,
                    totalCostBasis: 0,
                    totalQty: 0
                };
            }
            
            acc[underlying].symbols[symbol].trades.push(gain);
            const cgData = this.calculateDiscountedCapitalGain(gain);
            acc[underlying].symbols[symbol].totalGain += cgData.discountedGain;
            acc[underlying].symbols[symbol].totalProceeds += gain.proceeds;
            acc[underlying].symbols[symbol].totalCostBasis += gain.costBasis;
            acc[underlying].symbols[symbol].totalQty += gain.qty;
            
            acc[underlying].totalGain += cgData.discountedGain;
            acc[underlying].totalProceeds += gain.proceeds;
            acc[underlying].totalCostBasis += gain.costBasis;
            acc[underlying].totalQty += gain.qty;
            acc[underlying].totalTrades += 1;
            
            return acc;
        }, {});

        // Sort groups by total gain (winners first)
        const sortedUnderlyingGroups = Object.values(underlyingGroups).sort((a, b) => b.totalGain - a.totalGain);

        return `
            <div class="capital-gains-by-underlying">
                ${sortedUnderlyingGroups.map(underlyingGroup => {
                    const sortedSymbols = Object.values(underlyingGroup.symbols).sort((a, b) => b.totalGain - a.totalGain);
                    
                    const symbolsHtml = sortedSymbols.map(symbolGroup => {
                        const optionsInfo = symbolGroup.isOption ? symbolGroup.optionsInfo : null;
                        const symbolDisplay = optionsInfo ? 
                            `${optionsInfo.underlying} ${new Date(optionsInfo.expiryDate).toLocaleDateString()} ${optionsInfo.optionType} $${optionsInfo.strikePrice}` :
                            symbolGroup.symbol;
                        
                        const tradesHtml = symbolGroup.trades
                            .sort((a, b) => new Date(b.sellDate) - new Date(a.sellDate))
                            .map(gain => {
                                const sellDate = new Date(gain.sellDate).toLocaleDateString();
                                const holdingPeriodText = gain.holdingPeriod >= 365 ? 
                                    `${Math.floor(gain.holdingPeriod / 365)} years` : 
                                    `${gain.holdingPeriod} days`;
                                
                                return `
                                    <tr class="trade-detail">
                                        <td>${sellDate}</td>
                                        <td>${gain.qty.toFixed(0)}</td>
                                        <td>$${(gain.sellPrice || 0).toFixed(2)}</td>
                                        <td>${this.formatCurrency(gain.costBasis)}</td>
                                        <td>${this.formatCurrency(gain.proceeds)}</td>
                                        <td class="${gain.capitalGain >= 0 ? 'positive' : 'negative'}">
                                            ${this.formatCapitalGainCell(gain)}
                                        </td>
                                        <td>${holdingPeriodText}</td>
                                    </tr>
                                `;
                            }).join('');
                        
                        return `
                            <div class="symbol-subgroup" style="margin-left: 20px; margin-bottom: 15px;">
                                <div class="symbol-header" data-toggle-symbol="${symbolGroup.symbol}" style="cursor: pointer; padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 5px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <div style="display: flex; gap: 8px; align-items: center;">
                                            <span class="symbol-chevron" data-symbol-chevron-for="${symbolGroup.symbol}">▸</span>
                                            <strong>${symbolDisplay}</strong>
                                            ${optionsInfo ? '<span class="option-badge">OPTION</span>' : '<span class="stock-badge">STOCK</span>'}
                                            <button class="view-trades-btn" onclick="event.stopPropagation(); portfolioTracker.viewTradesForSymbol('${symbolGroup.symbol.replace(/'/g, "\\'")}')">
                                                <i class="fas fa-external-link-alt"></i> View trades
                                            </button>
                                        </div>
                                        <div style="display: flex; gap: 12px; font-size: 0.85rem;">
                                            <span>${symbolGroup.trades.length} trade${symbolGroup.trades.length > 1 ? 's' : ''}</span>
                                            <span class="${symbolGroup.totalGain >= 0 ? 'positive' : 'negative'}" style="font-weight: 600;">
                                                ${this.formatCurrency(symbolGroup.totalGain)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div class="symbol-body" data-symbol-group="${symbolGroup.symbol}" style="display: none;">
                                    <table class="trades-table">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Qty</th>
                                                <th>Price</th>
                                                <th>Cost Basis</th>
                                                <th>Proceeds</th>
                                                <th>Gain/Loss</th>
                                                <th>Holding Period</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${tradesHtml}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        `;
                    }).join('');
                    
                    return `
                        <div class="underlying-group" style="margin-bottom: 25px;">
                            <div class="underlying-header" data-toggle-underlying="${underlyingGroup.underlying}" style="cursor: pointer; padding: 12px 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; margin-bottom: 10px;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div style="display: flex; gap: 12px; align-items: center;">
                                        <span class="underlying-chevron" data-underlying-chevron-for="${underlyingGroup.underlying}" style="font-size: 1.2rem;">▸</span>
                                        <div>
                                            <h4 style="margin: 0; font-size: 1.1rem; font-weight: 600;">
                                                ${underlyingGroup.underlying}
                                            </h4>
                                            <div style="font-size: 0.8rem; opacity: 0.9;">${Object.keys(underlyingGroup.symbols).length} symbol${Object.keys(underlyingGroup.symbols).length > 1 ? 's' : ''}</div>
                                        </div>
                                        <button class="view-trades-btn" onclick="event.stopPropagation(); portfolioTracker.viewTradesForUnderlying('${underlyingGroup.underlying}')" title="View all trades for ${underlyingGroup.underlying}" style="background: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.3); color: white; padding: 6px 12px;">
                                            <i class="fas fa-external-link-alt"></i> View trades
                                        </button>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="font-size: 1.2rem; font-weight: 700;" class="${underlyingGroup.totalGain >= 0 ? 'positive' : 'negative'}">
                                            ${this.formatCurrency(underlyingGroup.totalGain)}
                                        </div>
                                        <div style="font-size: 0.8rem; opacity: 0.9;">
                                            ${underlyingGroup.totalTrades} trade${underlyingGroup.totalTrades > 1 ? 's' : ''}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="underlying-body" data-underlying-group="${underlyingGroup.underlying}" style="display: none; margin-left: 5px;">
                                ${symbolsHtml}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    attachCapitalGainsToggleHandlers() {
        // Handle underlying group toggles
        document.querySelectorAll('[data-toggle-underlying]').forEach(header => {
            header.addEventListener('click', () => {
                const underlyingKey = header.getAttribute('data-toggle-underlying');
                const body = document.querySelector(`.underlying-body[data-underlying-group="${underlyingKey}"]`);
                const chevron = document.querySelector(`.underlying-chevron[data-underlying-chevron-for="${underlyingKey}"]`);
                
                if (body) {
                    const isOpen = body.style.display !== 'none';
                    body.style.display = isOpen ? 'none' : 'block';
                    if (chevron) {
                        chevron.textContent = isOpen ? '▸' : '▾';
                    }
                }
            });
        });

        // Handle symbol group toggles
        document.querySelectorAll('[data-toggle-symbol]').forEach(header => {
            header.addEventListener('click', () => {
                const symbolKey = header.getAttribute('data-toggle-symbol');
                const body = document.querySelector(`.symbol-body[data-symbol-group="${symbolKey}"]`);
                const chevron = document.querySelector(`.symbol-chevron[data-symbol-chevron-for="${symbolKey}"]`);
                
                if (body) {
                    const isOpen = body.style.display !== 'none';
                    body.style.display = isOpen ? 'none' : 'block';
                    if (chevron) {
                        chevron.textContent = isOpen ? '▸' : '▾';
                    }
                }
            });
        });

        // Handle original symbol group toggles (for by-symbol view)
        document.querySelectorAll('[data-toggle-group]').forEach(header => {
            header.addEventListener('click', () => {
                const groupKey = header.getAttribute('data-toggle-group');
                const body = document.querySelector(`.group-body[data-group="${groupKey}"]`);
                const chevron = document.querySelector(`.chevron[data-chevron-for="${groupKey}"]`);
                
                if (body) {
                    const isOpen = body.style.display !== 'none';
                    body.style.display = isOpen ? 'none' : 'block';
                    if (chevron) {
                        chevron.textContent = isOpen ? '▸' : '▾';
                    }
                }
            });
        });
    }

    parseOptionsSymbol(symbol) {
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
                expiryDate: expiryDate.toISOString(), // Convert to ISO string for consistency
                optionType: optionType === 'C' ? 'Call' : 'Put',
                strikePrice,
                isExpired: expiryDate < new Date()
            };
        }
        
        return null;
    }

    formatCurrency(amount) {
        if (typeof amount !== 'number') return this.currentCurrency === 'AUD' ? 'A$0.00' : '$0.00';
        
        const formatted = Math.abs(amount).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        
        const sign = amount < 0 ? '-' : '';
        const currencySymbol = this.currentCurrency === 'AUD' ? 'A$' : '$';
        
        return `${sign}${currencySymbol}${formatted}`;
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            background: #fee2e2;
            color: #dc2626;
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            text-align: center;
            font-weight: 500;
        `;
        
        const container = document.querySelector('.main-content');
        container.insertBefore(errorDiv, container.firstChild);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    async loadPerformanceData() {
        const timeframe = document.getElementById('performanceTimeframe')?.value || 'all';
        const metric = document.getElementById('performanceMetric')?.value || 'cumulative';
        
        try {
            this.performanceData = await window.electronAPI.getPerformanceData({
                timeframe: timeframe,
                metric: metric,
                currency: this.currentCurrency
            });
            this.renderPerformanceChart();
            this.updatePerformanceSummary();
        } catch (error) {
            console.error('Error loading performance data:', error);
        }
    }

    renderPerformance() {
        const timeframeSelect = document.getElementById('performanceTimeframe');
        const metricSelect = document.getElementById('performanceMetric');
        
        if (timeframeSelect && !timeframeSelect.hasAttribute('data-listener-added')) {
            timeframeSelect.addEventListener('change', () => this.loadPerformanceData());
            timeframeSelect.setAttribute('data-listener-added', 'true');
        }
        
        if (metricSelect && !metricSelect.hasAttribute('data-listener-added')) {
            metricSelect.addEventListener('change', () => this.loadPerformanceData());
            metricSelect.setAttribute('data-listener-added', 'true');
        }

        if (!this.performanceData) {
            this.loadPerformanceData();
        } else {
            this.renderPerformanceChart();
            this.updatePerformanceSummary();
        }
    }

    updatePerformanceSummary() {
        if (!this.performanceData?.summary) return;
        const summary = this.performanceData.summary;
        
        document.getElementById('totalReturn').textContent = this.formatCurrency(summary.totalPnL);
        document.getElementById('totalReturn').className = `stat-value ${summary.totalPnL >= 0 ? 'positive' : 'negative'}`;
        
        if (summary.bestMonth) {
            document.getElementById('bestMonth').textContent = this.formatCurrency(summary.bestMonth.amount);
            document.getElementById('bestMonthPeriod').textContent = summary.bestMonth.period;
        }
        
        if (summary.worstMonth) {
            document.getElementById('worstMonth').textContent = this.formatCurrency(summary.worstMonth.amount);
            document.getElementById('worstMonthPeriod').textContent = summary.worstMonth.period;
        }
        
        document.getElementById('winRate').textContent = `${summary.winRate.toFixed(1)}%`;
        document.getElementById('winRateDetail').textContent = `${Math.round(summary.winRate * summary.totalTrades / 100)}/${summary.totalTrades} trades`;
    }

    renderPerformanceChart() {
        if (!this.performanceData?.chartData) return;
        const ctx = document.getElementById('performanceChart').getContext('2d');
        const chartData = this.performanceData.chartData;
        const metric = document.getElementById('performanceMetric')?.value || 'cumulative';

        if (this.performanceChart) {
            this.performanceChart.destroy();
        }

        const labels = chartData.map(d => d.displayLabel || d.period || d.month);
        const dataValues = metric === 'cumulative' ? chartData.map(d => d.cumulativePnL) : chartData.map(d => d.totalPnL);
        const chartType = metric === 'cumulative' ? 'line' : 'bar';
        const tension = metric === 'cumulative' ? 0.4 : 0;
        const fill = metric === 'cumulative' ? true : false;
        
        let backgroundColor, borderColor;
        if (metric === 'monthly') {
            backgroundColor = dataValues.map(value => value >= 0 ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)');
            borderColor = dataValues.map(value => value >= 0 ? 'rgba(16, 185, 129, 1)' : 'rgba(239, 68, 68, 1)');
        } else {
            backgroundColor = 'rgba(59, 130, 246, 0.1)';
            borderColor = '#3b82f6';
        }

        this.performanceChart = new Chart(ctx, {
            type: chartType,
            data: {
                labels: labels,
                datasets: [{
                    label: metric === 'cumulative' ? 'Cumulative P&L' : 'Monthly P&L',
                    data: dataValues,
                    borderColor: borderColor,
                    backgroundColor: backgroundColor,
                    borderWidth: 2,
                    fill: fill,
                    tension: tension,
                    ...(metric === 'monthly' && { borderRadius: 4, borderSkipped: false })
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: metric !== 'cumulative',
                        ticks: { callback: function(value) { return '$' + value.toLocaleString(); } },
                        grid: { color: 'rgba(0, 0, 0, 0.1)', drawBorder: false }
                    },
                    x: { 
                        ticks: { maxTicksLimit: 12 },
                        grid: { display: metric === 'cumulative', color: 'rgba(0, 0, 0, 0.1)', drawBorder: false }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: { 
                            label: function(context) { 
                                const value = context.parsed.y;
                                const sign = value >= 0 ? '+' : '';
                                return context.dataset.label + ': ' + sign + '$' + Math.abs(value).toLocaleString(); 
                            }
                        }
                    },
                    legend: { display: true, position: 'top', labels: { usePointStyle: metric === 'cumulative' } }
                },
                ...(metric === 'cumulative' && {
                    elements: {
                        point: { radius: 4, hoverRadius: 6, backgroundColor: '#3b82f6', borderColor: '#ffffff', borderWidth: 2 }
                    }
                })
            }
        });
    }

    viewTradesForSymbol(symbol) {
        // Set the symbol filter for exact match
        this.tradeFilters = {
            symbol: symbol,
            exactSymbol: true,
            expiry: '',
            strikePrice: '',
            optionType: ''
        };
        this.currentPage = 1;
        
        // Switch to All Trades tab
        this.switchTab('trades');
    }

    viewTradesForUnderlying(underlying) {
        // Set the underlying filter for partial match (to catch all options for this underlying)
        this.tradeFilters = {
            symbol: underlying,
            exactSymbol: false, // Use partial match to get all options with this underlying
            expiry: '',
            strikePrice: '',
            optionType: ''
        };
        this.currentPage = 1;
        
        // Switch to All Trades tab
        this.switchTab('trades');
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.portfolioTracker = new PortfolioTracker();
});
