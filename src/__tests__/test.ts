import * as dotenv from "dotenv";
dotenv.config();
import SteamWeb from "../index.js";
import assert from "assert";
import { Session } from "../../@types/index.js";

const avatar = "https://avatars.akamai.steamstatic.com/5863a38653985de991306b27428f5063afc7904a_full.jpg";
let s: SteamWeb;
let session: Session;

describe("Test steam-web", () => {
  step("Access_token should grant authentication", async () => {
    s = new SteamWeb();
    await s.login(process.env.ACCESS_TOKEN);
  });

  step("Refresh_token should grant authentication", async () => {
    s = new SteamWeb();
    const res = await s.login(process.env.REFRESH_TOKEN);
    session = res;
  });

  it("Re-use previous session", async () => {
    s = new SteamWeb();
    await s.setSession(session);
  });

  it("getFarmableGames() - should return FarmableGame[]", async () => {
    const farmData = await s.getFarmableGames();
    assert.equal(Array.isArray(farmData), true);
  });

  it("getCardsInventory() - should return Item[]", async () => {
    const items = await s.getCardsInventory();
    assert.equal(Array.isArray(items), true);
  });

  it("changePrivacy()", async () => {
    await s.changePrivacy("private");
  });

  it("changeAvatar() - should return string url string", async () => {
    const avatarUrl = await s.changeAvatar(avatar);
    assert.equal(avatarUrl.includes("https"), true);
  });

  it("clearAliases() - should not fail", async () => {
    await s.clearAliases();
  });

  it("All methods should fail with NotLoggedIn", async () => {
    await s.logout();

    await assert.rejects(
      s.setSession({ steamid: session.steamid, sessionid: session.sessionid, cookies: "" }),
      (err: Error) => {
        assert.equal(err.name, "steam-web");
        assert.equal(err.message, "NotLoggedIn");
        return true;
      }
    );

    await assert.rejects(s.changePrivacy("public"), (err: Error) => {
      assert.equal(err.name, "steam-web");
      assert.equal(err.message, "NotLoggedIn");
      return true;
    });

    await assert.rejects(s.getFarmableGames(), (err: Error) => {
      assert.equal(err.name, "steam-web");
      assert.equal(err.message, "NotLoggedIn");
      return true;
    });

    await assert.rejects(s.getCardsInventory(), (err: Error) => {
      assert.equal(err.name, "steam-web");
      assert.equal(err.message, "NotLoggedIn");
      return true;
    });

    await assert.rejects(s.clearAliases(), (err: Error) => {
      assert.equal(err.name, "steam-web");
      assert.equal(err.message, "NotLoggedIn");
      return true;
    });

    await assert.rejects(s.changeAvatar(avatar), (err: Error) => {
      assert.equal(err.name, "steam-web");
      assert.equal(err.message, "NotLoggedIn");
      return true;
    });
  });
});
