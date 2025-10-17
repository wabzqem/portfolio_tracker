# macOS Code Signing Setup (For Distribution)

This guide explains how to properly sign and notarize your macOS builds for distribution without the "damaged app" warnings.

## Prerequisites

1. **Apple Developer Account** ($99/year)
   - Sign up at: https://developer.apple.com/programs/

2. **Xcode Command Line Tools** (on your Mac)
   ```bash
   xcode-select --install
   ```

## Step 1: Create Developer ID Certificate

1. Go to https://developer.apple.com/account/resources/certificates/list
2. Click the **+** button to create a new certificate
3. Select **"Developer ID Application"**
4. Follow the instructions to create a Certificate Signing Request (CSR)
5. Upload the CSR and download the certificate
6. Double-click to install it in your Keychain

## Step 2: Export Certificate for GitHub Actions

1. Open **Keychain Access** on your Mac
2. Find your "Developer ID Application" certificate
3. Right-click → **Export** → Save as `.p12` file
4. Set a strong password (you'll need this later)
5. Convert to Base64:
   ```bash
   base64 -i certificate.p12 | pbcopy
   ```
   (This copies the base64 string to your clipboard)

## Step 3: Create App-Specific Password

1. Go to https://appleid.apple.com/account/manage
2. Sign in with your Apple ID
3. In the **Security** section, under **App-Specific Passwords**, click **Generate Password**
4. Enter a label like "Portfolio Tracker Notarization"
5. **Save this password** - you can't view it again!

## Step 4: Add Secrets to GitHub

1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions
3. Click **New repository secret** for each of these:

   - **Name**: `CSC_LINK`
     **Value**: The base64 string from Step 2
   
   - **Name**: `CSC_KEY_PASSWORD`
     **Value**: The password you used when exporting the .p12 file
   
   - **Name**: `APPLE_ID`
     **Value**: Your Apple ID email (e.g., wabz@whatsbeef.net)
   
   - **Name**: `APPLE_ID_PASSWORD`
     **Value**: The app-specific password from Step 3
   
   - **Name**: `APPLE_TEAM_ID`
     **Value**: Your Team ID (find it at https://developer.apple.com/account - it's a 10-character string like "ABC123XYZ4")

## Step 5: Update GitHub Actions Workflow

Replace the macOS build step in `.github/workflows/build.yml`:

```yaml
      - name: Build Electron app (macOS)
        if: matrix.os == 'macos-latest'
        run: npm run dist
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # Code signing
          CSC_LINK: ${{ secrets.CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
          # Notarization
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_ID_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
```

## Step 6: Update package.json

The current configuration already supports signing. Verify these settings exist:

```json
"mac": {
  "category": "public.app-category.finance",
  "icon": "assets/icon.png",
  "hardenedRuntime": true,
  "gatekeeperAssess": false,
  "entitlements": "build/entitlements.mac.plist",
  "entitlementsInherit": "build/entitlements.mac.plist",
  "notarize": {
    "teamId": "APPLE_TEAM_ID"  // Will be read from environment
  }
}
```

## Step 7: Test the Build

1. Push your updated workflow:
   ```bash
   git add .github/workflows/build.yml
   git commit -m "Enable macOS code signing and notarization"
   git push origin main
   ```

2. Create a new release:
   ```bash
   git tag v0.0.3
   git push origin --tags
   ```

3. Wait for the build to complete (notarization takes 5-10 minutes extra)

4. Download and test - it should open without warnings!

## Troubleshooting

### "No signing identity found"
- Make sure you exported the certificate correctly
- Verify the base64 string is complete (no line breaks)
- Check that CSC_LINK and CSC_KEY_PASSWORD secrets are set correctly

### "Invalid credentials"
- Double-check your APPLE_ID email
- Make sure you're using an **app-specific password**, not your Apple ID password
- Verify APPLE_TEAM_ID is correct (10 characters)

### "Notarization failed"
- Check the build logs for specific errors
- Ensure your Apple Developer account is active and paid
- Verify you're using a "Developer ID Application" certificate, not a different type

### "App still shows as damaged"
- Wait 10-15 minutes after notarization completes
- Apple's servers need time to propagate the notarization
- Try downloading on a different Mac or clearing download quarantine

## Cost Estimate

- **Apple Developer Program**: $99/year
- **Time to set up**: 30-60 minutes (first time)
- **Build time increase**: +5-10 minutes per build (for notarization)

## Alternative: Skip Signing for Personal Use

If you're not distributing publicly, keep the current setup with `CSC_IDENTITY_AUTO_DISCOVERY: false` and provide users with the installation instructions in `INSTALL_MACOS.md`.

## Testing Locally

Test signing locally before pushing:

```bash
# Set environment variables
export CSC_LINK="/path/to/certificate.p12"
export CSC_KEY_PASSWORD="your-password"
export APPLE_ID="your@email.com"
export APPLE_ID_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="YOUR_TEAM_ID"

# Build and sign
npm run dist:mac
```

## References

- [electron-builder Code Signing](https://www.electron.build/code-signing)
- [Apple Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [electron-notarize](https://github.com/electron/notarize)
