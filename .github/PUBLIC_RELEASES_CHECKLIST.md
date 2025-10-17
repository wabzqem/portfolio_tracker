# Quick Setup Checklist for Public Releases

## ☑️ Step-by-Step Setup

### 1. Create Public Repository
- [ ] Go to https://github.com/new
- [ ] Name: `portfolio-tracker-releases` (or `portfolio-tracker-downloads`)
- [ ] Make it **PUBLIC** ✅
- [ ] Initialize with README
- [ ] Create repository

### 2. Create Personal Access Token
- [ ] Go to https://github.com/settings/tokens
- [ ] Generate new token (classic)
- [ ] Name: "Portfolio Tracker Releases"
- [ ] Scopes: Check `repo` and `workflow`
- [ ] Generate and **COPY THE TOKEN**

### 3. Add Token to Private Repo
- [ ] Go to https://github.com/wabzqem/portfolio-tracker
- [ ] Settings → Secrets and variables → Actions
- [ ] New repository secret
- [ ] Name: `RELEASE_TOKEN`
- [ ] Value: Paste your token
- [ ] Add secret

### 4. Update Workflow File
- [ ] Edit `.github/workflows/release-public.yml`
- [ ] Change line 85: `repository: wabzqem/portfolio-tracker-releases`
  - Replace with your actual public repo name
- [ ] Save and commit

### 5. Set Up Public Repository Content
In your **public** repo:
- [ ] Copy `PUBLIC_REPO_README.md` as `README.md`
- [ ] Copy `INSTALL_MACOS.md` 
- [ ] Copy `MACOS_FIX.md`
- [ ] Copy `DOWNLOAD.md`
- [ ] Commit all files

### 6. Enable GitHub Pages (Optional)
- [ ] In public repo: Settings → Pages
- [ ] Source: Deploy from a branch
- [ ] Branch: `main` / root
- [ ] Save
- [ ] Copy `PUBLIC_REPO_INDEX.html` as `index.html` in public repo
- [ ] Commit and push

### 7. Test the Setup
In your **private** repo:
```bash
# Commit workflow changes
git add .github/workflows/release-public.yml
git commit -m "Add public releases workflow"
git push origin main

# Create a test release
git tag v0.0.4
git push origin --tags
```

- [ ] Watch Actions tab (should succeed)
- [ ] Check public repo for new release
- [ ] Download and test installers
- [ ] Check GitHub Pages site (if enabled)

### 8. Update Both Workflows
You now have two workflows:
- `.github/workflows/build.yml` - Builds on every push to main
- `.github/workflows/release-public.yml` - Publishes releases to public repo

Options:
- **Keep both**: Regular builds stay private, releases go public
- **Use only release-public**: Only build when you create a tag
  - If choosing this, delete or disable `build.yml`

## Quick Commands Reference

### In Private Repo (Development):
```bash
# Regular development work
git add .
git commit -m "Your changes"
git push origin main

# Create a public release
git tag v1.0.0
git push origin --tags
```

### In Public Repo (Documentation):
```bash
# Clone public repo
git clone git@github.com:wabzqem/portfolio-tracker-releases.git

# Update docs
cd portfolio-tracker-releases
# Edit README.md, index.html, etc.
git add .
git commit -m "Update documentation"
git push
```

## Verification Checklist

- [ ] Public repo exists and is public
- [ ] Token is added to private repo secrets
- [ ] Workflow file has correct repository name
- [ ] Test release created successfully
- [ ] Installers appear in public repo releases
- [ ] GitHub Pages site works (if enabled)
- [ ] Download links work
- [ ] Installation instructions are clear

## Troubleshooting

### "Resource not accessible by integration"
- Check that RELEASE_TOKEN is set correctly
- Verify token has `repo` scope
- Ensure token hasn't expired

### "Bad credentials"
- Token might be expired
- Create a new token
- Update RELEASE_TOKEN secret

### Releases not appearing in public repo
- Check Actions logs for errors
- Verify repository name in workflow
- Ensure public repo exists and is accessible

### GitHub Pages not working
- Enable Pages in public repo settings
- Make sure `index.html` is in root of main branch
- Wait a few minutes for deployment

## Next Steps After Setup

1. Customize the README in your public repo
2. Update index.html with your branding
3. Add screenshots to public repo
4. Create documentation files
5. Share the public repo link!

## Public Repo URL

Your releases will be at:
- Releases: `https://github.com/wabzqem/portfolio-tracker-releases/releases`
- GitHub Pages: `https://wabzqem.github.io/portfolio-tracker-releases/`
- Repository: `https://github.com/wabzqem/portfolio-tracker-releases`

---

**Ready to go live?** Complete the checklist above and you're all set! 🚀
