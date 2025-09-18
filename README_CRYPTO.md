# Nazi Zombies: Portable - Crypto Edition 🧟‍♂️💰

Transform the classic NZ:P experience into a Web3-enabled zombie-slaying adventure where every kill earns crypto rewards!

## Features

### 🎮 Core Gameplay
- Full NZ:P zombie survival experience
- P2P multiplayer (up to 4 players)
- No servers required - players host games directly

### 💰 Crypto Integration
- **Phantom Wallet** authentication
- **Earn ZAP tokens** for:
  - Zombie kills (0.01 ZAP/kill)
  - Round completion (1-10 ZAP based on performance)
  - Headshots & special kills (bonus rewards)
- Real-time reward tracking
- On-chain leaderboard

### 🌐 Web3 Features
- WebRTC peer-to-peer multiplayer
- Client-side game hosting
- Minimal backend (just rewards API)
- Gas-free gameplay (rewards distributed periodically)

## Quick Start

### Play Now
1. Install [Phantom Wallet](https://phantom.app/)
2. Visit `https://your-domain.com/nzp-crypto.html`
3. Connect wallet
4. Start earning!

### Host Your Own

```bash
# Clone the repository
git clone https://github.com/Jpatching/zap.git
cd zap

# Install dependencies
cd web
npm install

# Deploy rewards API
cd api
npx wrangler deploy

# Serve locally
cd ..
python3 -m http.server 8080
```

Visit `http://localhost:8080/nzp-crypto.html`

## How It Works

### P2P Multiplayer
- Host creates room, gets room code
- Players join using room code
- Direct peer-to-peer connection (no server needed)
- Host's browser manages game state

### Crypto Rewards
- Game tracks your kills and progress
- Rewards calculated in real-time
- Batch claimed to reduce transaction costs
- Anti-cheat mechanisms prevent farming

### Technology Stack
- **Game Engine:** FTEQW (Quake-based)
- **Multiplayer:** WebRTC via PeerJS
- **Blockchain:** Solana
- **Wallet:** Phantom
- **Backend:** Cloudflare Workers (serverless)

## Reward Structure

| Action | Reward | Notes |
|--------|--------|-------|
| Zombie Kill | 0.01 ZAP | Standard zombie |
| Headshot | +0.005 ZAP | Bonus reward |
| Round Complete | 1-10 ZAP | Scales with round number |
| Survival Bonus | 0.5 ZAP | Every 5 minutes |
| Daily Login | 5 ZAP | Once per day |

**Daily Cap:** 100 ZAP (anti-farming protection)

## Development

### Modify Game Logic
QuakeC modifications in `quakec-mod/`:
- `crypto_integration.qc` - Core crypto tracking
- See `CRYPTO_INTEGRATION_PATCH.md` for integration

### Customize Rewards
Edit `web/api/rewards-worker.js`:
- Adjust reward rates
- Add new reward types
- Modify anti-cheat thresholds

### Deploy Your Version
See `CRYPTO_DEPLOYMENT_GUIDE.md` for full instructions

## Security

- Client-authoritative with server validation
- Rate limiting prevents reward abuse
- Peer verification in multiplayer
- Regular anti-cheat updates

## Roadmap

- [ ] Mobile support
- [ ] NFT weapon skins
- [ ] Tournament mode
- [ ] Staking for bonus rewards
- [ ] Cross-game item compatibility

## Community

- Discord: [Join our server]
- Twitter: [@NZPCrypto]
- Reddit: [r/NZPCrypto]

## License

GPL-2.0 (same as original NZ:P)

## Credits

Built on top of the amazing [NZ:P](https://github.com/nzp-team/nzportable) project by the NZ:P Team.

---

**Note:** This is a community mod. Not affiliated with the original NZ:P team or Call of Duty.