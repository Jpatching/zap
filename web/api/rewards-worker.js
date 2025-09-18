/**
 * NZ:P Rewards API - Cloudflare Worker
 * Handles crypto reward tracking and distribution
 */

import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';

// Configuration
const SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com';
const ZAP_TOKEN_MINT = 'YOUR_ZAP_TOKEN_MINT_ADDRESS'; // Replace with actual token mint
const TREASURY_WALLET = 'YOUR_TREASURY_WALLET_ADDRESS'; // Replace with treasury wallet
const TREASURY_PRIVATE_KEY = 'YOUR_TREASURY_PRIVATE_KEY'; // Store in Cloudflare secrets

// Reward rates
const REWARDS = {
  KILL_ZOMBIE: 0.01,      // 0.01 ZAP per kill
  ROUND_COMPLETE: 1,      // 1 ZAP per round
  HEADSHOT_BONUS: 0.005,  // Extra 0.005 ZAP for headshots
  SURVIVAL_BONUS: 0.5,    // 0.5 ZAP per 5 minutes survived
};

// Anti-cheat thresholds
const LIMITS = {
  MAX_KILLS_PER_MINUTE: 20,
  MAX_ROUNDS_PER_HOUR: 10,
  MAX_DAILY_REWARDS: 100,
};

// Initialize Solana connection
const connection = new Connection(SOLANA_RPC_URL);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Enable CORS
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    try {
      switch (path) {
        case '/kills':
          return await handleKills(request, env, headers);
        case '/round':
          return await handleRoundComplete(request, env, headers);
        case '/leaderboard':
          return await handleLeaderboard(request, env, headers);
        case '/claim':
          return await handleClaimRewards(request, env, headers);
        case '/balance':
          return await handleGetBalance(request, env, headers);
        default:
          return new Response(JSON.stringify({ error: 'Not found' }), {
            status: 404,
            headers,
          });
      }
    } catch (error) {
      console.error('Error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers,
      });
    }
  },
};

async function handleKills(request, env, headers) {
  const data = await request.json();
  const { wallet, kills, timestamp } = data;

  if (!wallet || !kills) {
    return new Response(JSON.stringify({ error: 'Missing parameters' }), {
      status: 400,
      headers,
    });
  }

  // Get or create player record
  const playerKey = `player:${wallet}`;
  const player = await env.GAME_KV.get(playerKey, 'json') || {
    wallet,
    totalKills: 0,
    totalRounds: 0,
    totalRewards: 0,
    lastKillTime: 0,
    dailyRewards: 0,
    lastRewardDate: new Date().toDateString(),
  };

  // Anti-cheat: Check kill rate
  const timeDiff = (timestamp - player.lastKillTime) / 1000 / 60; // minutes
  const killsSinceLastUpdate = kills - player.totalKills;

  if (timeDiff > 0 && killsSinceLastUpdate / timeDiff > LIMITS.MAX_KILLS_PER_MINUTE) {
    return new Response(JSON.stringify({
      error: 'Suspicious activity detected',
      totalRewards: player.totalRewards
    }), {
      status: 429,
      headers,
    });
  }

  // Reset daily rewards if new day
  if (player.lastRewardDate !== new Date().toDateString()) {
    player.dailyRewards = 0;
    player.lastRewardDate = new Date().toDateString();
  }

  // Calculate rewards
  const newKills = kills - player.totalKills;
  const rewardAmount = newKills * REWARDS.KILL_ZOMBIE;

  // Check daily limit
  if (player.dailyRewards + rewardAmount > LIMITS.MAX_DAILY_REWARDS) {
    return new Response(JSON.stringify({
      error: 'Daily reward limit reached',
      totalRewards: player.totalRewards
    }), {
      status: 429,
      headers,
    });
  }

  // Update player stats
  player.totalKills = kills;
  player.totalRewards += rewardAmount;
  player.dailyRewards += rewardAmount;
  player.lastKillTime = timestamp;

  // Save to KV store
  await env.GAME_KV.put(playerKey, JSON.stringify(player));

  // Update leaderboard
  await updateLeaderboard(env, wallet, player.totalRewards);

  return new Response(JSON.stringify({
    success: true,
    rewardEarned: rewardAmount,
    totalRewards: player.totalRewards,
    totalKills: player.totalKills,
  }), { headers });
}

async function handleRoundComplete(request, env, headers) {
  const data = await request.json();
  const { wallet, round, score, timestamp } = data;

  if (!wallet || !round) {
    return new Response(JSON.stringify({ error: 'Missing parameters' }), {
      status: 400,
      headers,
    });
  }

  // Get player record
  const playerKey = `player:${wallet}`;
  const player = await env.GAME_KV.get(playerKey, 'json') || {
    wallet,
    totalKills: 0,
    totalRounds: 0,
    totalRewards: 0,
    lastRoundTime: 0,
    roundsThisHour: [],
  };

  // Anti-cheat: Check round completion rate
  const currentHour = Math.floor(timestamp / 3600000);
  player.roundsThisHour = player.roundsThisHour.filter(h => h === currentHour);

  if (player.roundsThisHour.length >= LIMITS.MAX_ROUNDS_PER_HOUR) {
    return new Response(JSON.stringify({
      error: 'Too many rounds completed this hour',
      totalRewards: player.totalRewards
    }), {
      status: 429,
      headers,
    });
  }

  // Calculate rewards (more rewards for higher rounds)
  const baseReward = REWARDS.ROUND_COMPLETE;
  const roundMultiplier = 1 + (round * 0.1); // 10% more per round
  const rewardAmount = baseReward * roundMultiplier;

  // Update player stats
  player.totalRounds = Math.max(player.totalRounds, round);
  player.totalRewards += rewardAmount;
  player.lastRoundTime = timestamp;
  player.roundsThisHour.push(currentHour);

  // Bonus for high scores
  if (score > 10000) {
    const bonusReward = REWARDS.SURVIVAL_BONUS;
    player.totalRewards += bonusReward;
  }

  // Save to KV store
  await env.GAME_KV.put(playerKey, JSON.stringify(player));

  // Update leaderboard
  await updateLeaderboard(env, wallet, player.totalRewards);

  return new Response(JSON.stringify({
    success: true,
    rewardEarned: rewardAmount,
    totalRewards: player.totalRewards,
    highestRound: player.totalRounds,
  }), { headers });
}

async function handleLeaderboard(request, env, headers) {
  const leaderboardKey = 'leaderboard:global';
  const leaderboard = await env.GAME_KV.get(leaderboardKey, 'json') || [];

  // Sort by total rewards
  leaderboard.sort((a, b) => b.rewards - a.rewards);

  // Return top 100
  const top100 = leaderboard.slice(0, 100).map((entry, index) => ({
    rank: index + 1,
    wallet: entry.wallet,
    totalRewards: entry.rewards,
  }));

  return new Response(JSON.stringify({
    leaderboard: top100,
    totalPlayers: leaderboard.length,
  }), { headers });
}

async function handleGetBalance(request, env, headers) {
  const url = new URL(request.url);
  const wallet = url.searchParams.get('wallet');

  if (!wallet) {
    return new Response(JSON.stringify({ error: 'Missing wallet parameter' }), {
      status: 400,
      headers,
    });
  }

  const playerKey = `player:${wallet}`;
  const player = await env.GAME_KV.get(playerKey, 'json');

  if (!player) {
    return new Response(JSON.stringify({
      wallet,
      totalRewards: 0,
      claimedRewards: 0,
      pendingRewards: 0,
    }), { headers });
  }

  return new Response(JSON.stringify({
    wallet: player.wallet,
    totalRewards: player.totalRewards,
    claimedRewards: player.claimedRewards || 0,
    pendingRewards: player.totalRewards - (player.claimedRewards || 0),
    stats: {
      totalKills: player.totalKills,
      highestRound: player.totalRounds,
    }
  }), { headers });
}

async function handleClaimRewards(request, env, headers) {
  const data = await request.json();
  const { wallet } = data;

  if (!wallet) {
    return new Response(JSON.stringify({ error: 'Missing wallet parameter' }), {
      status: 400,
      headers,
    });
  }

  const playerKey = `player:${wallet}`;
  const player = await env.GAME_KV.get(playerKey, 'json');

  if (!player) {
    return new Response(JSON.stringify({ error: 'Player not found' }), {
      status: 404,
      headers,
    });
  }

  const pendingRewards = player.totalRewards - (player.claimedRewards || 0);

  if (pendingRewards <= 0) {
    return new Response(JSON.stringify({ error: 'No pending rewards' }), {
      status: 400,
      headers,
    });
  }

  // TODO: Implement actual Solana token transfer here
  // For now, just mark as claimed
  player.claimedRewards = player.totalRewards;
  await env.GAME_KV.put(playerKey, JSON.stringify(player));

  return new Response(JSON.stringify({
    success: true,
    claimed: pendingRewards,
    transaction: 'MOCK_TX_' + Date.now(), // Replace with actual tx signature
  }), { headers });
}

async function updateLeaderboard(env, wallet, totalRewards) {
  const leaderboardKey = 'leaderboard:global';
  let leaderboard = await env.GAME_KV.get(leaderboardKey, 'json') || [];

  // Find or add player
  const existingIndex = leaderboard.findIndex(entry => entry.wallet === wallet);

  if (existingIndex >= 0) {
    leaderboard[existingIndex].rewards = totalRewards;
  } else {
    leaderboard.push({ wallet, rewards: totalRewards });
  }

  // Keep only top 1000 to limit size
  leaderboard.sort((a, b) => b.rewards - a.rewards);
  leaderboard = leaderboard.slice(0, 1000);

  await env.GAME_KV.put(leaderboardKey, JSON.stringify(leaderboard));
}