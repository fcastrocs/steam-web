import * as dotenv from "dotenv";
dotenv.config();
import Steamcommunity from "../index.js";
import assert from "assert";

const avatar = "https://avatars.akamai.steamstatic.com/5863a38653985de991306b27428f5063afc7904a_full.jpg";
let s: Steamcommunity;

describe("Test steamcommunity-api", () => {
  step("access_token should grant authentication", async () => {
    s = new Steamcommunity();
    await s.loginWithAccessToken(process.env.ACCESS_TOKEN);
  });

  step("refresh_token should grant authentication", async () => {
    s = new Steamcommunity();
    await s.loginWithRefreshToken(process.env.REFRESH_TOKEN);
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
    await s.changePrivacy("friendsOnly");
  });

  it("changeAvatar() - should return string url string", async () => {
    const avatarUrl = await s.changeAvatar(avatar);
    assert.equal(avatarUrl.includes("https"), true);
  });

  it("All methods should fail with CookieExpired", async () => {
    await s.logout();
    await assert.rejects(s.changePrivacy("public"), (err: Error) => {
      assert.equal(err.name, "steamcommunity-api");
      assert.equal(err.message, "CookieExpired");
      return true;
    });

    await assert.rejects(s.getFarmableGames(), (err: Error) => {
      assert.equal(err.name, "steamcommunity-api");
      assert.equal(err.message, "CookieExpired");
      return true;
    });

    await assert.rejects(s.getCardsInventory(), (err: Error) => {
      assert.equal(err.name, "steamcommunity-api");
      assert.equal(err.message, "CookieExpired");
      return true;
    });

    await assert.rejects(s.clearAliases(), (err: Error) => {
      assert.equal(err.name, "steamcommunity-api");
      assert.equal(err.message, "CookieExpired");
      return true;
    });

    await assert.rejects(s.changeAvatar(avatar), (err: Error) => {
      assert.equal(err.name, "steamcommunity-api");
      assert.equal(err.message, "CookieExpired");
      return true;
    });
  });
});
