# Publishing Guide for @nx-conductor packages

This guide covers how to publish both the main NX plugin and MCP server to npm.

## 📦 Package Structure

```
@nx-conductor/claude-sessions     # Main NX plugin  
@nx-conductor/mcp-server         # Universal MCP server
```

Both packages are published under the `@nx-conductor` scope for professional branding and namespace management.

## 🚀 Publishing Methods

### Method 1: Manual Publishing (Recommended for first release)

#### Prerequisites
1. **NPM Account Setup**
   ```bash
   npm login
   npm whoami  # Verify you're logged in
   ```

2. **Organization Access**
   - Create `@nx-conductor` organization on npm (if not exists)
   - Ensure you have publish rights to the organization

#### Step-by-Step Manual Publish

1. **Update Versions**
   ```bash
   cd dist/libs/nx-claude-sessions
   
   # Update main plugin version
   npm version patch|minor|major
   
   # Update MCP server version  
   cd src/mcp-server
   npm version patch|minor|major
   ```

2. **Run Publish Script**
   ```bash
   cd dist/libs/nx-claude-sessions
   ./publish.sh
   ```

   This script will:
   - Verify npm login
   - Build the MCP server
   - Publish MCP server first  
   - Publish main plugin second
   - Verify both packages are available

### Method 2: Automated Publishing via GitHub Actions

#### Setup GitHub Secrets
1. Go to repository Settings → Secrets and variables → Actions
2. Add secret: `NPM_TOKEN`
   ```bash
   # Generate token on npm
   npm token create --access-token
   # Copy token to GitHub secret
   ```

#### Trigger Automated Publish
```bash
# Create and push version tag
git tag v1.2.0
git push origin v1.2.0

# Or trigger manually from GitHub Actions tab
```

## 📋 Pre-Publish Checklist

### Code Quality
- [ ] All TypeScript compiles without errors
- [ ] All tests pass (when implemented)
- [ ] No console.log statements in production code
- [ ] Dependencies are properly specified

### Documentation  
- [ ] README files are up to date
- [ ] Installation instructions are correct
- [ ] Examples work with current API
- [ ] Changelog is updated (if maintained)

### Package Configuration
- [ ] Version numbers are incremented appropriately
- [ ] `package.json` files have correct metadata
- [ ] `files` array includes all necessary files
- [ ] `bin` entries point to correct executables

### MCP Server Specific
- [ ] TypeScript builds successfully (`npm run build`)
- [ ] `dist/server.js` is executable
- [ ] Binary can be invoked: `npx @nx-conductor/mcp-server --version`
- [ ] MCP server responds to basic requests

### NX Plugin Specific  
- [ ] Generators and executors are properly exported
- [ ] Schema files are valid JSON
- [ ] Plugin works in test NX workspace

## 🔍 Testing Published Packages

### Test MCP Server
```bash
# Install globally
npm install -g @nx-conductor/mcp-server@latest

# Verify binary works
which nx-claude-mcp
nx-claude-mcp --version

# Test with basic MCP client (if available)
```

### Test NX Plugin
```bash
# Create test workspace
npx create-nx-workspace@latest test-workspace --preset=empty

cd test-workspace

# Install plugin
npm install -D @nx-conductor/claude-sessions@latest

# Test generator
npx nx g @nx-conductor/claude-sessions:init --dry-run

# Test executor (if applicable)
npx nx start-claude-session --help
```

## 📊 Post-Publish Verification

### Package Registry
- [ ] Packages appear on https://www.npmjs.com/package/@nx-conductor/claude-sessions
- [ ] Packages appear on https://www.npmjs.com/package/@nx-conductor/mcp-server
- [ ] README renders correctly on npm
- [ ] Download stats are tracking

### Documentation Updates
- [ ] Update main repository README with new npm links
- [ ] Update setup scripts to use published packages
- [ ] Verify setup script works with published versions

### Community
- [ ] Create GitHub release with changelog
- [ ] Update any blog posts or announcements
- [ ] Notify relevant communities (if appropriate)

## 🔄 Version Management Strategy

### Semantic Versioning
- **Major** (1.0.0 → 2.0.0): Breaking changes
- **Minor** (1.0.0 → 1.1.0): New features, backwards compatible
- **Patch** (1.0.0 → 1.0.1): Bug fixes, backwards compatible

### Synchronized Versioning
Both packages should generally use the same version numbers to avoid confusion:

```bash
# Good: Both at same version
@nx-conductor/claude-sessions@1.2.0
@nx-conductor/mcp-server@1.2.0

# Avoid: Different versions unless needed
@nx-conductor/claude-sessions@1.2.0  
@nx-conductor/mcp-server@1.1.5
```

### Pre-release Versions
For beta/alpha releases:
```bash
npm version prerelease --preid=beta
# Results in: 1.2.0-beta.0

npm publish --tag beta
npm install -g @nx-conductor/mcp-server@beta
```

## 🚨 Rollback Procedures

### Unpublishing (Emergency Only)
```bash
# Only works within 72 hours for new packages
npm unpublish @nx-conductor/claude-sessions@1.2.0
npm unpublish @nx-conductor/mcp-server@1.2.0
```

### Deprecating Versions
```bash
# Safer alternative to unpublishing
npm deprecate @nx-conductor/claude-sessions@1.2.0 "This version has critical bugs. Please upgrade to 1.2.1"
```

### Publishing Fix
```bash
# Quick fix release
npm version patch
./publish.sh
```

## 📈 Monitoring and Analytics

### NPM Stats
- Monitor download counts on npm package pages
- Track which versions are being used
- Watch for unusual download patterns

### GitHub Analytics  
- Monitor GitHub release download stats
- Track issues related to specific versions
- Watch for community feedback

### User Feedback Channels
- GitHub Issues for bugs and feature requests
- NPM package pages for reviews
- Documentation feedback

## 🎯 Success Metrics

### Technical Metrics
- [ ] Both packages install without errors
- [ ] Setup script completes successfully  
- [ ] MCP server connects to Claude Desktop
- [ ] NX plugin generators and executors work

### Adoption Metrics
- [ ] Download counts increase over time
- [ ] GitHub stars and issues indicate engagement
- [ ] Community creates issues/PRs
- [ ] Other projects reference or build on packages

## 🔗 Useful Commands

```bash
# Check current published versions
npm view @nx-conductor/claude-sessions
npm view @nx-conductor/mcp-server

# See what files would be published
npm pack --dry-run

# Test installation in clean environment
docker run -it node:18 bash
npm install -g @nx-conductor/mcp-server

# Check for security vulnerabilities  
npm audit

# Update all dependencies
npm update --save
```

## ⚠️ Common Issues

### Publishing Fails
- Verify npm login: `npm whoami`
- Check organization permissions
- Ensure version wasn't already published
- Validate package.json syntax

### Binary Not Found After Install
- Check `bin` field in package.json
- Verify file has proper shebang: `#!/usr/bin/env node`
- Ensure file is executable: `chmod +x dist/server.js`

### MCP Server Connection Issues
- Verify Claude Desktop configuration
- Check environment variables in MCP config
- Test server can start independently
- Review server logs for errors

---

**🚀 Ready to publish and share intelligent session management with the world!**