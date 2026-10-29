"use strict";

// Brawl Stars stats updater
// Node.js 20+
// API key: GitHub Actions Secret BRAWL_STARS_API_KEY

const fs = require("node:fs/promises");
const path = require("node:path");

const PLAYER_TAG = "#2QR28RLQYG";
const OUTPUT_FILE = path.join(process.cwd(), "stats.json");

const API_BASE = "https://bsproxy.royaleapi.dev/v1";

async function fetchPlayer() {
  const apiKey = process.env.BRAWL_STARS_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Trūkst BRAWL_STARS_API_KEY. " +
      "Pārbaudi GitHub Actions Secret un workflow env sadaļu."
    );
  }

  const encodedTag = encodeURIComponent("#" + PLAYER_TAG);
  const url = `${API_BASE}/players/${encodedTag}`;

  console.log("Iegūstu spēlētāja datus no Brawl Stars API...");

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json"
    },
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(
      `Brawl Stars API HTTP ${response.status}. ` +
      `Pārbaudi API atslēgu, atļauto IP un spēlētāja tagu. ` +
      details.slice(0, 300)
    );
  }

  const player = await response.json();

  if (!player || typeof player.trophies !== "number") {
    throw new Error(
      "API atbilde nesatur gaidītos spēlētāja datus."
    );
  }

  if (
    player.tag &&
    player.tag.replace(/^#/, "").toUpperCase() !==
      PLAYER_TAG.toUpperCase()
  ) {
    throw new Error(
      "API atgrieza cita spēlētāja datus. " +
      "stats.json netika mainīts."
    );
  }

  return player;
}

async function main() {
  // Nolasām iepriekšējos datus, lai saglabātu
  // laukus, kurus oficiālais API nenodrošina.
  const previous = JSON.parse(
    await fs.readFile(OUTPUT_FILE, "utf8")
  );

  const player = await fetchPlayer();

  // Atjaunojam tikai tos laukus, ko nodrošina API.
  // Pārējie stats.json lauki tiek saglabāti.
  const extracted = {
    trophies: player.trophies
  };

  if (Number.isFinite(player.expLevel)) {
    extracted.xpLevel = player.expLevel;
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

  if (typeof player.name === "string") {
    extracted.playerName = player.name;
  }

  if (typeof player.tag === "string") {
    extracted.playerTag = player.tag;
  } else {
    extracted.playerTag = PLAYER_TAG;
  }

  if (player.club && typeof player.club.name === "string") {
    extracted.clubName = player.club.name;
  }

  const next = {
    ...previous,
    ...extracted,
    updatedAt: new Date().toISOString(),
    sourceMessage:
      "Statistika atjaunota no oficiālā Brawl Stars API " +
      "caur RoyaleAPI proxy."
  };

  // Vispirms rakstām pagaidu failā.
  // Vecais stats.json paliek neskarts, ja rakstīšana neizdodas.
  const tempFile = OUTPUT_FILE + ".tmp";

  await fs.writeFile(
    tempFile,
    JSON.stringify(next, null, 2) + "\n",
    "utf8"
  );

  await fs.rename(tempFile, OUTPUT_FILE);

  console.log("SUCCESS: stats.json atjaunināts!");
  console.log("Spēlētājs:", player.name || PLAYER_TAG);
  console.log("Trofejas:", player.trophies);
  console.log("XP līmenis:", player.expLevel ?? "nav pieejams");
  console.log("Uzvaras:", player.victories ?? "nav pieejams");
  console.log("Atjauninātie lauki:", Object.keys(extracted).join(", "));
}

main().catch(error => {
  console.error("ATJAUNINĀŠANA NEIZDEVĀS:", error.message);
  process.exitCode = 1;
});
