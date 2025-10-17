# GitHub Actions Build Setup

This repository is configured to automatically build the Portfolio Tracker Electron application for Windows, Linux, and macOS using GitHub Actions.

## Build Triggers

The build workflow is triggered by:
- **Pushes to main branch**: Builds all platforms
- **Pull requests to main**: Builds all platforms for testing
- **Tags starting with 'v'**: Builds all platforms and creates a GitHub release
- **Manual trigger**: Can be run manually from the Actions tab

## Platform-specific Builds

### macOS
- **Outputs**: 
  - `.dmg` installer
  - `.zip` archive
- **Architectures**: x64 (Intel) and arm64 (Apple Silicon)

### Windows
- **Outputs**:
  - `.exe` NSIS installer (with installation wizard)
  - Portable `.exe` (no installation required)
- **Architecture**: x64

### Linux
- **Outputs**:
  - `.AppImage` (universal Linux package)
  - `.deb` (Debian/Ubuntu)
- **Architecture**: x64

## Creating a Release

To create a new release with binaries:

1. Update the version in `package.json`
2. Commit the changes
3. Create and push a tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
4. GitHub Actions will automatically:
   - Build for all platforms
   - Create a GitHub release
   - Upload all build artifacts to the release

## Manual Build

You can also build locally for your platform:

```bash
# Install dependencies
npm install

# Build for your current platform
npm run dist

# Or build for a specific platform
npm run dist:mac
npm run dist:win
npm run dist:linux
```

## Artifacts

Build artifacts are automatically uploaded and available in the Actions tab:
- **macos-build**: macOS installers
- **windows-build**: Windows installers
- **linux-build**: Linux packages

These artifacts are kept for 90 days by default.

## Notes

- The workflow uses `npm ci` instead of `npm install` for faster, reproducible builds
- Node.js version 18 is used for all builds
- The `GH_TOKEN` is automatically provided by GitHub Actions for authenticated builds
- Builds run in parallel to save time
