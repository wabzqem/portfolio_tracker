# Portfolio Tracker Icons

This directory contains the app icons for the Portfolio Tracker Electron application.

## Files

- `icon.svg` - Main vector icon (scalable)
- `icon.png` - Main app icon (512x512)
- `icon-*x*.svg` - Various sizes for different platforms

## Icon Design

The icon features:
- 🟢 Green circular background (representing growth/finance)
- 📊 Gold chart bars (showing portfolio performance)
- 💰 Dollar symbol (representing financial tracking)
- 📈 Growth arrow (indicating positive performance)

## Usage

The icons are automatically used by Electron when building the application:

```bash
# The icon will appear in:
npm start        # Window title bar and taskbar
npm run build    # Generated installers and app bundles
```

## Customization

To use your own icon:

1. Replace `assets/icon.png` with your custom icon (512x512 recommended)
2. For best results, provide icons in multiple sizes:
   - 16x16, 32x32, 48x48, 64x64, 128x128, 256x256, 512x512, 1024x1024
3. Update `package.json` build configuration if needed

## Platform Requirements

- **Windows**: Uses .ico files (electron-builder converts PNG automatically)
- **macOS**: Uses .icns files (electron-builder converts PNG automatically) 
- **Linux**: Uses PNG files directly