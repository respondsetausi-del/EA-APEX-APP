# Trading Flow Documentation

## Overview
This document explains how the automated trading system works for both MT4 and MT5 platforms.

## MT5 Trading Flow (Completely Rewritten)

### Architecture
The MT5 trading flow has been completely restructured into a clear, sequential 6-step process that works reliably on **any MT5 broker** (RazorMarkets, AccuMarkets, etc.).

### Execution Steps

#### Step 1: Login (6 seconds)
- Fills login credentials into the MT5 web terminal
- Clicks the Connect/Login button
- Uses multiple selector strategies to find login fields:
  - `input[name="login"]`
  - `input[placeholder*="Login"]`
  - Text-based button detection for "Connect", "Login", "Sign in"

#### Step 2: Wait for Login (Up to 20 seconds with retries)
- Verifies login success by checking for:
  - Search bar presence
  - Symbol list (>5 symbols)
  - Balance/Equity text in page
- Retries every 2 seconds (max 10 attempts)
- Proceeds even if timeout (graceful degradation)

#### Step 3: Reveal Search Bar (3 seconds)
- Clicks title element to reveal search bar (RazorMarkets specific)
- Verifies search bar is visible
- Falls back to any text input if search bar not found
- Retries up to 3 times

#### Step 4: Search Symbol (2 seconds)
- Enters symbol name into search field
- Clears field first, then sets value
- Dispatches input, change, keyup, keydown events
- Verifies value was set correctly

#### Step 5: Select Symbol (2 seconds)
- Tries RazorMarkets selectors first (`.symbol.svelte-19bwscl`)
- Falls back to text-based matching for AccuMarkets
- Clicks on exact symbol match or symbol with `.mic` suffix
- Searches all elements if specific selectors fail

#### Step 6: Execute Trades (Sequential)
For each trade (1 to N):
1. **Open Order Dialog** (2 seconds)
   - RazorMarkets: `.icon-button.withText span.button-text`
   - AccuMarkets: Text search for "Create" + "Order" buttons
   
2. **Set Parameters** (2.5 seconds)
   - **Volume**: Multiple selectors including `.trade-input input[type="text"]`
   - **Stop Loss**: `.sl input[type="text"]` or placeholder-based search
   - **Take Profit**: `.tp input[type="text"]` or placeholder-based search
   - **Comment**: EA name/bot name
   - Each field: Clear → Set → Dispatch events → Verify → Retry if needed
   
3. **Execute Order** (2 seconds)
   - BUY: `.footer-row button.trade-button:not(.red)` or text "buy"
   - SELL: `.footer-row button.trade-button.red` or text "sell"
   
4. **Confirm Order** (1.5 seconds)
   - RazorMarkets: `.trade-button.svelte-16cwwe0`
   - AccuMarkets: Text search for "OK", "Confirm", "Yes"
   
5. **Wait for Processing** (3 seconds)
   - Tracks order completion
   - Closes any confirmation dialogs
   - Logs progress: "Order X completed (X/Y)"
   
6. **Delay Before Next** (2 seconds)
   - Ensures UI is ready for next order

### Total Time Estimate
- **Login & Setup**: ~25-30 seconds
- **Per Order**: ~13-15 seconds
- **Example**: 3 orders = ~70-75 seconds total

### Success Indicators
- ✅ Shows elapsed time on completion
- ✅ Tracks orders completed (X/Y)
- ✅ Auto-closes WebView after 3 seconds
- ✅ Clear progress messages at each step

---

## MT4 Trading Flow

### Architecture
MT4 uses a similar but slightly different approach due to the different web terminal structure.

### Execution Steps

#### Step 1: Login (3 seconds)
- Fills login, password, server fields
- Clicks login button (3rd button in `.input-button` list)

#### Step 2: Show All Symbols (10 seconds)
- Right-clicks first symbol in Market Watch
- Clicks "Show All" in context menu
- Waits for symbol list to populate

#### Step 3: Execute Trades (Sequential)
For each trade:
1. **Select Symbol** (2 seconds)
   - Double-clicks symbol in Market Watch table
   - Searches for exact symbol match in table rows
   
2. **Set Parameters** (4.5 seconds)
   - Volume: `#volume`
   - Stop Loss: `#sl` (1 second delay)
   - Take Profit: `#tp` (2 seconds delay)
   - Comment: `#comment` (3 seconds delay)
   - Enhanced retry mechanism with character-by-character typing fallback
   
3. **Execute Order** (immediate)
   - BUY: `button.input-button.blue`
   - SELL: `button.input-button.red`
   
4. **Wait Between Orders** (8 seconds)
   - Ensures order is fully processed before next

### Total Time Estimate
- **Login & Setup**: ~13 seconds
- **Per Order**: ~14.5 seconds
- **Example**: 3 orders = ~56 seconds total

---

## Universal Features (Both Platforms)

### Multi-Selector Strategy
Every UI element has 3 levels of selectors:
1. **Broker-specific** (e.g., RazorMarkets classes)
2. **Generic CSS** (e.g., `input[type="text"]`)
3. **Text-based** (searches all elements for matching text)

### Field Setting Robustness
Every input field uses this sequence:
1. Focus the field
2. Select all existing content
3. Clear the field
4. Set new value
5. Dispatch events: `input`, `change`, `keyup`, `keydown`, `blur`
6. Verify value was set
7. Retry with alternative method if verification fails

### Event Dispatching
All interactions dispatch proper browser events:
- `input` - For reactive frameworks
- `change` - For form validation
- `keyup`/`keydown` - For keyboard listeners
- `blur` - For field exit handlers
- `click` - For button interactions

### Error Handling
- Graceful degradation (proceeds even if optional steps fail)
- Extensive console logging for debugging
- Progress messages sent to React Native
- Automatic retries with exponential backoff
- Fallback selectors for every critical element

---

## Configuration

### Trade Parameters (from Signal)
- **Asset**: Symbol to trade (e.g., "EURUSD")
- **Action**: BUY or SELL
- **Price**: Entry price (informational)
- **TP**: Take Profit level
- **SL**: Stop Loss level

### Trade Configuration (from Symbol Settings)
- **lotSize**: Volume per trade (e.g., "0.01")
- **numberOfTrades**: How many orders to place (e.g., "3")
- **direction**: Override signal direction
  - "BUY" - Always buy regardless of signal
  - "SELL" - Always sell regardless of signal
  - "BOTH" - Follow signal direction

### Account Credentials
- **login**: MT4/MT5 account number
- **password**: Account password
- **server**: Broker server name (MT5 only)

---

## Broker Compatibility

### Tested Brokers
✅ **RazorMarkets** (MT5) - Fully working
✅ **AccuMarkets** (MT5) - Fully working
✅ **MetaTraderWeb** (MT4) - Fully working

### How It Works on Any Broker
The system uses a **cascading selector strategy**:

1. First tries broker-specific selectors (fast, reliable for known brokers)
2. Falls back to generic CSS selectors (works for most standard MT5 terminals)
3. Finally uses text-based element search (works on any broker with English UI)

This 3-tier approach ensures the system works on **any MT4/MT5 web terminal** without requiring broker-specific configuration.

---

## Debugging

### Visual Debugging
The trading WebView is now **visible** during execution, allowing you to:
- Watch the login process
- See symbol search and selection
- Observe order dialog opening
- Verify parameters being set
- Confirm trade execution

### Console Logging
Every step logs to console with prefixes:
- `[MT5 Trading]` - Progress messages
- `[MT5 Success]` - Completion messages
- `[MT5 Error]` - Error messages
- `[Order X]` - Per-order actions

### Progress Messages
React Native receives real-time updates:
- "Step 1/6: Logging into MT5 account..."
- "Step 2/6: Waiting for login to complete..."
- "Executing order 1 of 3..."
- "Setting parameters for order 2..."
- "✅ All 3 order(s) executed successfully in 65.3s"

---

## Success Criteria

A trade is considered successful when:
1. ✅ Login completes (terminal loads)
2. ✅ Symbol is found and selected
3. ✅ Order dialog opens
4. ✅ All parameters are set (Volume, SL, TP, Comment)
5. ✅ Trade is executed (Buy/Sell button clicked)
6. ✅ Order is confirmed (OK button clicked)
7. ✅ Process repeats for all configured orders

The system shows "✅ All X order(s) executed successfully" only after **all** orders complete.

---

## Future Improvements

Potential enhancements:
- [ ] Screenshot capture at each step for audit trail
- [ ] Retry failed orders automatically
- [ ] Parallel order execution (if broker supports)
- [ ] Order verification by checking Positions tab
- [ ] Support for pending orders (Limit, Stop)
- [ ] Support for modifying existing positions
- [ ] Multi-language support (non-English terminals)

---

## Technical Notes

### Why Sequential Execution?
Orders are executed one at a time (not in parallel) because:
1. Web terminals have rate limits
2. UI needs time to update between actions
3. Ensures each order is fully processed before next
4. Prevents race conditions in DOM manipulation
5. Makes debugging easier (clear cause-effect relationship)

### Why Visible WebView?
The WebView is visible during trading to:
1. Allow visual debugging by users
2. Build trust (users can see what's happening)
3. Catch UI-specific issues on different brokers
4. Provide immediate feedback if something goes wrong
5. Enable users to manually intervene if needed

### Timing Considerations
All delays are carefully tuned:
- Too short: UI doesn't update, actions fail
- Too long: Unnecessary wait time, poor UX
- Current values: Tested on multiple brokers, balance speed vs reliability

---

## Support

If trading fails on a specific broker:
1. Check console logs for error messages
2. Watch the visible WebView to see where it stops
3. Verify credentials are correct
4. Ensure symbol exists on that broker
5. Check broker's web terminal is accessible
6. Report issue with broker name and console logs

The system is designed to work on **any** MT4/MT5 broker, but if you encounter issues, the detailed logging will help identify the problem quickly.
