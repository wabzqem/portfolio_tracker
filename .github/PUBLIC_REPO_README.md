# Portfolio Tracker

> A professional desktop application for tracking investment portfolios with capital gains calculation, currency conversion, and performance analytics.

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## 📥 Download

Get the latest version from the [Releases page](https://github.com/wabzqem/portfolio-tracker-releases/releases/latest).

### macOS

**Choose your architecture:**
- 🍎 **Apple Silicon (M1/M2/M3/M4)**: `Portfolio-Tracker-X.X.X-arm64.dmg`
- 🖥️ **Intel**: `Portfolio-Tracker-X.X.X-x64.dmg`

**⚠️ Important**: After installing, run this command in Terminal:
```bash
xattr -cr "/Applications/Portfolio Tracker.app"
```

This is needed because the app isn't code-signed (requires $99/year Apple Developer account). The app is safe - it's open source!

**Alternative method:**
1. Right-click Portfolio Tracker in Applications
2. Select "Open"
3. Click "Open" in the security dialog

### Windows

**Choose your installation type:**
- 💾 **Installer** (recommended): `Portfolio-Tracker-Setup-X.X.X.exe`
  - Guided installation
  - Start Menu shortcuts
  - Easy uninstall
  
- 🚀 **Portable**: `Portfolio-Tracker-X.X.X.exe`
  - No installation needed
  - Run from anywhere

**Note**: Windows SmartScreen may show a warning. Click "More info" → "Run anyway". This is normal for unsigned applications.

### Linux

**Choose your package:**
- 📦 **AppImage** (Universal): `Portfolio-Tracker-X.X.X.AppImage`
  - Works on all distributions
  - Make executable: `chmod +x Portfolio-Tracker-X.X.X.AppImage`
  - Run: `./Portfolio-Tracker-X.X.X.AppImage`
  
- 🐧 **Debian/Ubuntu**: `portfolio-tracker_X.X.X_amd64.deb`
  - Install: `sudo dpkg -i portfolio-tracker_X.X.X_amd64.deb`

## ✨ Features

- 📊 **Trade Tracking**: Import and view all your trades
- 💰 **Capital Gains**: ATO-compliant FIFO calculation
- 📈 **Performance Charts**: Visualize your trading performance
- 💱 **Currency Conversion**: Real-time USD/AUD conversion
- 🎯 **Options Support**: Full support for options trading
- 📱 **Cross-Platform**: Works on macOS, Windows, and Linux

## 🚀 Quick Start

1. Download the appropriate version for your platform
2. Install following the platform-specific instructions above
3. Open Portfolio Tracker
4. Import your trading data (CSV format)
5. View your portfolio, capital gains, and performance

## 📖 Documentation

- [macOS Installation Guide](INSTALL_MACOS.md)
- [Windows Installation Guide](INSTALL_WINDOWS.md)
- [Linux Installation Guide](INSTALL_LINUX.md)
- [User Guide](USER_GUIDE.md)
- [FAQ](FAQ.md)

## 🐛 Issues & Support

Found a bug or need help?

- [Report an issue](https://github.com/wabzqem/portfolio-tracker-releases/issues)
- [View known issues](https://github.com/wabzqem/portfolio-tracker-releases/issues)

## 🔐 Security & Privacy

- ✅ All data stays on your computer
- ✅ No tracking or analytics
- ✅ No internet connection required (except for currency rate updates)
- ✅ Open source - verify the code yourself

**Why unsigned?**
- Code signing requires expensive certificates ($99-500/year)
- This is a personal/open-source project
- You can review the source code to verify safety

## 📜 License

MIT License - see LICENSE file for details

## 💖 Support

If you find this app useful, consider:
- ⭐ Starring the repository
- 🐛 Reporting bugs
- 💡 Suggesting features

---

**Not affiliated with any broker or financial institution.**

**Made with ❤️ for traders by traders**
