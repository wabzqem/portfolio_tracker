# Portfolio Tracker - GitHub Actions Setup Complete! 🚀

## What Was Added

### 1. GitHub Actions Workflow (`.github/workflows/build.yml`)
A comprehensive CI/CD pipeline that:
- ✅ Builds for **macOS** (Intel & Apple Silicon)
- ✅ Builds for **Windows** (64-bit)
- ✅ Builds for **Linux** (AppImage & deb)
- ✅ Uploads build artifacts for download
- ✅ Automatically creates GitHub releases when you push tags

### 2. Enhanced Package.json
Added platform-specific build scripts:
- `npm run dist:mac` - Build for macOS only
- `npm run dist:win` - Build for Windows only
- `npm run dist:linux` - Build for Linux only

Improved electron-builder configuration with:
- Multiple output formats per platform
- Universal macOS binaries (Intel + Apple Silicon)
- NSIS installer for Windows with customization options
- AppImage and .deb for Linux

### 3. macOS Entitlements (`build/entitlements.mac.plist`)
Required for proper macOS app signing and security permissions:
- Network access
- File system access
- JIT compilation support

### 4. Documentation (`.github/BUILD.md`)
Complete guide on how to use the build system

## How to Use

### Option 1: Automatic Build on Push
Just push to the `main` branch, and GitHub Actions will build for all platforms:
```bash
git add .
git commit -m "Your changes"
git push origin main
```

### Option 2: Create a Release
1. Update version in `package.json`:
   ```json
   "version": "1.0.1"
   ```

2. Create and push a version tag:
   ```bash
   git add package.json
   git commit -m "Bump version to 1.0.1"
   git tag v1.0.1
   git push origin main --tags
   ```

3. GitHub Actions will automatically:
   - Build all platforms
   - Create a GitHub release
   - Attach all installers to the release

### Option 3: Manual Trigger
1. Go to your repository on GitHub
2. Click "Actions" tab
3. Select "Build Electron App" workflow
4. Click "Run workflow"
5. Select branch and click "Run workflow"

## Where to Find Your Builds

### During Development (Non-release builds)
1. Go to the "Actions" tab in your GitHub repository
2. Click on a workflow run
3. Scroll down to "Artifacts" section
4. Download:
   - `macos-build` - macOS .dmg and .zip files
   - `windows-build` - Windows .exe installers
   - `linux-build` - Linux .AppImage and .deb packages

### For Releases (When you push a tag)
1. Go to the "Releases" section of your repository
2. Find your release (e.g., "v1.0.1")
3. All platform installers will be attached as "Assets"

## Output Files

After a successful build, you'll get:

**macOS:**
- `Portfolio Tracker-1.0.0-arm64.dmg` (Apple Silicon)
- `Portfolio Tracker-1.0.0-x64.dmg` (Intel)
- `Portfolio Tracker-1.0.0-arm64-mac.zip`
- `Portfolio Tracker-1.0.0-mac.zip`

**Windows:**
- `Portfolio Tracker Setup 1.0.0.exe` (NSIS installer)
- `Portfolio Tracker 1.0.0.exe` (Portable version)

**Linux:**
- `Portfolio Tracker-1.0.0.AppImage` (Universal Linux app)
- `portfolio-tracker_1.0.0_amd64.deb` (Debian/Ubuntu package)

## Local Testing

Test builds locally before pushing:

```bash
# Install dependencies
npm install

# Build for your current platform
npm run dist

# Check the dist/ folder for output
ls -la dist/
```

## Troubleshooting

### Build Fails on GitHub Actions

1. **Check the logs**: Click on the failed workflow run to see detailed logs
2. **Test locally**: Run `npm run dist` locally to catch issues early
3. **Check dependencies**: Make sure all dependencies are in package.json

### macOS Signing Issues

The entitlements file handles most cases, but if you want to sign your macOS app:
1. You'll need an Apple Developer account
2. Add your signing certificate to GitHub Secrets
3. Update the workflow to include signing credentials

### Windows/Linux Issues

- Windows builds require the target platform to be Windows or use Wine
- Linux builds work on any platform with electron-builder

## Next Steps

1. **Test the workflow**: Push a commit or create a tag to test the builds
2. **Customize**: Edit `.github/workflows/build.yml` if you need different build options
3. **Add code signing**: For production, consider adding code signing certificates
4. **Auto-updates**: Consider adding electron-updater for automatic updates

## Platform Build Matrix

The workflow runs in parallel for efficiency:

| Platform | OS Runner | Build Time (approx) |
|----------|-----------|---------------------|
| macOS | macos-latest | 5-10 min |
| Windows | windows-latest | 3-7 min |
| Linux | ubuntu-latest | 3-7 min |

Total parallel build time: ~10 minutes

## Questions?

- Check `.github/BUILD.md` for detailed documentation
- Review the workflow file: `.github/workflows/build.yml`
- electron-builder docs: https://www.electron.build/

Happy building! 🎉
