/**
 * Phantom Wallet Integration for NZ:P
 * Handles wallet connection, authentication, and crypto tracking
 */

class PhantomIntegration {
    constructor() {
        this.provider = null;
        this.publicKey = null;
        this.isConnected = false;
        this.playerStats = {
            kills: 0,
            rounds: 0,
            totalScore: 0,
            rewardsEarned: 0
        };
    }

    async init() {
        // Check if Phantom is installed
        const isPhantomInstalled = window.phantom?.solana?.isPhantom;

        if (!isPhantomInstalled) {
            console.log("Phantom wallet not found!");
            return false;
        }

        this.provider = window.phantom.solana;

        // Check if already connected
        try {
            const resp = await this.provider.connect({ onlyIfTrusted: true });
            this.publicKey = resp.publicKey.toString();
            this.isConnected = true;
            this.onWalletConnected();
        } catch (err) {
            // Not connected yet
        }

        return true;
    }

    async connect() {
        if (!this.provider) {
            alert("Please install Phantom wallet!");
            window.open("https://phantom.app/", "_blank");
            return;
        }

        try {
            const resp = await this.provider.connect();
            this.publicKey = resp.publicKey.toString();
            this.isConnected = true;
            this.onWalletConnected();

            // Sign a message to verify ownership
            const message = `Sign this message to play NZ:P\nWallet: ${this.publicKey}\nTimestamp: ${Date.now()}`;
            const encodedMessage = new TextEncoder().encode(message);
            const signature = await this.provider.signMessage(encodedMessage, "utf8");

            // Store in game
            this.storeWalletInGame();

            return this.publicKey;
        } catch (err) {
            console.error("Failed to connect:", err);
            return null;
        }
    }

    disconnect() {
        if (this.provider) {
            this.provider.disconnect();
            this.publicKey = null;
            this.isConnected = false;
            this.onWalletDisconnected();
        }
    }

    onWalletConnected() {
        // Update UI
        const connectBtn = document.getElementById('phantom-connect-btn');
        if (connectBtn) {
            connectBtn.textContent = `Connected: ${this.publicKey.slice(0, 4)}...${this.publicKey.slice(-4)}`;
            connectBtn.disabled = true;
        }

        // Show crypto HUD
        this.showCryptoHUD();
    }

    onWalletDisconnected() {
        const connectBtn = document.getElementById('phantom-connect-btn');
        if (connectBtn) {
            connectBtn.textContent = 'Connect Wallet';
            connectBtn.disabled = false;
        }

        this.hideCryptoHUD();
    }

    storeWalletInGame() {
        // Call into the game engine
        if (window.Module && window.Module.ccall) {
            window.Module.ccall('SetPlayerWallet', null, ['string'], [this.publicKey]);
        }
    }

    showCryptoHUD() {
        const hud = document.getElementById('crypto-hud');
        if (!hud) {
            const hudElement = document.createElement('div');
            hudElement.id = 'crypto-hud';
            hudElement.innerHTML = `
                <div class="crypto-stats">
                    <div>Wallet: ${this.publicKey.slice(0, 6)}...${this.publicKey.slice(-4)}</div>
                    <div>Kills: <span id="crypto-kills">0</span></div>
                    <div>Rounds: <span id="crypto-rounds">0</span></div>
                    <div>Rewards: <span id="crypto-rewards">0</span> ZAP</div>
                </div>
            `;
            document.body.appendChild(hudElement);
        }
    }

    hideCryptoHUD() {
        const hud = document.getElementById('crypto-hud');
        if (hud) {
            hud.remove();
        }
    }

    // Game event handlers
    onZombieKill() {
        this.playerStats.kills++;
        this.updateHUD();

        // Batch send every 10 kills
        if (this.playerStats.kills % 10 === 0) {
            this.sendKillUpdate();
        }
    }

    onRoundComplete(roundNumber, score) {
        this.playerStats.rounds = roundNumber;
        this.playerStats.totalScore = score;
        this.updateHUD();
        this.sendRoundUpdate(roundNumber, score);
    }

    updateHUD() {
        document.getElementById('crypto-kills').textContent = this.playerStats.kills;
        document.getElementById('crypto-rounds').textContent = this.playerStats.rounds;
        document.getElementById('crypto-rewards').textContent = this.playerStats.rewardsEarned.toFixed(2);
    }

    async sendKillUpdate() {
        if (!this.isConnected) return;

        try {
            const response = await fetch('https://nzp-rewards.workers.dev/kills', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    wallet: this.publicKey,
                    kills: this.playerStats.kills,
                    timestamp: Date.now()
                })
            });

            if (response.ok) {
                const data = await response.json();
                this.playerStats.rewardsEarned = data.totalRewards || 0;
                this.updateHUD();
            }
        } catch (err) {
            console.error('Failed to send kill update:', err);
        }
    }

    async sendRoundUpdate(round, score) {
        if (!this.isConnected) return;

        try {
            const response = await fetch('https://nzp-rewards.workers.dev/round', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    wallet: this.publicKey,
                    round: round,
                    score: score,
                    timestamp: Date.now()
                })
            });

            if (response.ok) {
                const data = await response.json();
                this.playerStats.rewardsEarned = data.totalRewards || 0;
                this.updateHUD();
            }
        } catch (err) {
            console.error('Failed to send round update:', err);
        }
    }
}

// Initialize on page load
const phantomIntegration = new PhantomIntegration();

// Export for game engine
window.NZPCrypto = {
    phantom: phantomIntegration,
    onZombieKill: () => phantomIntegration.onZombieKill(),
    onRoundComplete: (round, score) => phantomIntegration.onRoundComplete(round, score),
    connect: () => phantomIntegration.connect(),
    disconnect: () => phantomIntegration.disconnect(),
    getWallet: () => phantomIntegration.publicKey
};