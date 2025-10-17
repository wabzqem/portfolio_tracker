# Setting Up Public Releases Repository

## Strategy Overview

Keep your source code **private** in `wabzqem/portfolio-tracker`, but publish releases to a **public** repository for downloads.

## Step 1: Create Public Releases Repository

1. Go to https://github.com/new
2. Repository name: `portfolio-tracker-releases` (or `portfolio-tracker-downloads`)
3. Description: "Official releases and downloads for Portfolio Tracker"
4. Make it **Public** ✅
5. Initialize with a README
6. Click "Create repository"

## Step 2: Create a Personal Access Token (PAT)

You need a token to push releases from your private repo to the public one.

1. Go to https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Note: "Portfolio Tracker Release Publishing"
4. Expiration: Choose duration (90 days or longer)
5. Select scopes:
   - ✅ `repo` (all sub-items)
   - ✅ `workflow`
6. Click **"Generate token"**
7. **Copy the token immediately** (you won't see it again!)

## Step 3: Add Token to Your Private Repository

1. Go to your **private** repo: https://github.com/wabzqem/portfolio-tracker
2. Settings → Secrets and variables → Actions
3. Click **"New repository secret"**
4. Name: `RELEASE_TOKEN`
5. Value: Paste the PAT you just created
6. Click **"Add secret"**

## Step 4: Update Your Workflow

Use the new workflow file I've created: `.github/workflows/release-public.yml`

This workflow will:
- Build your app when you push a version tag
- Create a release in your **public** releases repository
- Upload all installers to the public release

## Step 5: Test It

From your private repository:

```bash
# Make sure everything is committed
git add .
git commit -m "Setup public releases"
git push origin main

# Create a test release
git tag v0.0.3
git push origin --tags
```

Watch the Actions tab - it will:
1. Build for all platforms
2. Create a release in your **public** repository
3. Upload all installers there

## Step 6: Set Up GitHub Pages (Optional)

Make a nice download page in your public repo:

1. Go to your **public** releases repo
2. Settings → Pages
3. Source: Deploy from a branch
4. Branch: `main` / root
5. Click Save

Then add an `index.html` to your public repo for a custom download page.

## Repository Structure

**Private Repo** (`wabzqem/portfolio-tracker`):
- Source code
- Development workflow
- All your trading data and configs
- Build configuration

**Public Repo** (`wabzqem/portfolio-tracker-releases`):
- README with download links
- Releases with installers
- GitHub Pages site (optional)
- Installation docs
- No source code

## Updating Releases

Every time you want to release:

```bash
# In your private repo
git tag v1.0.0
git push origin --tags
```

The workflow automatically publishes to the public repo!

## Managing Both Repositories

You can manage both from one local directory:

```bash
# Add public repo as a remote (optional)
git remote add public git@github.com:wabzqem/portfolio-tracker-releases.git

# To update docs in public repo manually
git clone git@github.com:wabzqem/portfolio-tracker-releases.git releases
cd releases
# Make changes to README, add download page, etc.
git add .
git commit -m "Update documentation"
git push
```

## Alternative: Use Release Assets Only

If you don't want a separate repo, you could:
1. Make your current repo public (but maybe you don't want that)
2. Use a different hosting service (like your own website)
3. Use GitHub Release assets only (users can find via direct link)

## Security Note

The Personal Access Token:
- Only has access to public repositories if you limit the scope
- Can be revoked anytime from GitHub settings
- Should be rotated periodically
- Is stored securely in GitHub Secrets (never exposed in logs)

## Next Steps

1. Create the public releases repository
2. Generate a PAT
3. Add PAT to your private repo secrets as `RELEASE_TOKEN`
4. I'll create the workflow file for you
5. Test with a version tag

Ready? Let me know when you've created the public repo and added the token, and I'll update the workflow!
