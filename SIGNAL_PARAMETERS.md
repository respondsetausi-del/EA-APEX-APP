# Signal Parameters - How Trading Works

## Overview
This document explains exactly how signal parameters are mapped to trade execution.

---

## Signal Flow

```
Database Signal Arrives
    ↓
Signal Monitor Detects It
    ↓
Matches with Symbol Configuration
    ↓
Trading WebView Opens
    ↓
Proxy Receives Parameters
    ↓
Trading Script Executes
    ↓
Trade Placed with Exact Parameters
```

---

## Parameter Mapping

### 1. **Asset/Symbol** 
- **Source**: `signal.asset`
- **Example**: `"GBPUSD"`, `"XAUUSD"`, `"EURUSD"`
- **Used For**: 
  - Searching in symbol list
  - Selecting the correct trading instrument
- **Script Logs**: `"Asset: GBPUSD"`

### 2. **Action/Direction**
- **Source**: `signal.action` (can be overridden by `tradeConfig.direction`)
- **Values**: `"BUY"` or `"SELL"`
- **Logic**:
  ```javascript
  if (tradeConfig.direction === 'BUY') {
    action = 'BUY';  // Always buy
  } else if (tradeConfig.direction === 'SELL') {
    action = 'SELL';  // Always sell
  } else {
    action = signal.action;  // Follow signal
  }
  ```
- **Used For**: Clicking "Buy by Market" or "Sell by Market" button
- **Script Logs**: `"Action: BUY"`

### 3. **Volume/Lot Size**
- **Source**: `tradeConfig.lotSize`
- **Example**: `"0.01"`, `"0.1"`, `"1.0"`
- **Used For**: Setting the volume field in order dialog
- **Selectors Tried**:
  1. `.trade-input input[type="text"]` (RazorMarkets)
  2. `input[type="text"]` (Generic first input)
  3. `input[inputmode="decimal"]` (Numeric input)
- **Script Logs**: `"Volume: 0.01"`

### 4. **Stop Loss**
- **Source**: `signal.sl`
- **Example**: `"1.26000"`, `"0"`, `""`
- **Behavior**: 
  - If `sl === 0` or `sl === ""`: **SKIPPED** (no SL set)
  - Otherwise: Sets the SL field
- **Selectors Tried**:
  1. `.sl input[type="text"]` (RazorMarkets)
  2. `input[placeholder*="Stop"]`
  3. `input[placeholder*="stop"]`
  4. `input[placeholder*="S/L"]`
- **Script Logs**: 
  - `"Stop Loss: 1.26000"` (if set)
  - `"Skipping Stop Loss (value is 0 or empty)"` (if skipped)

### 5. **Take Profit**
- **Source**: `signal.tp`
- **Example**: `"1.28000"`, `"0"`, `""`
- **Behavior**: 
  - If `tp === 0` or `tp === ""`: **SKIPPED** (no TP set)
  - Otherwise: Sets the TP field
- **Selectors Tried**:
  1. `.tp input[type="text"]` (RazorMarkets)
  2. `input[placeholder*="Take"]`
  3. `input[placeholder*="take"]`
  4. `input[placeholder*="T/P"]`
- **Script Logs**: 
  - `"Take Profit: 1.28000"` (if set)
  - `"Skipping Take Profit (value is 0 or empty)"` (if skipped)

### 6. **Number of Trades**
- **Source**: `tradeConfig.numberOfTrades`
- **Example**: `"1"`, `"3"`, `"5"`
- **Used For**: Loop counter - executes the same trade N times
- **Validation**: Must be between 1 and 10
- **Script Logs**: `"Number of Trades: 5"`

### 7. **Bot Name/Comment**
- **Source**: `eaName` (from EA configuration)
- **Example**: `"ea striker"`, `"My EA"`
- **Used For**: Setting the comment field in order dialog
- **Selectors Tried**:
  1. `.input.svelte-mtorg2 input[type="text"]` (RazorMarkets)
  2. `.input.svelte-1d8k9kk input[type="text"]` (RazorMarkets)
  3. `input[placeholder*="Comment"]`
  4. `input[placeholder*="comment"]`
- **Script Logs**: `"Bot Name: ea striker"`

---

## Example Execution

### Signal Received:
```json
{
  "asset": "GBPUSD",
  "action": "BUY",
  "price": 1.27000,
  "tp": 1.28000,
  "sl": 1.26000
}
```

### Trade Configuration:
```json
{
  "symbol": "GBPUSD",
  "lotSize": "0.01",
  "platform": "MT5",
  "direction": "BOTH",
  "numberOfTrades": "5"
}
```

### EA Configuration:
```json
{
  "name": "ea striker"
}
```

### What Gets Executed:
```
=== MT5 TRADING PARAMETERS ===
Asset: GBPUSD
Action: BUY
Volume: 0.01
Stop Loss: 1.26000
Take Profit: 1.28000
Number of Trades: 5
Bot Name: ea striker
==============================

Trade 1 of 5:
  - Search for: GBPUSD
  - Select: GBPUSD
  - Open order dialog
  - Set Volume: 0.01
  - Set Stop Loss: 1.26000
  - Set Take Profit: 1.28000
  - Set Comment: ea striker
  - Click: Buy by Market
  - Click: Confirm/OK
  - Wait 2 seconds

Trade 2 of 5:
  - (Repeat same steps)
  ...

Trade 5 of 5:
  - (Repeat same steps)

Result: "All 5 trades executed successfully for GBPUSD"
```

---

## Verification in Logs

When a trade executes, you'll see these logs in the console:

```
MT5 Proxy - Is Trading Request: true
MT5 Proxy - Trading Params: {
  asset: "GBPUSD",
  action: "BUY",
  volume: "0.01",
  numberOfTrades: "5",
  tp: "1.28000",
  sl: "1.26000"
}

=== MT5 TRADING PARAMETERS ===
Asset: GBPUSD
Action: BUY
Volume: 0.01
Stop Loss: 1.26000
Take Profit: 1.28000
Number of Trades: 5
Bot Name: ea striker
==============================

MT5 Trading: Searched for GBPUSD
MT5 Trading: Selected GBPUSD using text-based selector
MT5 Trading: Opened order dialog using text-based selector
MT5 Trading: Set Volume to: 0.01 using selector: input[type="text"]
MT5 Trading: Set Stop Loss to: 1.26000 using selector: input[placeholder*="Stop"]
MT5 Trading: Set Take Profit to: 1.28000 using selector: input[placeholder*="Take"]
MT5 Trading: Set Comment to: ea striker using selector: input[placeholder*="Comment"]
MT5 Trading: Found BUY button using text search
MT5 Trading: Executing BUY order for trade 1
MT5 Trading: Found confirm button using text search
MT5 Trading: Trade 1 completed successfully
```

---

## Special Cases

### Case 1: No Stop Loss or Take Profit
```json
{
  "asset": "EURUSD",
  "action": "SELL",
  "tp": 0,
  "sl": 0
}
```
**Result**: Trade executes with volume and comment only. Broker uses default or no SL/TP.

### Case 2: Direction Override
```json
// Signal says BUY
signal.action = "BUY"

// But config says always SELL
tradeConfig.direction = "SELL"

// Result: SELL order is placed (config overrides signal)
```

### Case 3: Multiple Trades
```json
tradeConfig.numberOfTrades = "3"
```
**Result**: Same trade executed 3 times in sequence with 2-second delays between each.

---

## Broker Compatibility

The script uses a **cascading selector strategy** for each field:

1. **Try broker-specific selector** (e.g., RazorMarkets classes)
2. **Try generic selector** (e.g., `input[type="text"]`)
3. **Try text-based search** (e.g., search all buttons for "Buy by Market")

This ensures the script works on:
- ✅ RazorMarkets
- ✅ AccuMarkets
- ✅ Any MT5 web terminal with English UI

---

## Summary

**Every parameter from the signal is used exactly as provided:**
- Asset → Symbol search & selection
- Action → Buy or Sell button
- Volume → Lot size field
- SL → Stop Loss field (if not 0)
- TP → Take Profit field (if not 0)
- NumberOfTrades → How many times to repeat
- BotName → Comment field

**The script places the EXACT trade from the signal with the EXACT configuration you set up.**
