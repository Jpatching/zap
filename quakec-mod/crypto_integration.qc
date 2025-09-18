/*
	crypto_integration.qc

	Crypto tracking integration for NZ:P
	Tracks zombie kills and round completions for Web3 rewards
*/

// Global crypto tracking variables
entity crypto_tracker;
float total_crypto_kills;
float last_crypto_sync_time;
.string wallet_address;
.float crypto_kills;
.float crypto_rounds;

// Initialize crypto tracking system
void() Crypto_Init =
{
	crypto_tracker = spawn();
	crypto_tracker.classname = "crypto_tracker";
	total_crypto_kills = 0;
	last_crypto_sync_time = time;
};

// Set player wallet address
void(entity player, string wallet) Crypto_SetWallet =
{
	if (!player || player.classname != "player")
		return;

	player.wallet_address = wallet;
	player.crypto_kills = 0;
	player.crypto_rounds = 0;

	// Notify web client
	#ifdef FTE
	if (checkextension("FTE_CSQC_SKELETONOBJECTS")) {
		localcmd(sprintf("web_event wallet_connected %s\n", wallet));
	}
	#endif
};

// Track zombie kill for crypto rewards
void(entity attacker, entity zombie) Crypto_TrackZombieKill =
{
	if (!attacker || attacker.classname != "player")
		return;

	if (!zombie || !zombie.iszomb)
		return;

	// Only track if player has wallet connected
	if (!attacker.wallet_address || attacker.wallet_address == "")
		return;

	attacker.crypto_kills += 1;
	total_crypto_kills += 1;

	// Send event to web client for crypto tracking
	#ifdef FTE
	if (checkextension("FTE_CSQC_SKELETONOBJECTS")) {
		localcmd(sprintf("web_event zombie_kill %s %f\n",
			attacker.wallet_address, attacker.crypto_kills));
	}
	#endif

	// Batch sync every 10 kills
	if ((attacker.crypto_kills % 10) == 0) {
		Crypto_SyncKills(attacker);
	}
};

// Track round completion for crypto rewards
void(float round_num) Crypto_TrackRoundComplete =
{
	entity player;

	// Track for all players
	player = find(world, classname, "player");
	while (player) {
		if (player.wallet_address && player.wallet_address != "") {
			player.crypto_rounds = round_num;

			#ifdef FTE
			if (checkextension("FTE_CSQC_SKELETONOBJECTS")) {
				localcmd(sprintf("web_event round_complete %s %f %f\n",
					player.wallet_address, round_num, player.score));
			}
			#endif
		}

		player = find(player, classname, "player");
	}
};

// Sync kills to backend
void(entity player) Crypto_SyncKills =
{
	if (!player.wallet_address || player.wallet_address == "")
		return;

	#ifdef FTE
	if (checkextension("FTE_CSQC_SKELETONOBJECTS")) {
		localcmd(sprintf("web_event sync_kills %s %f %f\n",
			player.wallet_address, player.crypto_kills, time));
	}
	#endif
};

// Called when player connects/disconnects
void(entity player) Crypto_PlayerConnect =
{
	player.crypto_kills = 0;
	player.crypto_rounds = 0;
	player.wallet_address = "";
};

void(entity player) Crypto_PlayerDisconnect =
{
	if (player.wallet_address && player.wallet_address != "") {
		Crypto_SyncKills(player);
	}
};

// Integrate with existing score system
void(entity who, float value) Crypto_ScoreHook =
{
	// Called from Player_ChangeScore when points are earned
	if (who.wallet_address && who.wallet_address != "" && value > 0) {
		#ifdef FTE
		if (checkextension("FTE_CSQC_SKELETONOBJECTS")) {
			localcmd(sprintf("web_event score_earned %s %f\n",
				who.wallet_address, value));
		}
		#endif
	}
};

// Console command handlers for web integration
void() Crypto_Cmd_SetWallet =
{
	if (cmd_argc() < 2) {
		sprint(self, PRINT_HIGH, "Usage: setwallet <address>\n");
		return;
	}

	Crypto_SetWallet(self, cmd_argv(1));
	sprint(self, PRINT_HIGH, sprintf("Wallet set to: %s\n", self.wallet_address));
};

void() Crypto_Cmd_Stats =
{
	if (!self.wallet_address || self.wallet_address == "") {
		sprint(self, PRINT_HIGH, "No wallet connected!\n");
		return;
	}

	sprint(self, PRINT_HIGH, sprintf("Crypto Stats:\n"));
	sprint(self, PRINT_HIGH, sprintf("Wallet: %s\n", self.wallet_address));
	sprint(self, PRINT_HIGH, sprintf("Kills: %f\n", self.crypto_kills));
	sprint(self, PRINT_HIGH, sprintf("Rounds: %f\n", self.crypto_rounds));
	sprint(self, PRINT_HIGH, sprintf("Score: %f\n", self.score));
};