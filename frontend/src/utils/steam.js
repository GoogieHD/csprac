const SteamUser = require("steam-user");
const GlobalOffensive = require("globaloffensive");

const steamCreds = {
  accountName: process.env.STEAM_BOT_USERNAME,
  password: process.env.STEAM_BOT_PASSWORD,
  twoFactorCode: process.env.STEAM_GUARD_CODE,
};

function getCS2RankFromSteam(steamId64, attempt = 0, io) {
  return new Promise((resolve, reject) => {
    console.log(
      `[Steam] Starting rank fetch (Attempt ${attempt}) for Steam ID: ${steamId64}`
    );

    const client = new SteamUser();
    const csgo = new GlobalOffensive(client);

    let profileRequested = false;

    client.logOn(steamCreds);

    client.on("loggedOn", () => {
      console.log("[Steam] Logged into Steam.");
      client.gamesPlayed(730);
    });

    client.on("friendRelationship", (steamID, relationship) => {
      if (relationship === SteamUser.EFriendRelationship.RequestRecipient) {
        console.log("[Steam] Friend request accepted by user.");
        client.gamesPlayed(730); // trigger GC again if needed
      }
    });

    csgo.on("connectedToGC", () => {
      console.log("[Steam] Connected to CS2 Game Coordinator.");
      csgo.requestPlayersProfile(steamId64);
      profileRequested = true;
    });

    csgo.on("playersProfile", (profile) => {
      console.log(
        "[Steam] Received profile data:",
        JSON.stringify(profile, null, 2)
      );

      const premier = profile.rankings?.find((r) => r.rank_type_id === 11);
      const rank = premier?.rank_id;

      if (rank) {
        client.logOff();
        resolve(rank);
      } else {
        // No rank found — send friend request and retry later
        const steamID64 = steamId64.toString(); // make sure it's a string

        client.addFriend(steamID64, (err) => {
          if (err) {
            console.warn("[Steam] Failed to send friend request:", err);

            if (err.message === "DuplicateName") {
              if (io) {
                io.emit("toast", {
                  type: "info",
                  message:
                    "Friend request already sent. Please accept it in Steam to complete rank fetch.",
                });
              }

              client.logOff();
              resolve("Unavailable");
              return;
            }
          } else {
            console.log("[Steam] Friend request sent.");
            if (io) {
              io.emit("toast", {
                type: "info",
                message:
                  "Friend request sent. Please accept it to complete rank fetch.",
              });
            }
          }

          client.logOff();

          // Retry logic only if it's not a DuplicateName error
          if (attempt < 3) {
            setTimeout(() => {
              getCS2RankFromSteam(steamId64, attempt + 1, io)
                .then(resolve)
                .catch(reject);
            }, 15000);
          } else {
            console.warn(
              "[Steam] Max retries reached. Returning 'Unavailable'."
            );
            resolve("Unavailable");
          }
        });
      }
    });

    csgo.on("error", (err) => {
      console.error("[Steam] GC error:", err);
      client.logOff();
      reject(err);
    });

    // Timeout fallback
    setTimeout(() => {
      if (!profileRequested) {
        console.error("[Steam] Timeout: Never connected to GC.");
      } else {
        console.error("[Steam] Timeout: No profile received.");
      }
      client.logOff();
      resolve("Unavailable");
    }, 15000);
  });
}

module.exports = { getCS2RankFromSteam };
