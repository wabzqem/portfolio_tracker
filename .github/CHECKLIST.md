# GitHub Actions Setup Checklist ✅

Use this checklist to ensure everything is ready for your first build.

## Pre-requisites

- [ ] GitHub repository created
- [ ] Code pushed to GitHub
- [ ] GitHub Actions enabled (Settings → Actions → Allow all actions)

## Files Added (Verify these exist)

- [ ] `.github/workflows/build.yml` - Main build workflow
- [ ] `.github/BUILD.md` - Build documentation
- [ ] `build/entitlements.mac.plist` - macOS entitlements
- [ ] `GITHUB_ACTIONS_SETUP.md` - Setup guide

## Package.json Updates

- [ ] Build scripts added (`dist:mac`, `dist:win`, `dist:linux`)
- [ ] electron-builder configuration enhanced
- [ ] All platforms configured (mac, win, linux)

## First Build Test

### Option A: Test with a Push
```bash
# Make sure all changes are committed
git status

# Push to trigger build
git push origin main

# Go to GitHub → Your Repo → Actions tab
# Watch the build progress (takes ~10 minutes)
```

### Option B: Test with Manual Trigger
1. Go to GitHub repository
2. Click "Actions" tab
3. Click "Build Electron App" on the left
4. Click "Run workflow" button (right side)
5. Select "main" branch
6. Click green "Run workflow" button
7. Watch the build progress

### Option C: Test Locally First (Recommended)
```bash
# Install dependencies
npm install

# Try building for your current platform
npm run dist

# Check if build succeeds
ls -la dist/

# If successful, push to GitHub
git push origin main
```

## After First Successful Build

- [ ] Check Actions tab for green checkmark ✅
- [ ] Download artifacts from the workflow run
- [ ] Test the installers on your platform
- [ ] Verify all three platforms built successfully

## Create Your First Release

Once the builds are working:

1. Update version in package.json:
```bash
# Edit package.json, change version to "1.0.0" or your desired version
```

2. Commit and tag:
```bash
git add package.json
git commit -m "Release v1.0.0"
git tag v1.0.0
git push origin main --tags
```

3. Check the release:
   - Go to GitHub → Your Repo → Releases
   - You should see "v1.0.0" with all installers attached

## Troubleshooting

### Build fails on GitHub but works locally
- Check Node version (should be 18)
- Ensure all dependencies are in package.json (not devDependencies)
- Check the Actions logs for specific error messages

### No artifacts appear
- Builds might have failed (check the red X)
- Wait for the build to complete (yellow circle = in progress)
- Artifacts only appear if build succeeds

### Release not created
- Make sure you pushed a tag starting with 'v' (like v1.0.0)
- Check that all three platform builds succeeded
- Verify you have release permissions on the repository

## Useful Commands

```bash
# Check current git status
git status

# View all tags
git tag

# Delete a tag (if you made a mistake)
git tag -d v1.0.0
git push origin :refs/tags/v1.0.0

# View recent commits
git log --oneline -5

# Check remote URL
git remote -v
```

## Support

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [electron-builder Documentation](https://www.electron.build/)
- [Electron Documentation](https://www.electronjs.org/docs/latest/)

## Next Steps After Setup

- [ ] Set up code signing certificates (for distribution)
- [ ] Configure auto-updates with electron-updater
- [ ] Add build badges to README
- [ ] Set up different build variants (beta, production)
- [ ] Add automated testing before builds

---

**Ready to go?** Just push your code and watch the magic happen! 🚀
