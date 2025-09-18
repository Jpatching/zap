/**
 * P2P Multiplayer for NZ:P using WebRTC/PeerJS
 * Enables peer-to-peer game sessions without dedicated servers
 */

class P2PMultiplayer {
    constructor() {
        this.peer = null;
        this.connections = {};
        this.isHost = false;
        this.roomCode = null;
        this.peerId = null;
        this.maxPlayers = 4;
        this.gameState = {
            players: {},
            round: 1,
            zombiesKilled: 0
        };
    }

    async init() {
        // Initialize PeerJS with custom server or use default
        this.peer = new Peer({
            // Can use custom PeerJS server or default
            // host: 'nzp-peer.herokuapp.com',
            // port: 443,
            // secure: true,
            debug: 2
        });

        this.setupPeerHandlers();
        return new Promise((resolve) => {
            this.peer.on('open', (id) => {
                this.peerId = id;
                console.log('P2P initialized with ID:', id);
                resolve(id);
            });
        });
    }

    setupPeerHandlers() {
        this.peer.on('connection', (conn) => {
            console.log('Incoming connection from:', conn.peer);
            this.handleConnection(conn);
        });

        this.peer.on('error', (err) => {
            console.error('P2P Error:', err);
            this.showError(err.message);
        });
    }

    handleConnection(conn) {
        conn.on('open', () => {
            // Add to connections
            this.connections[conn.peer] = conn;

            // Send current game state to new player
            if (this.isHost) {
                conn.send({
                    type: 'gameState',
                    data: this.gameState
                });
            }

            // Update player count UI
            this.updatePlayerCount();
        });

        conn.on('data', (data) => {
            this.handleMessage(data, conn);
        });

        conn.on('close', () => {
            delete this.connections[conn.peer];
            if (this.gameState.players[conn.peer]) {
                delete this.gameState.players[conn.peer];
            }
            this.updatePlayerCount();
        });
    }

    createRoom() {
        this.isHost = true;
        this.roomCode = this.generateRoomCode();

        // Add self to game state
        this.gameState.players[this.peerId] = {
            id: this.peerId,
            wallet: window.NZPCrypto?.getWallet() || 'anonymous',
            kills: 0,
            deaths: 0,
            score: 0,
            position: { x: 0, y: 0, z: 0 }
        };

        this.showRoomCode();
        this.startHostSync();

        return this.roomCode;
    }

    async joinRoom(hostId) {
        if (Object.keys(this.connections).length >= this.maxPlayers - 1) {
            throw new Error('Room is full');
        }

        const conn = this.peer.connect(hostId, { reliable: true });

        return new Promise((resolve, reject) => {
            conn.on('open', () => {
                this.connections[hostId] = conn;
                this.handleConnection(conn);

                // Send join request
                conn.send({
                    type: 'join',
                    data: {
                        id: this.peerId,
                        wallet: window.NZPCrypto?.getWallet() || 'anonymous'
                    }
                });

                resolve();
            });

            conn.on('error', reject);
        });
    }

    handleMessage(message, conn) {
        switch (message.type) {
            case 'join':
                if (this.isHost) {
                    this.handlePlayerJoin(message.data, conn);
                }
                break;

            case 'gameState':
                this.syncGameState(message.data);
                break;

            case 'playerUpdate':
                this.updatePlayer(message.data);
                break;

            case 'zombieKill':
                this.handleZombieKill(message.data);
                break;

            case 'roundComplete':
                this.handleRoundComplete(message.data);
                break;

            case 'chat':
                this.displayChat(message.data);
                break;
        }
    }

    handlePlayerJoin(playerData, conn) {
        if (Object.keys(this.gameState.players).length >= this.maxPlayers) {
            conn.send({
                type: 'error',
                data: 'Room is full'
            });
            return;
        }

        // Add player to game state
        this.gameState.players[playerData.id] = {
            ...playerData,
            kills: 0,
            deaths: 0,
            score: 0,
            position: { x: 0, y: 0, z: 0 }
        };

        // Broadcast to all other players
        this.broadcast({
            type: 'playerJoined',
            data: playerData
        }, conn.peer);

        // Send full game state to new player
        conn.send({
            type: 'gameState',
            data: this.gameState
        });
    }

    updatePlayer(playerData) {
        if (this.gameState.players[playerData.id]) {
            Object.assign(this.gameState.players[playerData.id], playerData);

            // Update in game engine
            if (window.Module && window.Module.ccall) {
                window.Module.ccall('UpdateNetPlayer', null,
                    ['string', 'number', 'number', 'number'],
                    [playerData.id, playerData.position.x, playerData.position.y, playerData.position.z]
                );
            }
        }
    }

    handleZombieKill(data) {
        const player = this.gameState.players[data.playerId];
        if (player) {
            player.kills++;
            player.score += data.points || 100;
            this.gameState.zombiesKilled++;

            // Update crypto tracking
            if (player.wallet !== 'anonymous' && player.id === this.peerId) {
                window.NZPCrypto?.onZombieKill();
            }

            // Broadcast if host
            if (this.isHost) {
                this.broadcast({
                    type: 'scoreUpdate',
                    data: {
                        playerId: data.playerId,
                        kills: player.kills,
                        score: player.score
                    }
                });
            }
        }
    }

    handleRoundComplete(data) {
        this.gameState.round = data.round;

        // Trigger crypto rewards for all players
        Object.values(this.gameState.players).forEach(player => {
            if (player.wallet !== 'anonymous' && player.id === this.peerId) {
                window.NZPCrypto?.onRoundComplete(data.round, player.score);
            }
        });
    }

    broadcast(message, exclude = null) {
        Object.entries(this.connections).forEach(([peerId, conn]) => {
            if (peerId !== exclude && conn.open) {
                conn.send(message);
            }
        });
    }

    // Game engine integration
    sendPlayerPosition(x, y, z) {
        const update = {
            type: 'playerUpdate',
            data: {
                id: this.peerId,
                position: { x, y, z }
            }
        };

        this.broadcast(update);
    }

    sendZombieKill(points = 100) {
        const killData = {
            type: 'zombieKill',
            data: {
                playerId: this.peerId,
                points: points,
                timestamp: Date.now()
            }
        };

        if (this.isHost) {
            this.handleZombieKill(killData.data);
        } else {
            // Send to host
            const hostConn = Object.values(this.connections)[0];
            if (hostConn) {
                hostConn.send(killData);
            }
        }
    }

    sendRoundComplete(roundNumber) {
        if (this.isHost) {
            const roundData = {
                type: 'roundComplete',
                data: {
                    round: roundNumber,
                    timestamp: Date.now()
                }
            };

            this.handleRoundComplete(roundData.data);
            this.broadcast(roundData);
        }
    }

    // UI Methods
    generateRoomCode() {
        // Use peer ID for simplicity, or generate custom code
        return this.peerId.substr(0, 6).toUpperCase();
    }

    showRoomCode() {
        const roomInfo = document.createElement('div');
        roomInfo.className = 'p2p-room-info';
        roomInfo.innerHTML = `
            <div>Room Code: <span class="p2p-room-code">${this.roomCode}</span></div>
            <div>Players: <span id="player-count">1</span>/${this.maxPlayers}</div>
            <div>Host ID: ${this.peerId}</div>
        `;
        document.body.appendChild(roomInfo);
    }

    updatePlayerCount() {
        const count = Object.keys(this.gameState.players).length;
        const countElement = document.getElementById('player-count');
        if (countElement) {
            countElement.textContent = count;
        }
    }

    showError(message) {
        const error = document.createElement('div');
        error.className = 'p2p-error';
        error.textContent = `P2P Error: ${message}`;
        error.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #ff4444;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 10001;
        `;
        document.body.appendChild(error);

        setTimeout(() => error.remove(), 5000);
    }

    // Host sync loop
    startHostSync() {
        if (!this.isHost) return;

        setInterval(() => {
            // Sync game state every second
            this.broadcast({
                type: 'gameState',
                data: this.gameState
            });
        }, 1000);
    }

    syncGameState(state) {
        this.gameState = state;

        // Update local game engine
        if (window.Module && window.Module.ccall) {
            window.Module.ccall('SyncGameState', null,
                ['string'],
                [JSON.stringify(state)]
            );
        }
    }

    displayChat(data) {
        // Implement chat display
        console.log(`[${data.sender}]: ${data.message}`);
    }

    disconnect() {
        Object.values(this.connections).forEach(conn => conn.close());
        this.connections = {};

        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }

        // Remove UI elements
        document.querySelectorAll('.p2p-room-info').forEach(el => el.remove());
    }
}

// Initialize and export
const p2pMultiplayer = new P2PMultiplayer();

window.NZPP2P = {
    multiplayer: p2pMultiplayer,
    init: () => p2pMultiplayer.init(),
    createRoom: () => p2pMultiplayer.createRoom(),
    joinRoom: (hostId) => p2pMultiplayer.joinRoom(hostId),
    sendPosition: (x, y, z) => p2pMultiplayer.sendPlayerPosition(x, y, z),
    sendKill: (points) => p2pMultiplayer.sendZombieKill(points),
    sendRoundComplete: (round) => p2pMultiplayer.sendRoundComplete(round),
    disconnect: () => p2pMultiplayer.disconnect()
};