
// update-stats.js
// Node.js 22 vai jaunāka versija.
// Uzmanību: trešo pušu vietņu HTML struktūra var mainīties.

const fs = require("node:fs/promises");
const path = require("node:path");

const PLAYER_TAG = "2QR28RLQYG";
const OUTPUT_FILE = path.join(process.cwd(), "stats.json");

const SOURCES = [
  {
    name: "Brawlytix",
    url: `https://brawlytix.com/player/${PLAYER_TAG}`
  },
  {
    name: "Brawl Time Ninja",
    url: `https://brawltime.ninja/profile/${PLAYER_TAG}`
  }
];

function htmlToText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value) {
  return Number(String(value).replace(/,/g, ""));
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseNumber(match[1]);
      if (Number.isFinite(value)) return value;
    }
  }
  return undefined;
}

function parseStats(html) {
  const text = htmlToText(html);
  const result = {};

  const fields = {
    trophies: [
      /Total Trophies\s*[:\-]?\s*([\d,]+)/i,
      /([\d,]+)\s+Trophies\b/i
    ],
    prestigeTrophies: [
      /Prestige Trophies\s*[:\-]?\s*([\d,]+)/i,
      /([\d,]+)\s+Prestige Trophies\b/i
    ],
    xpLevel: [
      /XP Level\s*[:\-]?\s*([\d,]+)/i,
      /Experience Level\s*[:\-]?\s*([\d,]+)/i
    ],
    xpPoints: [
      /XP Points\s*[:\-]?\s*([\d,]+)/i
    ],
    totalWins: [
      /Total Wins\s*[:\-]?\s*([\d,]+)/i
    ],
    threeV3Wins: [
      /3v3 Wins\s*[:\-]?\s*([\d,]+)/i,
      /3v3 Victories\s*[:\-]?\s*([\d,]+)/i
    ],
    soloWins: [
      /Solo Showdown Wins\s*[:\-]?\s*([\d,]+)/i,
      /Solo Wins\s*[:\-]?\s*([\d,]+)/i
    ],
    duoWins: [
      /Duo\/Trio Showdown Wins\s*[:\-]?\s*([\d,]+)/i,
      /Duo Wins\s*[:\-]?\s*([\d,]+)/i
    ],
    accountValue: [
      /Account Value\s*[:\-]?\s*([\d,]+)/i
    ],
    hoursSpent: [
      /Hours Spent\s*[:\-]?\s*([\d,]+)/i
    ],
    winsPerHour: [
      /Wins per Hour\s*[:\-]?\s*([\d.]+)/i
    ],
    elo: [
      /Highest ELO\s*[:\-]?\s*([\d,]+)/i,
      /Ranked ELO\s*[:\-]?\s*([\d,]+)/i
    ],
    skins: [
      /Skins Unlocked\s*[:\-]?\s*([\d,]+)/i
    ],
    fameCredits: [
      /Credits in Fame\s*[:\-]?\s*([\d,]+)/i
    ]
  };

  for (const [key, patterns] of Object.entries(fields)) {
    const value = firstMatch(text, patterns);
    if (value !== undefined) result[key] = value;
  }

  const winrate = text.match(/Win\s*rate\s*[:\-]?\s*([\d.]+)\s*%/i);
  if (winrate) result.winrate = Number(winrate[1]);

  const fame = text.match(
    /(Solar Fame\s*\d+|Saturnian Fame\s*\d+|Global Fame\s*\d+)/i
  );
  if (fame) result.fameLevel = fame[1].replace(/\s+/g, " ");

  return result;
}

async function fetchSource(source) {
  console.log(`Iegūstu datus: ${source.name}`);

  const response = await fetch(source.url, {
    headers: {
      "User-Agent": "Mozilla/5.0 GustavsBrawlStatsUpdater/1.0",
      "Accept": "text/html,application/xhtml+xml"
    },
    signal: AbortSignal.timeout(25000)
  });

  if (!response.ok) {
    throw new Error(`${source.name}: HTTP ${response.status}`);
  }

  return parseStats(await response.text());
}

async function main() {
  const previous = JSON.parse(
    await fs.readFile(OUTPUT_FILE, "utf8")
  );

  let extracted = {};
  const successfulSources = [];
  const errors = [];

  for (const source of SOURCES) {
    try {
      const stats = await fetchSource(source);
      const count = Object.keys(stats).length;

      console.log(`${source.name}: atrasti ${count} lauki`);

      if (count > 0) {
        extracted = { ...extracted, ...stats };
        successfulSources.push(source.name);
      }
    } catch (error) {
      const message = `${source.name}: ${error.message}`;
      errors.push(message);
      console.warn(message);
    }
  }

  if (Object.keys(extracted).length === 0) {
    throw new Error(
      "Neizdevās iegūt statistikas datus. Vecais stats.json saglabāts. " +
      errors.join(" | ")
    );
  }

  const next = {
    ...previous,
    ...extracted,
    playerTag: PLAYER_TAG,
    updatedAt: new Date().toISOString(),
    sourceMessage:
      "Automātiski atjaunoti lauki: " +
      successfulSources.join(", ") +
      (errors.length ? ". Brīdinājumi: " + errors.join(" | ") : ".")
  };

  const tempFile = OUTPUT_FILE + ".tmp";
  await fs.writeFile(tempFile, JSON.stringify(next, null, 2) + "\n");
  await fs.rename(tempFile, OUTPUT_FILE);

  console.log("stats.json ir atjaunināts.");
  console.log("Atjaunotie lauki:", Object.keys(extracted).join(", "));
}

main().catch(error => {
  console.error("ATJAUNINĀŠANA NEIZDEVĀS:", error.message);
  process.exitCode = 1;
});
