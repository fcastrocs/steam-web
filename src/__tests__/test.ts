import Steam, { AccountAuth, AccountData, LoginOptions, Options } from "steam-client";
import { Cookie } from "../../@types";
import Steamcommunity from "../index.js";
import fs from "fs";
import assert from "assert";
const timeout = 15000;

const avatar = fs.readFileSync("avatar.txt").toString();

interface Globals {
  steamCM: Options["steamCM"];
  steam: Steam;
  loginOptions: LoginOptions;
  steamRes: {
    auth: AccountAuth;
    data: AccountData;
  };
  cookie: Cookie;
  proxy?: Options["proxy"];
}

const globals: Globals = {
  steamCM: { host: "162.254.192.87", port: 27017 },
  proxy: {
    host: "",
    port: 12324,
    type: 5,
    userId: "",
    password: "",
  },
  steam: null,
  steamRes: null,
  cookie: null,
  loginOptions: { accountName: "", password: "" },
};

const steamCMLogin = async (useProxy: boolean) => {
  globals.steam = new Steam({ proxy: useProxy ? globals.proxy : null, steamCM: globals.steamCM, timeout });
  await globals.steam.connect();
  globals.steamRes = await globals.steam.login(globals.loginOptions);
  return true;
};

const getSteamCommunity = (useProxy: boolean) => {
  return new Steamcommunity({
    cookie: globals.cookie,
    steamid: globals.steamRes.data.steamId,
    webNonce: globals.steamRes.auth.webNonce,
    agentOptions: useProxy
      ? {
          hostname: globals.proxy.host,
          port: globals.proxy.port,
          type: globals.proxy.type,
          userId: globals.proxy.userId,
          password: globals.proxy.password,
        }
      : null,
  });
};

const steamCommunityLogin = async (useProxy: boolean) => {
  const steamCommunity = getSteamCommunity(useProxy);
  const cookie = await steamCommunity.login();
  assert("sessionid" in cookie);
  assert("steamLoginSecure" in cookie);
  globals.cookie = cookie;
};

const steamCommunityReLogin = async (useProxy: boolean) => {
  globals.steamRes.auth.webNonce = await globals.steam.getWebNonce();
  globals.cookie = null;
  return steamCommunityLogin(useProxy);
};

const getFarmableGames = async (useProxy: boolean) => {
  const steamCommunity = getSteamCommunity(useProxy);
  const farmData = await steamCommunity.getFarmableGames();
  assert.equal(Array.isArray(farmData), true);
};

const getCardsInventory = async (useProxy: boolean) => {
  const steamCommunity = getSteamCommunity(useProxy);
  const items = await steamCommunity.getFarmableGames();
  assert.equal(Array.isArray(items), true);
};

const changePrivacy = async (useProxy: boolean) => {
  const steamCommunity = getSteamCommunity(useProxy);
  await steamCommunity.changePrivacy("friendsOnly");
};

const changeAvatar = async (useProxy: boolean) => {
  const steamCommunity = getSteamCommunity(useProxy);
  const avatarUrl = await steamCommunity.changeAvatar(avatar);
  assert.equal(avatarUrl.includes("https"), true);
};

const expiredCookie = async () => {
  const steamCommunity = new Steamcommunity({
    steamid: globals.steamRes.data.steamId,
    cookie: { sessionid: "", steamLoginSecure: "" },
  });

  await assert.rejects(steamCommunity.changePrivacy("public"), (err: Error) => {
    assert.equal(err.name, "steamcommunity-api");
    assert.equal(err.message, "CookieExpired");
    return true;
  });

  await assert.rejects(steamCommunity.getFarmableGames(), (err: Error) => {
    assert.equal(err.name, "steamcommunity-api");
    assert.equal(err.message, "CookieExpired");
    return true;
  });

  await assert.rejects(steamCommunity.getCardsInventory(), (err: Error) => {
    assert.equal(err.name, "steamcommunity-api");
    assert.equal(err.message, "CookieExpired");
    return true;
  });

  await assert.rejects(steamCommunity.clearAliases(), (err: Error) => {
    assert.equal(err.name, "steamcommunity-api");
    assert.equal(err.message, "CookieExpired");
    return true;
  });

  await assert.rejects(steamCommunity.changeAvatar(avatar), (err: Error) => {
    assert.equal(err.name, "steamcommunity-api");
    assert.equal(err.message, "CookieExpired");
    return true;
  });
};

describe("Test steamcommunity-api", () => {
  step("Steam CM Login", async () => await steamCMLogin(false));
  step("login() - should return a session cookie", async () => await steamCommunityLogin(false));
  it("getFarmableGames() - should return FarmableGame[]", async () => await getFarmableGames(false));
  it("getCardsInventory() - should return Item[]", async () => await getCardsInventory(false));
  it("changePrivacy()", async () => await changePrivacy(false));
  it("changeAvatar() - should return string url string", async () => await changeAvatar(false));
  it("All methods should fail with CookieExpired", async () => await expiredCookie());
  it("login() - should return a session cookie", async () => await steamCommunityReLogin(false));
  after(() => globals.steam.disconnect());
});

/*describe("Test SteamCommunity with Proxy", () => {
  beforeAll(async () => await steamCMLogin(true), timeout);
  test("login - should return a session cookie", async () => await steamCommunityLogin(true), timeout);
  test("getFarmableGames - should return FarmableGame[]", getFarmableGames, timeout);
  test("getCardsInventory - should return Item[]", getCardsInventory, timeout);
  test("changePrivacy - should return {success: 1}", changePrivacy, timeout);
  test("re-login - should return a session cookie", async () => await steamCommunityLogin(true), timeout);
  afterAll(() => globals.steam.disconnect());
});*/
