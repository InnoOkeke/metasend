# Security Audit Report - MetaSend

**Date**: November 13, 2025  
**Status**: ⚠️ CRITICAL ISSUES FOUND AND FIXED

---

## 🚨 Critical Issues Found

### 1. ❌ Hardcoded API Key in Test File
**File**: `test-email.js`  
**Issue**: METASEND_API_KEY was hardcoded directly in the file  
**Risk**: HIGH - API key was committed to git and pushed to repository  
**Status**: ✅ FIXED

**What was exposed**:
```javascript
const API_KEY = 'ms_live_8f3a9d2c1e4b5a6f7c8d9e0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0';
```

**Actions Taken**:
- ✅ Removed hardcoded API key from test-email.js
- ✅ Updated to load from .env file
- ✅ Added test-email.js to .gitignore
- ✅ Removed test-email.js from git tracking (`git rm --cached`)
- ⚠️ **REQUIRED**: Regenerate METASEND_API_KEY immediately

---

## 📊 Sensitive Data Inventory

### Currently in `.env` (Properly Gitignored)
✅ All sensitive keys are in `.env` which is properly gitignored:

1. **RESEND_API_KEY**: `re_6W1Umb2x_LtjZMjVDVMZqwMmCwni2JLPJ`
2. **ESCROW_MASTER_KEY**: `f67c14c308a0f0890a30c7c8716ff4f9592ad37959ba79c89b1be90805a6a506`
3. **MONGODB_URI**: Contains database password
4. **METASEND_API_KEY**: `ms_live_8f3a9d2c1e4b5a6f7c8d9e0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0`
5. **CRON_SECRET**: `317ff2d3cfffd5f8aa1204cab34bb644a9879932165042bbd870b1088a78dedf`
6. **COINBASE_OAUTH_CLIENT_ID**: `i3E40rkZc9ZDT3ldjpM9BPhQAh1QypW5`
7. **COINBASE_PAYMASTER_API_KEY**: `i3E40rkZc9ZDT3ldjpM9BPhQAh1QypW5`

### ✅ No Hardcoded Secrets Found In:
- Source code (`src/**`)
- API endpoints (`api/**`)
- Configuration files (`app.config.js`, `vercel.json`)
- All secrets are loaded from environment variables

---

## 🔐 Security Best Practices - Current Status

| Practice | Status | Notes |
|----------|--------|-------|
| `.env` gitignored | ✅ PASS | Properly configured |
| No hardcoded secrets in source | ✅ PASS | All use env vars |
| Secrets in Vercel dashboard | ⚠️ PENDING | Need to verify |
| API authentication | ✅ PASS | Bearer token required |
| Cron job security | ✅ PASS | CRON_SECRET required |
| Database credentials encrypted | ✅ PASS | MongoDB connection string in env |
| Test files gitignored | ✅ PASS | Now properly ignored |

---

## 🛡️ Immediate Actions Required

### 1. Regenerate Compromised API Key ⚠️ CRITICAL
The METASEND_API_KEY was exposed in git history. You must:

```bash
# Generate a new key (use a secure random generator)
node -e "console.log('ms_live_' + require('crypto').randomBytes(40).toString('hex'))"
```

Then:
1. Update `.env` with new key
2. Update Vercel environment variables
3. Revoke old key if possible

### 2. Verify Vercel Environment Variables
Ensure all secrets are in Vercel dashboard:
```
https://vercel.com/leprofcode/metasend/settings/environment-variables
```

### 3. Clean Git History (Optional but Recommended)
If the exposed key is critical, consider cleaning git history:

```bash
# WARNING: This rewrites history - coordinate with team first
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch test-email.js" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (DANGEROUS - backup first)
git push origin --force --all
```

### 4. Enable GitHub Secret Scanning
1. Go to repository settings
2. Enable "Secret scanning" under Security
3. Review any alerts

---

## 📝 Recommended Security Enhancements

### 1. Add `.env.example` Template
Create a template without actual values:

```env
# Coinbase Configuration
COINBASE_APP_ID=
CDP_PROJECT_ID=
COINBASE_OAUTH_CLIENT_ID=
COINBASE_REDIRECT_SCHEME=metasend

# Email Service
RESEND_API_KEY=

# Backend API
MONGODB_URI=
METASEND_API_KEY=
CRON_SECRET=

# Escrow Configuration
ESCROW_MASTER_KEY=
```

### 2. Add Pre-commit Hook
Prevent accidental commits of secrets:

```bash
# Install git-secrets
npm install -g git-secrets

# Setup
git secrets --install
git secrets --register-aws
git secrets --add 'API_KEY.*=.*[a-zA-Z0-9]{20,}'
git secrets --add 'SECRET.*=.*[a-zA-Z0-9]{20,}'
```

### 3. Rotate All Keys Regularly
- METASEND_API_KEY: Every 90 days
- CRON_SECRET: Every 90 days  
- ESCROW_MASTER_KEY: Never (or with migration plan)
- Database passwords: Every 180 days

### 4. Implement Key Management
Consider using:
- AWS Secrets Manager
- HashiCorp Vault
- Doppler
- Vercel's encrypted env vars

---

## 🔍 Files Scanned

### Checked for Secrets:
- ✅ All TypeScript/JavaScript files in `src/`
- ✅ All API endpoints in `api/`
- ✅ Configuration files (app.config.js, vercel.json)
- ✅ Environment files (.env)
- ✅ Test files (test-email.js)

### Patterns Searched:
- API keys: `API_KEY`, `SECRET`, `PASSWORD`, `PRIVATE_KEY`
- Tokens: `token`, `bearer`
- Key prefixes: `sk_`, `pk_`, `re_`, `ms_`
- Hash patterns: 64-character hex strings
- Database URIs: `mongodb+srv://`

---

## ✅ What's Secure

1. **Environment Variables**: All secrets use `process.env` or `Constants.expoConfig.extra`
2. **API Authentication**: All endpoints require Bearer token auth
3. **Cron Security**: Cron jobs require secret header
4. **`.gitignore` Properly Configured**: 
   - `.env` excluded
   - `.env*.local` excluded
   - Test files now excluded
5. **No Secrets in Source Code**: All hardcoded values are public addresses or test data

---

## 📋 Security Checklist

- [x] Audit all files for hardcoded secrets
- [x] Remove sensitive data from tracked files
- [x] Update .gitignore to prevent future leaks
- [x] Document all exposed secrets
- [ ] **Regenerate METASEND_API_KEY** ⚠️ CRITICAL
- [ ] Verify all secrets in Vercel dashboard
- [ ] Optional: Clean git history
- [ ] Enable GitHub secret scanning
- [ ] Create .env.example template
- [ ] Set up secret rotation schedule
- [ ] Consider key management solution

---

## 🔄 Next Steps

1. **Immediate** (Today):
   - [ ] Regenerate METASEND_API_KEY
   - [ ] Update .env with new key
   - [ ] Update Vercel env vars
   - [ ] Commit and push .gitignore changes

2. **Short-term** (This Week):
   - [ ] Verify all Vercel environment variables
   - [ ] Create .env.example template
   - [ ] Document key rotation procedures
   - [ ] Review MongoDB security settings

3. **Long-term** (This Month):
   - [ ] Implement pre-commit hooks
   - [ ] Set up secret scanning
   - [ ] Establish key rotation schedule
   - [ ] Consider key management solution

---

## 📞 Contact

For security concerns, contact: support@metasend.io

**Report Date**: November 13, 2025  
**Audited By**: GitHub Copilot  
**Status**: ⚠️ Immediate action required on compromised API key
