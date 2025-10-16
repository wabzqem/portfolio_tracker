#!/usr/bin/env python3
"""
Test Trade Generator for Portfolio Tracker

Generates realistic trading data over the past 5 years following these rules:
- No short selling (sells always follow buys)
- Options and stocks with realistic ratios
- Mix of ASX (AUD) and US (USD) markets
- 10-20 trades per month
- Some options expire without selling
- Realistic fees and commissions
"""

import csv
import random
import datetime
from typing import List, Dict, Tuple
import json

class TradeGenerator:
    def __init__(self):
        # US Stocks (major tech and popular trading stocks)
        self.us_stocks = [
            'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX',
            'AMD', 'INTC', 'BABA', 'PLTR', 'SOFI', 'COIN', 'ROKU', 'SQ',
            'PYPL', 'UBER', 'LYFT', 'SNOW', 'CRM', 'ORCL', 'ADBE', 'NOW',
            'SHOP', 'SPOT', 'ZM', 'DOCU', 'CRWD', 'OKTA', 'DDOG', 'MDB'
        ]
        
        # ASX Stocks (major Australian companies)
        self.asx_stocks = [
            'CBA', 'BHP', 'CSL', 'WBC', 'ANZ', 'NAB', 'WES', 'MQG', 'RIO', 'TLS',
            'COL', 'TCL', 'WOW', 'FMG', 'SYD', 'REA', 'QBE', 'IAG', 'AMP', 'ORG',
            'S32', 'WPL', 'ALL', 'GMG', 'JHX', 'CPU', 'XRO', 'APT', 'ZIP', 'LYC'
        ]
        
        # Track positions to ensure no short selling
        self.positions = {}  # symbol -> quantity
        
        # Track options for expiry logic
        self.options_positions = {}  # option_symbol -> {qty, expiry_date, strike, type}
        
        # Track purchase prices for profit/loss calculation
        self.purchase_history = {}  # symbol -> [(qty, price, date), ...]
        
        # Store generated trades
        self.trades = []
        
        # Current date for generation
        self.current_date = datetime.datetime.now() - datetime.timedelta(days=5*365)
        self.end_date = datetime.datetime.now()
        
    def generate_option_symbol(self, underlying: str, expiry_date: datetime.datetime, 
                             option_type: str, strike_price: float) -> str:
        """Generate option symbol in format: UNDERLYING+YYMMDD+C/P+STRIKE*1000"""
        expiry_str = expiry_date.strftime('%y%m%d')
        type_char = 'C' if option_type == 'Call' else 'P'
        strike_int = int(strike_price * 1000)  # Convert to cents/thousands
        return f"{underlying}{expiry_str}{type_char}{strike_int}"
    
    def get_option_expiry_dates(self, base_date: datetime.datetime) -> List[datetime.datetime]:
        """Get realistic option expiry dates (monthly, weekly for popular stocks)"""
        expiries = []
        
        # Monthly expiries (3rd Friday of each month)
        for month_offset in range(1, 13):  # Up to 12 months out
            target_month = base_date.replace(day=1) + datetime.timedelta(days=32*month_offset)
            target_month = target_month.replace(day=1)
            
            # Find 3rd Friday
            first_day_weekday = target_month.weekday()
            first_friday = 1 + (4 - first_day_weekday) % 7
            third_friday = first_friday + 14
            
            try:
                expiry = target_month.replace(day=third_friday)
                if expiry > base_date:
                    expiries.append(expiry)
            except ValueError:
                # Handle month with fewer days
                continue
        
        return expiries[:6]  # Return next 6 expiries
    
    def get_realistic_stock_price(self, symbol: str, date: datetime.datetime) -> float:
        """Generate realistic stock prices with proper evolution over time"""
        # Create a base price for each symbol that's consistent
        symbol_hash = hash(symbol) % 10000
        
        # Base prices for different symbols (consistent across time)
        if symbol in ['AAPL', 'MSFT', 'GOOGL', 'AMZN']:
            base_price = 150 + (symbol_hash % 200)  # $150-350
        elif symbol in ['TSLA', 'NVDA', 'META', 'NFLX']:
            base_price = 100 + (symbol_hash % 150)  # $100-250
        elif symbol in ['AMD', 'INTC', 'PLTR', 'SOFI']:
            base_price = 20 + (symbol_hash % 80)    # $20-100
        elif symbol in ['CBA', 'BHP', 'CSL', 'WBC']:
            base_price = 50 + (symbol_hash % 100)   # $50-150 ASX major
        else:
            base_price = 10 + (symbol_hash % 40)    # $10-50
        
        # Add time-based evolution (general upward trend over 5 years)
        days_since_start = (date - self.current_date).days
        total_days = (self.end_date - self.current_date).days
        time_progression = days_since_start / total_days
        
        # 30% growth over 5 years with some volatility
        growth_factor = 1.0 + (time_progression * 0.3)
        
        # Add daily volatility (but keep it reasonable)
        daily_seed = hash(symbol + date.strftime('%Y%m%d')) % 1000
        daily_volatility = 0.95 + (daily_seed / 1000) * 0.1  # ±5% daily variation
        
        price = base_price * growth_factor * daily_volatility
        return round(price, 2)
    
    def get_option_strike_prices(self, stock_price: float) -> List[float]:
        """Generate realistic option strike prices around current stock price"""
        strikes = []
        
        # ATM and nearby strikes
        base_strike = round(stock_price / 5) * 5  # Round to nearest $5
        
        for offset in [-20, -15, -10, -5, 0, 5, 10, 15, 20]:
            strike = base_strike + offset
            if strike > 0:
                strikes.append(float(strike))
        
        return strikes
    
    def generate_us_fees(self, is_option: bool, quantity: int) -> Dict[str, float]:
        """Generate realistic US trading fees"""
        if is_option:
            commission = round(0.1 * quantity, 2)  # $0.10 per contract
            platform_fees = round(0.4 * quantity, 2)  # $0.40 per contract
            options_reg_fees = round(0.015 * quantity, 2)
            occ_fees = round(0.02 * quantity, 2)
            trading_activity_fee = 0.01
            total = commission + platform_fees + options_reg_fees + occ_fees + trading_activity_fee
        else:
            # Stock fees
            commission = 0.0  # Many brokers have $0 stock commissions now
            platform_fees = 0.0
            settlement_fee = random.choice([0.0, 0.39])  # Sometimes charged
            trading_activity_fee = 0.0
            total = settlement_fee
        
        return {
            'Commission': commission,
            'Platform Fees': platform_fees,
            'Options Regulatory Fees': options_reg_fees if is_option else 0.0,
            'OCC Fees': occ_fees if is_option else 0.0,
            'Settlement Fee': settlement_fee if not is_option else 0.0,
            'Trading Activity Fee': trading_activity_fee,
            'Total': round(total, 2)
        }
    
    def generate_asx_fees(self, amount: float) -> Dict[str, float]:
        """Generate realistic ASX trading fees"""
        # ASX typically charges percentage-based brokerage
        commission = max(9.50, amount * 0.001)  # Min $9.50 or 0.1%
        settlement_fee = 1.82  # Typical ASX settlement fee
        clearing_fee = round(amount * 0.0002, 2)  # Clearing fee
        
        total = commission + settlement_fee + clearing_fee
        
        return {
            'Commission': round(commission, 2),
            'Platform Fees': 0.0,
            'Options Regulatory Fees': 0.0,
            'OCC Fees': 0.0,
            'Settlement Fee': settlement_fee,
            'Trading Activity Fee': 0.0,
            'Total': round(total, 2)
        }
    
    def add_trade(self, side: str, symbol: str, name: str, quantity: int, 
                  price: float, trade_time: datetime.datetime, market: str, 
                  currency: str, is_option: bool = False):
        """Add a trade to the list"""
        
        amount = quantity * price
        
        # Generate fees based on market
        if market == 'US':
            fees = self.generate_us_fees(is_option, quantity)
        else:  # ASX
            fees = self.generate_asx_fees(amount)
        
        # Format times with proper timezone
        if market == 'US':
            time_str = trade_time.strftime('%b %d, %Y %H:%M:%S ET')
        else:
            time_str = trade_time.strftime('%b %d, %Y %H:%M:%S AEST')
        
        trade = {
            'Side': side,
            'Symbol': symbol,
            'Name': name,
            'Order Price': f"{price:.2f}",
            'Order Qty': str(quantity),
            'Order Amount': f"{amount:,.2f}",
            'Status': 'Filled',
            'Filled@Avg Price': f"{quantity}@{price:.2f}",
            'Order Time': time_str,
            'Order Type': 'Limit',
            'Time-in-Force': 'Day',
            'Allow Pre-Market': '',
            'Session': 'RTH + Pre/Post-Mkt' if random.random() < 0.1 else '',
            'Trigger price': '',
            'Position Opening': '',
            'Markets': market,
            'Currency': currency,
            'Order Source': '',
            'Fill Qty': str(quantity),
            'Fill Price': f"{price:.2f}",
            'Fill Amount': f"{amount:,.2f}",
            'Fill Time': time_str,
            'Markets.1': market,
            'Currency.1': currency,
            'Counterparty': '',
            'Remarks': '',
            'Commission': f"{fees['Commission']:.2f}" if fees['Commission'] > 0 else '',
            'Platform Fees': f"{fees['Platform Fees']:.2f}" if fees['Platform Fees'] > 0 else '',
            'Options Regulatory Fees': f"{fees['Options Regulatory Fees']:.2f}" if fees['Options Regulatory Fees'] > 0 else '',
            'OCC Fees': f"{fees['OCC Fees']:.2f}" if fees['OCC Fees'] > 0 else '',
            'Platform Fee': '',
            'Settlement Fee': f"{fees['Settlement Fee']:.2f}" if fees['Settlement Fee'] > 0 else '',
            'Trading Activity Fee': f"{fees['Trading Activity Fee']:.2f}" if fees['Trading Activity Fee'] > 0 else '',
            'Trading Activity Fees': '',
            'Consolidated Audit Trail': f"{fees['Total']:.2f}",
            '': '',
            '.1': ''
        }
        
        self.trades.append(trade)
        
        # Update positions
        position_key = symbol
        if side == 'Buy':
            self.positions[position_key] = self.positions.get(position_key, 0) + quantity
            # Track purchase for profit calculation
            if position_key not in self.purchase_history:
                self.purchase_history[position_key] = []
            self.purchase_history[position_key].append((quantity, price, trade_time))
        else:  # Sell
            self.positions[position_key] = self.positions.get(position_key, 0) - quantity
    
    def can_sell(self, symbol: str, quantity: int) -> bool:
        """Check if we can sell the given quantity (no short selling)"""
        current_position = self.positions.get(symbol, 0)
        return current_position >= quantity
    
    def get_average_purchase_price(self, symbol: str) -> float:
        """Get average purchase price for a symbol"""
        if symbol not in self.purchase_history:
            return 0.0
        
        total_cost = 0.0
        total_qty = 0
        
        for qty, price, _ in self.purchase_history[symbol]:
            total_cost += qty * price
            total_qty += qty
        
        return total_cost / total_qty if total_qty > 0 else 0.0
    
    def calculate_profitable_sell_price(self, symbol: str, target_win_rate: float = 0.6) -> float:
        """Calculate a sell price that gives us the desired win rate"""
        avg_cost = self.get_average_purchase_price(symbol)
        if avg_cost == 0:
            return 0.0
        
        # 60% chance of winning trade
        if random.random() < target_win_rate:
            # Winning trade: 10-50% gain
            gain_multiplier = random.uniform(1.10, 1.50)
            return avg_cost * gain_multiplier
        else:
            # Losing trade: 5-15% loss (smaller losses)
            loss_multiplier = random.uniform(0.85, 0.95)
            return avg_cost * loss_multiplier
    
    def generate_monthly_trades(self, month_start: datetime.datetime):
        """Generate 10-20 trades for a given month"""
        trades_this_month = random.randint(10, 20)
        
        for _ in range(trades_this_month):
            # Randomize trade time within the month
            days_in_month = (month_start.replace(month=month_start.month+1) - month_start).days if month_start.month < 12 else 31
            random_day = random.randint(0, min(days_in_month-1, 30))
            random_hour = random.randint(9, 16)  # Trading hours
            random_minute = random.randint(0, 59)
            random_second = random.randint(0, 59)
            
            trade_time = month_start + datetime.timedelta(
                days=random_day, 
                hours=random_hour, 
                minutes=random_minute, 
                seconds=random_second
            )
            
            # Skip weekends
            if trade_time.weekday() >= 5:
                continue
                
            # Decide market (70% US, 30% ASX)
            is_us_market = random.random() < 0.7
            
            if is_us_market:
                self.generate_us_trade(trade_time)
            else:
                self.generate_asx_trade(trade_time)
    
    def generate_us_trade(self, trade_time: datetime.datetime):
        """Generate a US market trade (stock or option)"""
        # 85% stocks, 15% options (drastically reduce option frequency)
        is_option = random.random() < 0.15
        
        if is_option:
            self.generate_us_option_trade(trade_time)
        else:
            self.generate_us_stock_trade(trade_time)
    
    def generate_us_stock_trade(self, trade_time: datetime.datetime):
        """Generate a US stock trade"""
        symbol = random.choice(self.us_stocks)
        
        # Decide buy or sell (70% buy, 30% sell if we have position AND purchase history)
        can_sell_stock = self.can_sell(symbol, 1) and symbol in self.purchase_history
        if can_sell_stock and random.random() < 0.3:
            # Sell some shares with profitable pricing
            max_sellable = self.positions.get(symbol, 0)
            quantity = random.randint(1, min(max_sellable, 500))
            side = 'Sell'
            
            # Use profitable sell price (we know we have purchase history)
            price = self.calculate_profitable_sell_price(symbol)
        else:
            # Buy shares
            quantity = random.choice([50, 100, 150, 200, 250, 300, 500])
            side = 'Buy'
            price = self.get_realistic_stock_price(symbol, trade_time)
        
        # Add small price variation for fills
        fill_price = price * random.uniform(0.99, 1.01)
        
        self.add_trade(
            side=side,
            symbol=symbol,
            name=symbol,  # Simplified name
            quantity=quantity,
            price=round(fill_price, 2),
            trade_time=trade_time,
            market='US',
            currency='USD',
            is_option=False
        )
    
    def generate_us_option_trade(self, trade_time: datetime.datetime):
        """Generate a US option trade"""
        underlying = random.choice(self.us_stocks[:20])  # Use more popular stocks for options
        stock_price = self.get_realistic_stock_price(underlying, trade_time)
        
        # Get expiry dates
        expiry_dates = self.get_option_expiry_dates(trade_time)
        if not expiry_dates:
            return
            
        expiry = random.choice(expiry_dates[:3])  # Use nearer expiries
        option_type = random.choice(['Call', 'Put'])
        strikes = self.get_option_strike_prices(stock_price)
        strike = random.choice(strikes)
        
        option_symbol = self.generate_option_symbol(underlying, expiry, option_type, strike)
        option_name = f"{underlying} {expiry.strftime('%y%m%d')} {strike:.2f}{option_type[0]}"
        
        # Option pricing (much more realistic and lower)
        time_to_expiry = (expiry - trade_time).days / 365.0
        intrinsic = max(0, stock_price - strike) if option_type == 'Call' else max(0, strike - stock_price)
        
        # Much smaller time value - options are typically $0.50-$5.00, not $10-50
        time_value = stock_price * 0.02 * (time_to_expiry ** 0.5)  # Much lower time value
        option_price = intrinsic + time_value
        
        # Realistic option price ranges: $0.05 to $8.00 typically
        option_price = max(0.05, min(option_price, 8.0))
        
        # Add some randomness to make it more realistic
        option_price *= random.uniform(0.3, 1.5)  # ±70% variation
        option_price = max(0.05, min(option_price, 10.0))  # Cap at $10
        
        # Decide buy or sell (only sell if we have position AND purchase history)
        # Higher chance to sell options to reduce expired worthless positions
        can_sell_option = self.can_sell(option_symbol, 1) and option_symbol in self.purchase_history
        
        # Calculate days to expiry to encourage selling before expiry
        days_to_expiry = (expiry - trade_time).days
        sell_probability = 0.7  # High base probability
        
        # EXTREMELY aggressively increase sell probability as expiry approaches
        if days_to_expiry < 3:   # Less than 3 days - almost guaranteed sell
            sell_probability = 0.98
        elif days_to_expiry < 7:   # Less than 1 week
            sell_probability = 0.95
        elif days_to_expiry < 14:  # Less than 2 weeks
            sell_probability = 0.9
        elif days_to_expiry < 30:  # Less than 1 month
            sell_probability = 0.8
        
        if can_sell_option and random.random() < sell_probability:
            # Sell some contracts with profitable pricing
            max_sellable = self.positions.get(option_symbol, 0)
            quantity = random.randint(1, min(max_sellable, 20))
            side = 'Sell'
            
            # Use profitable sell price for options (we know we have purchase history)
            option_price = self.calculate_profitable_sell_price(option_symbol)
        else:
            # Buy contracts
            quantity = random.choice([1, 2, 3, 4, 5, 10])
            side = 'Buy'
        
        self.add_trade(
            side=side,
            symbol=option_symbol,
            name=option_name,
            quantity=quantity,
            price=round(option_price, 2),
            trade_time=trade_time,
            market='US',
            currency='USD',
            is_option=True
        )
    
    def generate_asx_trade(self, trade_time: datetime.datetime):
        """Generate an ASX stock trade"""
        symbol = random.choice(self.asx_stocks)
        
        # ASX trades are typically in smaller quantities
        # Decide buy or sell (70% buy, 30% sell if we have position AND purchase history)
        can_sell_stock = self.can_sell(symbol, 1) and symbol in self.purchase_history
        if can_sell_stock and random.random() < 0.3:
            # Sell some shares with profitable pricing
            max_sellable = self.positions.get(symbol, 0)
            quantity = random.randint(1, min(max_sellable, 1000))
            side = 'Sell'
            
            # Use profitable sell price (we know we have purchase history)
            price = self.calculate_profitable_sell_price(symbol)
        else:
            # Buy shares
            quantity = random.choice([100, 200, 300, 500, 1000])
            side = 'Buy'
            price = self.get_realistic_stock_price(symbol, trade_time)
        
        # Add small price variation for fills
        fill_price = price * random.uniform(0.99, 1.01)
        
        self.add_trade(
            side=side,
            symbol=symbol,
            name=f"{symbol}",  # Simplified name for ASX
            quantity=quantity,
            price=round(fill_price, 2),
            trade_time=trade_time,
            market='AU',
            currency='AUD',
            is_option=False
        )
    
    def generate_all_trades(self):
        """Generate all trades over the 5-year period"""
        print("Generating test trades over 5-year period...")
        
        current = self.current_date
        
        while current < self.end_date:
            # Generate trades for this month
            print(f"Generating trades for {current.strftime('%Y-%m')}...")
            self.generate_monthly_trades(current)
            
            # Move to next month
            if current.month == 12:
                current = current.replace(year=current.year + 1, month=1)
            else:
                current = current.replace(month=current.month + 1)
        
        print(f"Generated {len(self.trades)} total trades")
        print(f"Final positions: {len([k for k, v in self.positions.items() if v > 0])} symbols held")
    
    def save_to_csv(self, filename: str):
        """Save trades to CSV file"""
        fieldnames = [
            'Side', 'Symbol', 'Name', 'Order Price', 'Order Qty', 'Order Amount',
            'Status', 'Filled@Avg Price', 'Order Time', 'Order Type', 'Time-in-Force',
            'Allow Pre-Market', 'Session', 'Trigger price', 'Position Opening',
            'Markets', 'Currency', 'Order Source', 'Fill Qty', 'Fill Price',
            'Fill Amount', 'Fill Time', 'Markets.1', 'Currency.1', 'Counterparty',
            'Remarks', 'Commission', 'Platform Fees', 'Options Regulatory Fees',
            'OCC Fees', 'Platform Fee', 'Settlement Fee', 'Trading Activity Fee',
            'Trading Activity Fees', 'Consolidated Audit Trail', '', '.1'
        ]
        
        with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames, quoting=csv.QUOTE_ALL)
            writer.writeheader()
            
            # Sort trades by time (newest first, like the original file)
            def parse_sort_date(trade):
                try:
                    date_str = trade['Fill Time']
                    # Remove timezone for parsing
                    clean_date = date_str.replace(' ET', '').replace(' AEST', '').replace(' AEDT', '')
                    return datetime.datetime.strptime(clean_date, '%b %d, %Y %H:%M:%S')
                except:
                    return datetime.datetime.min
            
            sorted_trades = sorted(self.trades, key=parse_sort_date, reverse=True)
            
            for trade in sorted_trades:
                writer.writerow(trade)
        
        print(f"Saved {len(self.trades)} trades to {filename}")

def main():
    """Generate test trades and save to CSV"""
    generator = TradeGenerator()
    generator.generate_all_trades()
    generator.save_to_csv('test-trades.csv')
    
    # Print some statistics
    print("\n=== Trade Statistics ===")
    print(f"Total trades: {len(generator.trades)}")
    
    us_trades = [t for t in generator.trades if t['Markets'] == 'US']
    asx_trades = [t for t in generator.trades if t['Markets'] == 'AU']
    
    print(f"US trades: {len(us_trades)} ({len(us_trades)/len(generator.trades)*100:.1f}%)")
    print(f"ASX trades: {len(asx_trades)} ({len(asx_trades)/len(generator.trades)*100:.1f}%)")
    
    option_trades = [t for t in generator.trades if len(t['Symbol']) > 10]  # Options have longer symbols
    stock_trades = [t for t in generator.trades if len(t['Symbol']) <= 10]
    
    print(f"Stock trades: {len(stock_trades)} ({len(stock_trades)/len(generator.trades)*100:.1f}%)")
    print(f"Option trades: {len(option_trades)} ({len(option_trades)/len(generator.trades)*100:.1f}%)")
    
    buy_trades = [t for t in generator.trades if t['Side'] == 'Buy']
    sell_trades = [t for t in generator.trades if t['Side'] == 'Sell']
    
    print(f"Buy trades: {len(buy_trades)} ({len(buy_trades)/len(generator.trades)*100:.1f}%)")
    print(f"Sell trades: {len(sell_trades)} ({len(sell_trades)/len(generator.trades)*100:.1f}%)")
    
    # Show positions with holdings
    held_positions = {k: v for k, v in generator.positions.items() if v > 0}
    print(f"\nFinal positions held: {len(held_positions)}")
    
    if held_positions:
        print("Sample holdings:")
        for symbol, qty in list(held_positions.items())[:10]:
            print(f"  {symbol}: {qty}")

if __name__ == "__main__":
    main()