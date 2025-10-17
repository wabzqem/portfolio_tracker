# 🚨 macOS Users: "Damaged App" Fix

If you see **"Portfolio Tracker is damaged and can't be opened"**, run this in Terminal:

```bash
xattr -cr "/Applications/Portfolio Tracker.app"
```

Then open the app normally.

**Why?** The app isn't code-signed with an Apple Developer certificate ($99/year). The app is safe - [view the source code](https://github.com/wabzqem/portfolio-tracker).

## Alternative Method

1. Right-click Portfolio Tracker in Applications
2. Click "Open"
3. Click "Open" again in the security dialog

---

📖 Full installation guide: [INSTALL_MACOS.md](INSTALL_MACOS.md)
