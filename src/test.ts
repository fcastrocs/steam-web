import Steam, { AccountAuth, AccountData, LoginOptions, Options } from "steam-client";
import { Cookie } from "../@types/index.js";
import Steamcommunity from "./index.js";
import fs from "fs";
const timeout = 30000;

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
  expect(cookie).toHaveProperty("sessionid");
  expect(cookie).toHaveProperty("steamLoginSecure");
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
  expect(Array.isArray(farmData)).toBe(true);
};

const getCardsInventory = async (useProxy: boolean) => {
  const steamCommunity = getSteamCommunity(useProxy);
  const items = await steamCommunity.getFarmableGames();
  expect(Array.isArray(items)).toBe(true);
};

const changePrivacy = async (useProxy: boolean) => {
  const steamCommunity = getSteamCommunity(useProxy);
  await steamCommunity.changePrivacy("friendsOnly");
};

const changeAvatar = async (useProxy: boolean) => {
  const steamCommunity = getSteamCommunity(useProxy);
  const avatarUrl = await steamCommunity.changeAvatar({
    type: "image/jpeg",
    buffer: Buffer.from(avatar, "base64"),
  });
  expect(avatarUrl.includes("https")).toBe(true);
};

const expiredCookie = async () => {
  const steamCommunity = new Steamcommunity({
    steamid: globals.steamRes.data.steamId,
    cookie: { sessionid: "", steamLoginSecure: "" },
  });

  await expect(steamCommunity.changePrivacy("public")).rejects.toThrow("CookieExpired");
  await expect(steamCommunity.getFarmableGames()).rejects.toThrow("CookieExpired");
  await expect(steamCommunity.getCardsInventory()).rejects.toThrow("CookieExpired");
  await expect(steamCommunity.clearAliases()).rejects.toThrow("CookieExpired");
  await expect(
    steamCommunity.changeAvatar({
      type: "image/jpeg",
      buffer: Buffer.from(avatar, "base64"),
    })
  ).rejects.toThrow("CookieExpired");
};

describe("Test SteamCommunity", () => {
  beforeAll(async () => await steamCMLogin(false), timeout);
  test("login - should return a session cookie", async () => await steamCommunityLogin(false), timeout);
  test("getFarmableGames - should return FarmableGame[]", async () => await getFarmableGames(false), timeout);
  test("getCardsInventory - should return Item[]", async () => await getCardsInventory(false), timeout);
  test("changePrivacy", async () => await changePrivacy(false), timeout);
  test("changeAvatar - should return string url string", async () => await changeAvatar(false), timeout);
  test("Cookie - all should fail with CookieExpired", expiredCookie, timeout);
  test("re-login - should return a session cookie", async () => await steamCommunityReLogin(false), timeout);
  afterAll(() => globals.steam.disconnect());
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
