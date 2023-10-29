import * as dotenv from "dotenv";
dotenv.config();
import SteamWeb from "../index.js";
import assert from "assert";
import { Session } from "../../@types/index.js";

const avatar = "https://avatars.akamai.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg";
let s: SteamWeb;
let session: Session;

describe("Test steam-web", () => {
  // step("Access_token should grant authentication", async () => {
  //   s = new SteamWeb();
  //   await s.login(process.env.ACCESS_TOKEN);
  // });

  step("Refresh_token should grant authentication", async () => {
    s = new SteamWeb();
    const res = await s.login("eyAidHlwIjogIkpXVCIsICJhbGciOiAiRWREU0EiIH0.eyAiaXNzIjogInN0ZWFtIiwgInN1YiI6ICI3NjU2MTE5Nzk2MDQxMDA0NCIsICJhdWQiOiBbICJjbGllbnQiLCAid2ViIiwgInJlbmV3IiwgImRlcml2ZSIgXSwgImV4cCI6IDE3MTAzNTE0MDUsICJuYmYiOiAxNjgzNjU5MTA5LCAiaWF0IjogMTY5MjI5OTEwOSwgImp0aSI6ICIwRDE3XzIzMDVBMUM4X0RCNEE0IiwgIm9hdCI6IDE2OTIyOTkxMDksICJwZXIiOiAxLCAiaXBfc3ViamVjdCI6ICIxMDguNTYuMTk2LjIxNSIsICJpcF9jb25maXJtZXIiOiAiMTcyLjU4LjI0NC4xNDgiIH0.fHxNbeEBEg4IiSBjNPnbt8w4AzNB9E0PQneD-AV10pYSZHObWS2rSiixjvmNDgbx9v4iox755tI6DLOvwNeXBw");
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
