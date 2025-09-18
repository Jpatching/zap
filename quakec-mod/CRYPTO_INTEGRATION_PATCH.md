# NZ:P Crypto Integration Patch

This patch integrates crypto tracking into the existing QuakeC codebase.

## Files to Modify

### 1. `source/server/player/player_core.qc`

Add crypto hook to `Player_ChangeScore` function (around line 318):

```c
// Append the value to our current score.
who.points += value;

// CRYPTO: Track score changes for rewards
Crypto_ScoreHook(who, value);
```

### 2. `source/server/ai/zombie_core.qc`

In the zombie death functions, add crypto tracking. Find `Zombie_Death` function and add:

```c
void(entity ent) Zombie_Death_Cleanup = {
    // ... existing code ...

    // CRYPTO: Track zombie kill
    if (ent.enemy && ent.enemy.classname == "player") {
        Crypto_TrackZombieKill(ent.enemy, ent);
    }
}
```

### 3. `source/server/rounds.qc`

In the round completion code, add:

```c
void() EndRound = {
    // ... existing code ...

    // CRYPTO: Track round completion
    Crypto_TrackRoundComplete(rounds);
}
```

### 4. `source/server/main.qc`

In `worldspawn()` function, add crypto initialization:

```c
void() worldspawn = {
    // ... existing code ...

    // Initialize crypto tracking
    Crypto_Init();
}
```

### 5. `source/server/player/player_core.qc`

Add to `PlayerConnect()`:

```c
void() PlayerConnect = {
    // ... existing code ...

    // Initialize crypto tracking for player
    Crypto_PlayerConnect(self);
}
```

Add to `PlayerDisconnect()`:

```c
void() PlayerDisconnect = {
    // ... existing code ...

    // Sync crypto stats before disconnect
    Crypto_PlayerDisconnect(self);
}
```

### 6. `source/server/utilities/command_parser.qc`

Add new commands to the command table:

```c
command_t command_table[] = {
    // ... existing commands ...
    {"setwallet", Crypto_Cmd_SetWallet, true, "Usage: setwallet <address>\n  Sets your Phantom wallet address for crypto rewards.\n"},
    {"cryptostats", Crypto_Cmd_Stats, true, "Usage: cryptostats\n  Shows your current crypto earnings stats.\n"},
}
```

### 7. `progs/fte.src` or equivalent source list

Add the crypto integration file:

```
source/server/crypto_integration.qc
```

## Web Integration

The QuakeC code sends events via `localcmd` that can be captured by the FTEQW web build:

```javascript
// In the FTEQW JavaScript wrapper
Module.onRuntimeInitialized = function() {
    // Override localcmd to capture crypto events
    const originalLocalCmd = Module.cwrap('localcmd', null, ['string']);

    Module.localcmd = function(cmd) {
        if (cmd.startsWith('web_event')) {
            const parts = cmd.split(' ');
            const event = parts[1];
            const wallet = parts[2];
            const data = parts.slice(3);

            // Send to crypto tracking
            window.NZPCrypto[event](wallet, ...data);
        }

        return originalLocalCmd(cmd);
    };
};
```

## Build Instructions

1. Copy `crypto_integration.qc` to `source/server/`
2. Apply the patches to the files listed above
3. Rebuild the QuakeC code:
   ```bash
   cd tools
   ./qc.sh
   ```
4. The generated `.dat` files will include crypto tracking

## Testing

1. Connect a Phantom wallet in the web version
2. Use console command: `setwallet <your_wallet_address>`
3. Kill zombies and check console for crypto events
4. Use `cryptostats` to view your stats