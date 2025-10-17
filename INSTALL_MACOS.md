# Installing Portfolio Tracker on macOS

## ⚠️ Important: Unsigned App Notice

Portfolio Tracker is currently distributed **unsigned**. This means macOS Gatekeeper will block it with a "damaged" or "unidentified developer" message. This is a security feature, not an actual problem with the app.

## Installation Methods

### Method 1: Terminal Command (Recommended)

1. Download and open the `.dmg` file
2. Drag "Portfolio Tracker" to Applications
3. **Do NOT double-click the app yet**
4. Open Terminal and run:
   ```bash
   xattr -cr "/Applications/Portfolio Tracker.app"
   ```
5. Now you can open Portfolio Tracker normally from Applications

### Method 2: Right-Click Open

1. Download and open the `.dmg` file
2. Drag "Portfolio Tracker" to Applications
3. **Right-click** (or Control+click) on Portfolio Tracker in Applications
4. Select "Open" from the menu
5. Click "Open" in the security dialog
6. The app will now open (and can be opened normally from now on)

### Method 3: System Preferences (If other methods don't work)

1. Try to open Portfolio Tracker (it will be blocked)
2. Go to **System Preferences → Security & Privacy → General**
3. You'll see a message about Portfolio Tracker being blocked
4. Click **"Open Anyway"**
5. Confirm by clicking **"Open"** in the dialog

## Why Is This Happening?

This app is built without an Apple Developer certificate ($99/year). For open-source or personal projects, this is common. The app is safe - you can review the source code at: https://github.com/wabzqem/portfolio-tracker

## For Developers: Adding Code Signing

If you want to distribute signed versions, you'll need:

1. **Apple Developer Account** ($99/year)
2. **Developer ID Application Certificate**
3. Add these secrets to GitHub:
   - `APPLE_ID` - Your Apple ID email
   - `APPLE_ID_PASSWORD` - App-specific password
   - `APPLE_TEAM_ID` - Your team ID
   - `CSC_LINK` - Base64 encoded .p12 certificate
   - `CSC_KEY_PASSWORD` - Certificate password

Then update the workflow to enable signing.

## Choosing the Right Version

- **arm64 (Apple Silicon)**: For M1, M2, M3, M4 Macs
- **x64 (Intel)**: For Intel-based Macs
- **Universal**: Works on both (larger file size)

Not sure which Mac you have?
- Click Apple menu → About This Mac
- Look for "Chip": 
  - "Apple M1/M2/M3/M4" = arm64
  - "Intel" = x64

## Still Having Issues?

If you continue to have problems:

1. Make sure you downloaded from the official GitHub releases page
2. Check that your Mac allows apps from identified developers:
   - System Preferences → Security & Privacy → General
   - Should allow apps from "App Store and identified developers" or "Anywhere"
3. Try downloading again - the file might be corrupted

## Questions?

Open an issue on GitHub: https://github.com/wabzqem/portfolio-tracker/issues
