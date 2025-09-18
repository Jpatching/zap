# NZ:P Crypto Edition - Complete Deployment Guide

## Overview
This guide walks you through deploying the crypto-enabled version of Nazi Zombies: Portable with:
- Phantom wallet integration
- P2P multiplayer via WebRTC
- Solana-based rewards system
- Leaderboard tracking

## Prerequisites
- Node.js 18+
- Cloudflare account (for Workers)
- Phantom wallet
- Basic Solana knowledge

## Step 1: Deploy Rewards API

1. **Create Cloudflare KV namespace:**
   ```bash
   cd web/api
   npx wrangler kv:namespace create GAME_KV
   ```
   Note the ID and update `wrangler.toml`

2. **Set up secrets:**
   ```bash
   npx wrangler secret put TREASURY_PRIVATE_KEY
   ```

3. **Deploy the worker:**
   ```bash
   npm run deploy-api
   ```

4. **Note your worker URL** (e.g., `https://nzp-rewards.your-subdomain.workers.dev`)

## Step 2: Create ZAP Token (Optional)

If you want to use a custom SPL token:

1. Install Solana CLI tools
2. Create token:
   ```bash
   spl-token create-token
   # Note the token mint address

   spl-token create-account <TOKEN_MINT>
   # Note the token account

   spl-token mint <TOKEN_MINT> 1000000 <TOKEN_ACCOUNT>
   # Mint initial supply
   ```

3. Update `rewards-worker.js` with your token mint address

## Step 3: Build NZ:P with Crypto Support

1. **Clone and modify QuakeC:**
   ```bash
   git clone https://github.com/nzp-team/quakec.git
   cd quakec

   # Copy crypto integration
   cp ../../quakec-mod/crypto_integration.qc source/server/

   # Apply patches as described in CRYPTO_INTEGRATION_PATCH.md

   # Build
   cd tools
   ./qc.sh
   ```

2. **Update FTEQW for web:**
   - The WebGL build at nzp.gay needs to include the crypto HTML wrapper
   - Host `nzp-crypto.html` on your server

## Step 4: Configure Web Integration

1. **Update API endpoint in JavaScript files:**
   ```javascript
   // In phantom-integration.js, update:
   const API_URL = 'https://nzp-rewards.your-subdomain.workers.dev';
   ```

2. **Deploy web files:**
   ```bash
   # Copy web files to your hosting
   cp -r web/* /path/to/webserver/
   ```

## Step 5: Test the Integration

1. **Local testing:**
   ```bash
   cd web
   python3 -m http.server 8080
   ```
   Navigate to `http://localhost:8080/nzp-crypto.html`

2. **Test checklist:**
   - [ ] Connect Phantom wallet
   - [ ] Start solo game
   - [ ] Kill zombies and see crypto HUD update
   - [ ] Complete a round and check rewards
   - [ ] Create/join P2P multiplayer room
   - [ ] Check leaderboard

## Step 6: Production Deployment

1. **GitHub Pages (Simple):**
   ```bash
   # In your repo root
   git add .
   git commit -m "Add NZ:P Crypto Edition"
   git push origin main

   # Enable GitHub Pages in repo settings
   # Point to /web directory
   ```

2. **Custom domain:**
   - Point your domain to GitHub Pages
   - Update CORS settings in rewards API
   - Use HTTPS everywhere

## Step 7: Security Checklist

- [ ] API rate limiting configured
- [ ] Anti-cheat thresholds tested
- [ ] Treasury wallet secured (use multisig in production)
- [ ] CORS properly configured
- [ ] WebRTC STUN/TURN servers configured (for P2P)

## Environment Variables

Create `.env` file:
```
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
ZAP_TOKEN_MINT=YOUR_TOKEN_MINT
TREASURY_WALLET=YOUR_TREASURY_WALLET
CLOUDFLARE_ACCOUNT_ID=YOUR_ACCOUNT_ID
CLOUDFLARE_API_TOKEN=YOUR_API_TOKEN
```

## Monitoring

1. **Cloudflare Analytics:**
   - Monitor API usage
   - Check for suspicious patterns
   - Set up alerts

2. **Game Analytics:**
   - Track player counts
   - Monitor reward distribution
   - Check P2P connection success rates

## Troubleshooting

**Wallet won't connect:**
- Check if Phantom is installed
- Verify HTTPS is enabled
- Check console for errors

**P2P multiplayer issues:**
- Ensure PeerJS CDN is accessible
- Check firewall settings
- Try using custom TURN server

**Rewards not tracking:**
- Verify API endpoint is correct
- Check Cloudflare Worker logs
- Ensure QuakeC modifications are applied

## Next Steps

1. **Add more features:**
   - NFT rewards for achievements
   - Tournaments with prize pools
   - Cosmetic item marketplace

2. **Scale up:**
   - Add more regions for P2P servers
   - Implement WebRTC TURN servers
   - Use Solana RPC pool for reliability

3. **Community:**
   - Create Discord for players
   - Run events and competitions
   - Build modding support

## Support

- GitHub Issues: https://github.com/Jpatching/zap
- Discord: [Create your community server]
- Email: [Your contact]

---

**Remember:** This is a proof of concept. For production use, ensure proper security audits and testing!