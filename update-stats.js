
"use strict";

// Official Brawl Stars API updater
// Requires Node.js 20+
// GitHub Secret: BRAWL_STARS_API_KEY

const fs = require("node:fs/promises");
const path = require("node:path");

const PLAYER_TAG = "2QR28RLQYG";
const API_BASE = "https://api.brawlstars.com/v1";
const OUTPUT_FILE = path.join(process.cwd(), "stats.json");

async function fetchPlayer() {
  const apiKey = process.env.BRAWL_STARS_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing GitHub Secret: BRAWL_STARS_API_KEY"
    );
  }

  // The tag must contain exactly one # in the URL.
  const encodedTag = encodeURIComponent("#" + PLAYER_TAG);
  const url = `${API_BASE}/players/${encodedTag}`;

  console.log("Fetching player from official Brawl Stars API...");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json"
    },
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(
      `Brawl Stars API HTTP ${response.status}: ` +
      `${details.slice(0, 300)}`
    );
  }

  const player = await response.json();

  if (
    !player ||
    typeof player.trophies !== "number"
  ) {
    throw new Error("The API response has no player trophies.");
  }

  if (
    player.tag &&
    player.tag.replace(/^#/, "").toUpperCase() !==
      PLAYER_TAG.toUpperCase()
  ) {
    throw new Error("The API returned a different player.");
  }

  return player;
}

async function main() {
  // Read existing stats without deleting other fields.
  const previous = JSON.parse(
    await fs.readFile(OUTPUT_FILE, "utf8")
  );

  const player = await fetchPlayer();

  const extracted = {
    trophies: player.trophies,
    playerTag: player.tag || "#" + PLAYER_TAG
  };

  if (typeof player.name === "string") {
    extracted.playerName = player.name;
  }

  if (Number.isFinite(player.expLevel)) {
    extracted.xpLevel = player.expLevel;
  }

  if (Number.isFinite(player.expPoints)) {
    extracted.xpPoints = player.expPoints;
  }

  if (Number.isFinite(player.victories)) {
    extracted.totalWins = player.victories;
  }

  if (Number.isFinite(player["3vs3Victories"])) {
    extracted.threeV3Wins = player["3vs3Victories"];
  }

  if (Number.isFinite(player.soloVictories)) {
    extracted.soloWins = player.soloVictories;
  }

  if (Number.isFinite(player.duoVictories)) {
    extracted.duoWins = player.duoVictories;
  }

  if (player.club && typeof player.club.name === "string") {
    extracted.clubName = player.club.name;
  }

  const next = {
    ...previous,
    ...extracted,
    updatedAt: new Date().toISOString(),
    sourceMessage: "Official Brawl Stars API"
  };

  const tempFile = OUTPUT_FILE + ".tmp";

  await fs.writeFile(
    tempFile,
    JSON.stringify(next, null, 2) + "\n",
    "utf8"
  );

  await fs.rename(tempFile, OUTPUT_FILE);

  console.log("SUCCESS: stats.json updated!");
  console.log("Player:", player.name || PLAYER_TAG);
  console.log("Trophies:", player.trophies);
  console.log("Updated fields:", Object.keys(extracted).join(", "));
}

main().catch(error => {
  console.error("UPDATE FAILED:", error.message);
  process.exitCode = 1;
});
