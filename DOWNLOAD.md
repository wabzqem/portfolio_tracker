# Download & Installation

## 📥 Getting Started

Download the latest release for your platform from the [Releases page](https://github.com/wabzqem/portfolio-tracker/releases/latest).

### macOS

**Choose your architecture:**
- **Apple Silicon (M1/M2/M3/M4)**: Download `Portfolio-Tracker-X.X.X-arm64.dmg`
- **Intel**: Download `Portfolio-Tracker-X.X.X-x64.dmg`

**⚠️ Important First-Time Setup:**

After installing, you'll see a "damaged app" warning. This is because the app isn't code-signed (requires $99/year Apple Developer account). The app is safe - it's open source!

**Quick Fix** - Run this in Terminal:
```bash
xattr -cr "/Applications/Portfolio Tracker.app"
```

[Full macOS installation guide →](INSTALL_MACOS.md)

### Windows

**Choose your installation type:**
- **Installer**: `Portfolio-Tracker-Setup-X.X.X.exe` (recommended)
  - Guided installation wizard
  - Creates Start Menu shortcuts
  - Includes uninstaller
  
- **Portable**: `Portfolio-Tracker-X.X.X.exe`
  - No installation required
  - Run directly from any folder
  - Good for USB drives

**Windows SmartScreen Warning:**
You may see "Windows protected your PC". Click "More info" → "Run anyway". This is normal for unsigned apps.

### Linux

**Choose your package format:**
- **AppImage** (Universal): `Portfolio-Tracker-X.X.X.AppImage`
  - Works on all distros
  - No installation required
  - Make executable: `chmod +x Portfolio-Tracker-X.X.X.AppImage`
  - Run: `./Portfolio-Tracker-X.X.X.AppImage`
  
- **Debian/Ubuntu**: `portfolio-tracker_X.X.X_amd64.deb`
  - Install: `sudo dpkg -i portfolio-tracker_X.X.X_amd64.deb`
  - Or double-click in file manager

## 🔧 Building from Source

If you prefer to build the app yourself:

```bash
# Clone the repository
git clone https://github.com/wabzqem/portfolio-tracker.git
cd portfolio-tracker

# Install dependencies
npm install

# Run in development mode
npm start

# Build for your platform
npm run dist
```

## 🔐 Security Note

This app is **not code-signed** because it's a personal/open-source project. Code signing requires:
- **macOS**: $99/year Apple Developer account
- **Windows**: $300-500/year code signing certificate

You can:
1. Review the source code to verify it's safe
2. Build it yourself from source
3. Use the installation workarounds above

For trusted distribution with no warnings, see [CODE_SIGNING.md](.github/CODE_SIGNING.md).

## ❓ Need Help?

- **macOS "damaged" error**: See [MACOS_FIX.md](MACOS_FIX.md)
- **Installation issues**: Check [INSTALL_MACOS.md](INSTALL_MACOS.md)
- **Bug reports**: [Open an issue](https://github.com/wabzqem/portfolio-tracker/issues)

## 📦 What's Included

All downloads include:
- Portfolio Tracker application
- Built-in trade data viewer
- Capital gains calculator
- Performance charts
- Currency conversion (USD/AUD)

No external dependencies required - just download and run!
