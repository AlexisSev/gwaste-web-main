# Troubleshooting Guide - G-Waste Web Application

## Issues Fixed

### 1. ✅ Removed Incompatible Package
- **Issue**: `@tensorflow/tfjs-node` was in `package.json` but is a Node.js-only package that doesn't work in React/browser environments
- **Fix**: Removed from `package.json` (only `@tensorflow/tfjs` is needed for browser)

### 2. ✅ VAPID Key Configuration
- **Issue**: App was looking for `REACT_APP_VAPID_PUBLIC_KEY` environment variable
- **Fix**: Updated `App.js` to fallback to `window.VAPID_PUBLIC_KEY` which is already set in `supabaseClient.js`

## How to Run the Application

1. **Install Dependencies** (if not already done):
   ```bash
   npm install
   ```

2. **Create .env file** (optional but recommended):
   - Copy `.env.example` to `.env`
   - The VAPID key is already available in the code, but setting it in `.env` is cleaner

3. **Start the Development Server**:
   ```bash
   npm start
   ```

   The app should open automatically at `http://localhost:3000`

## Common Issues

### Port Already in Use
If port 3000 is already in use, React will ask if you want to use a different port. Type `Y` to confirm.

### Module Not Found Errors
If you see module not found errors:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Build Errors
If you encounter build errors:
1. Clear the build cache: `npm start -- --reset-cache`
2. Delete `node_modules` and reinstall

### Environment Variables Not Loading
- Make sure `.env` file is in the root directory (same level as `package.json`)
- Environment variables must start with `REACT_APP_` to be accessible in React
- Restart the dev server after creating/modifying `.env` file

## Dependencies Status

- ✅ All dependencies installed successfully
- ⚠️ Some deprecation warnings (normal, not critical)
- ⚠️ 16 vulnerabilities detected (run `npm audit` for details)

## Next Steps

1. Try running `npm start` to see if the app starts
2. If you encounter any errors, check the browser console and terminal output
3. The app requires a Supabase connection (already configured in `supabaseClient.js`)


