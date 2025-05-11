const SteamUser = require("steam-user");
const GlobalOffensive = require("globaloffensive");

const steamCreds = {
  accountName: process.env.STEAM_BOT_USERNAME,
  password: process.env.STEAM_BOT_PASSWORD,
  twoFactorCode: process.env.STEAM_GUARD_CODE,
};

function getCS2RankFromSteam(steamId) {
  return new Promise((resolve, reject) => {
    console.log("[Steam] Starting rank fetch for Steam ID:", steamId);

    const client = new SteamUser();
    const csgo = new GlobalOffensive(client);

    let profileRequested = false;

    client.logOn(steamCreds);

    client.on("loggedOn", () => {
      console.log("[Steam] Logged into Steam.");
      client.gamesPlayed(730);
    });

    csgo.on("connectedToGC", () => {
      console.log("[Steam] Connected to CS2 Game Coordinator.");
      csgo.requestPlayersProfile(steamId);
      profileRequested = true;
    });

    csgo.on("playersProfile", (profile) => {
      console.log(
        "[Steam] Received profile data:",
        JSON.stringify(profile, null, 2)
      );

      const premier = profile.rankings?.find((r) => r.rank_type_id === 11);
      const rank = premier?.rank_id || "Unavailable";

      client.logOff();
      resolve(rank);
    });

    csgo.on("error", (err) => {
      console.error("[Steam] GC error:", err);
      client.logOff();
      reject(err);
    });

    // Timeout handling
    setTimeout(() => {
      if (!profileRequested) {
        console.error("[Steam] Timeout: Never connected to GC.");
      } else {
        console.error("[Steam] Timeout: No profile received.");
      }
      client.logOff();
      resolve("Unavailable");
    }, 15000); // 15 second timeout
  });
}

module.exports = { getCS2RankFromSteam };
