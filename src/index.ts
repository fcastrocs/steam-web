import { FormData } from "formdata-node";
import { randomBytes } from "crypto";
import { load } from "cheerio";
import fetch, { Headers, Response } from "node-fetch";
import { URLSearchParams } from "url";

import ISteamWeb, {
  FarmableGame,
  Item,
  InventoryResponse,
  Options,
  ProfilePrivacy,
  AvatarUploadResponse,
  FinalizeloginRes,
  Payload,
  FetchOptions,
  Session,
} from "../@types";
import SteamWebError from "./SteamWebError.js";
export { SteamWebError };

export const ERRORS = {
  RATE_LIMIT: "RateLimitExceeded",
  NOT_LOGGEDIN: "NotLoggedIn",
  TOKEN_EXPIRED: "TokenExpired",
  INVALID_TOKEN: "InvalidToken",
} as const;

const userAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36";

export default class SteamWeb implements ISteamWeb {
  private steamid: string;
  private sessionid = randomBytes(12).toString("hex");
  private fetchOptions: FetchOptions = {
    agent: null,
    headers: new Headers(),
  };

  constructor(private readonly options?: Options) {
    // set default headers
    this.fetchOptions.headers.set("User-Agent", userAgent);
    this.fetchOptions.headers.set("Cookie", "");

    if (this.options) {
      // proxy passed
      if (this.options.agent) {
        this.fetchOptions.agent = this.options.agent;
      }
    }
  }

  /**
   * Re-use a previous session, thus we don't have to login again
   */
  async setSession(session: Session): Promise<void> {
    this.sessionid = session.sessionid;
    this.steamid = session.steamid;
    this.fetchOptions.headers.set("Cookie", session.cookies);
    await this.verifyLoggedIn();
  }

  /**
   * Login to Steamcommunity.com
   * token: access_token or refresh_token
   */
  async login(token: string): Promise<Session> {
    const { payload, tokenType } = this.verifyToken(token);
    this.steamid = payload.sub;

    if (tokenType === "access") {
      await this.loginWithAccessToken(token);
    } else if (tokenType === "refresh") {
      await this.loginWithRefreshToken(token);
    }

    await this.verifyLoggedIn();

    return {
      cookies: this.fetchOptions.headers.get("Cookie"),
      sessionid: this.sessionid,
      steamid: this.steamid,
    };
  }

  /**
   * Login to steam with refresh_token
   * (takes a bit longer than access_token login)
   * @returns auth cookie
   */
  private async loginWithRefreshToken(refreshToken: string): Promise<void> {
    let form = new FormData();
    form.append("nonce", refreshToken);
    form.append("sessionid", this.sessionid);
    form.append("redir", "https://store.steampowered.com/login/?redir=&redir_ssl=1&snr=1_4_4__global-header");

    // get transfer_info
    const finalizeLoginRes = await fetch("https://login.steampowered.com/jwt/finalizelogin", {
      ...this.fetchOptions,
      body: form,
      method: "POST",
    }).then(async (res) => {
      this.validateRes(res);
      const body = (await res.json()) as FinalizeloginRes;
      if (body.success === false) throw body.error; // EResult
      return body;
    });

    // the steam website makes requests to all three transfer_info items to setup auth cookies to all their domains and subdomains
    // however we only need to make one request and we can use the auth cookies everywhere.
    const transfer = finalizeLoginRes.transfer_info[0];
    form = new FormData();
    form.append("nonce", transfer.params.nonce);
    form.append("auth", transfer.params.auth);
    form.append("steamID", this.steamid);

    const cookies = await fetch(transfer.url, {
      ...this.fetchOptions,
      body: form,
      method: "POST",
    }).then(async (res) => {
      this.validateRes(res);

      const body = (await res.json()) as { result: number };
      if (body.result !== 1) throw body.result;

      return res.headers.get("set-cookie");
    });

    // headers['set-cookie'] must contain steamLoginSecure
    if (!cookies.includes("steamLoginSecure")) {
      console.log(cookies);
      console.log(finalizeLoginRes);
      throw new SteamWebError("SomethingWentWrong");
    }

    // making only one request to transfer
    this.setCookie("sessionid", this.sessionid);
    this.setCookieHeader(cookies);
  }

  /**
   * Login to steam with access_token
   * @returns auth cookie
   */
  private async loginWithAccessToken(accessToken: string): Promise<void> {
    const value = encodeURI(`${this.steamid}||${accessToken}`);
    this.setCookie("steamLoginSecure", value);
  }

  /**
   * Low overhead call to verify we logged in successfully
   */
  private async verifyLoggedIn() {
    await fetch("https://steamcommunity.com/actions/GetNotificationCounts", {
      ...this.fetchOptions,
    }).then(async (res) => {
      this.validateRes(res);
      // set any cookies we might have gotten from this request (i.e sessionid, browserid)
      this.setCookieHeader(res.headers.get("set-cookie"));
    });
  }

  /**
   * Logout and destroy cookies
   */
  async logout() {
    const form = new FormData();
    form.append("sessionid", this.sessionid);
    await fetch("https://store.steampowered.com/logout/", { ...this.fetchOptions, method: "POST", body: form });
    this.fetchOptions.headers.set("Cookie", "");
  }

  private verifyToken(token: string) {
    try {
      let tokenType: "access" | "refresh";

      const encodedPayload = token.split(".")[1];

      const buff = Buffer.from(encodedPayload, "base64");
      const payload = JSON.parse(buff.toString("utf8")) as Payload;

      if (payload.aud.includes("renew")) {
        tokenType = "refresh";
      } else {
        tokenType = "access";
      }

      if (!payload.aud.includes("web")) throw new SteamWebError("Token audience is not valid for web.");

      const currTime = ~~(Date.now() / 1000);
      const timeLeft = payload.exp - currTime;

      // don't accept tokens that are about to expire
      if (timeLeft / 60 < 1) throw new SteamWebError(ERRORS.TOKEN_EXPIRED);

      return { payload, tokenType };
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new SteamWebError(ERRORS.INVALID_TOKEN);
      }
      throw error;
    }
  }

  /**
   * parse set-cookie header and set them to cookie header
   */
  private setCookieHeader(strCookies: string) {
    if (!strCookies) return;

    const cookies = new Map<string, string>();

    // set cookies into a map
    strCookies.split(",").forEach((c) => {
      const cookie = c.split("; Path")[0].trim().split("=");
      cookies.set(cookie[0], cookie[1]);
    });

    // set cookies to header
    for (const [name, value] of cookies) {
      this.setCookie(name, value);

      if (name === "sessionid") {
        this.sessionid = value;
      }
    }
  }

  /**
   * set a cookie to header
   */
  private setCookie(name: string, value: string) {
    const cookie = name + "=" + value;
    let cookies = this.fetchOptions.headers.get("Cookie");
    cookies = cookie + "; " + cookies;
    this.fetchOptions.headers.set("Cookie", cookies);
  }

  /**
   * Get games with cards left to farm
   */
  async getFarmableGames(): Promise<FarmableGame[]> {
    const url = `https://steamcommunity.com/profiles/${this.steamid}/badges`;

    const res = await fetch(url, this.fetchOptions).then((res) => {
      this.validateRes(res);
      return res.text();
    });

    const data: FarmableGame[] = this.parseFarmingData(res);
    return data;
  }

  /**
   * Get cards inventory
   */
  async getCardsInventory(): Promise<Item[]> {
    const contextId = "6"; // trading cards
    const url = `https://steamcommunity.com/profiles/${this.steamid}/inventory/json/753/${contextId}`;

    const data = await fetch(url, this.fetchOptions).then((res) => {
      this.validateRes(res);
      return res.json() as unknown as InventoryResponse;
    });

    if (!data.success) {
      if (data.Error === "This profile is private.") throw new SteamWebError(ERRORS.NOT_LOGGEDIN);
      throw data;
    }

    const items = this.parseItems(data, contextId);
    return items;
  }

  /**
   * Change account profile avatar
   */
  async changeAvatar(avatarURL: string): Promise<string> {
    // validate image first
    let res = await fetch("https://images.pexels.com/photos/1707215/pexels-photo-1707215.jpeg", { method: "HEAD" });
    // only allow jpeg and png
    const contentType = res.headers.get("content-type");
    if (!contentType.includes("image/jpeg") && !contentType.includes("image/png")) {
      throw new SteamWebError("URL does not contain a JPEG or PNG image.");
    }
    // size should not be larger than 1024 kB
    if (parseInt(res.headers.get("content-length")) / 1024 > 1024) {
      throw new SteamWebError("Image size should not be larger than 1024 kB.");
    }

    const blob = await fetch(avatarURL).then((res) => res.blob());
    const url = "https://steamcommunity.com/actions/FileUploader/";

    const form = new FormData();
    form.append("name", "avatar");
    form.append("filename", "blob");
    form.append("avatar", blob);
    form.append("type", "player_avatar_image");
    form.append("sId", this.steamid);
    form.append("sessionid", this.sessionid);
    form.append("doSub", 1);
    form.append("json", 1);

    res = await fetch(url, { ...this.fetchOptions, method: "POST", body: form });
    this.validateRes(res);
    const text = await res.text();

    if (!text.includes(`{"success":true,`)) {
      throw new SteamWebError(ERRORS.NOT_LOGGEDIN);
    }

    const json: AvatarUploadResponse = JSON.parse(text);
    return json.images.full;
  }

  /**
   * Clear account's previous aliases
   */
  async clearAliases() {
    const url = `https://steamcommunity.com/profiles/${this.steamid}/ajaxclearaliashistory/`;

    const params = new URLSearchParams();
    params.append("sessionid", this.sessionid);

    const res = await fetch(url, { ...this.fetchOptions, method: "POST", body: params });
    this.validateRes(res);
    const text = await res.text();
    if (!text.includes('{"success":1')) {
      throw new SteamWebError(ERRORS.NOT_LOGGEDIN);
    }
  }

  /**
   * Change account's privacy settings
   */
  async changePrivacy(privacy: ProfilePrivacy) {
    const url = `https://steamcommunity.com/profiles/${this.steamid}/ajaxsetprivacy/`;

    const settings = {
      PrivacyProfile: 3,
      PrivacyInventory: 3,
      PrivacyInventoryGifts: 3,
      PrivacyOwnedGames: 3,
      PrivacyPlaytime: 3,
      PrivacyFriendsList: 3,
    };

    if (privacy === "public") settings.PrivacyProfile = 3;
    else if (privacy === "friendsOnly") settings.PrivacyProfile = 2;
    else if (privacy === "private") settings.PrivacyProfile = 1;

    const form = new FormData();
    form.append("sessionid", this.sessionid);
    form.append("Privacy", JSON.stringify(settings));
    form.append("eCommentPermission", 1);

    const res = await fetch(url, { ...this.fetchOptions, method: "POST", body: form });
    this.validateRes(res);

    const text = await res.text();
    if (!text.includes('{"success":1')) {
      throw new SteamWebError(ERRORS.NOT_LOGGEDIN);
    }
  }

  private parseItems(data: InventoryResponse, contextId: string): Item[] {
    const inventory = data.rgInventory;
    const description = data.rgDescriptions;

    const items: Item[] = [];

    for (const key in inventory) {
      const c_i = inventory[key].classid + "_" + inventory[key].instanceid;
      items.push({
        assetid: inventory[key].id,
        amount: inventory[key].amount,
        icon: description[c_i].icon_url,
        name: description[c_i].name,
        type: description[c_i].type,
        tradable: description[c_i].tradable == 1,
        contextId,
      });
    }
    return items;
  }

  private parseFarmingData(html: string): FarmableGame[] {
    const $ = load(html);

    // check if cookie expired
    if ($(".global_action_link").first().text().includes("login")) throw new SteamWebError(ERRORS.NOT_LOGGEDIN);

    const FarmableGame: FarmableGame[] = [];

    $(".badge_row").each((index, badge) => {
      let playTime = 0;
      let remainingCards = 0;
      let name = "";
      let appId = 0;
      let droppedCards = 0;

      // check for remaining cards
      const progress = $(badge).find(".progress_info_bold");
      if (!progress) {
        return;
      }

      const remainingCardsText = progress.text();
      // can also include "tasks remaining"
      if (!remainingCardsText.includes("card")) {
        return;
      }

      remainingCards = Number(remainingCardsText.match(/\d+/));
      if (remainingCards === 0) {
        return;
      }

      // Get play time
      let playTimeText = $(badge).find(".badge_title_stats_playtime").text();
      if (!playTimeText) {
        return;
      }

      if (playTimeText.includes("hrs on record")) {
        // hrs could be displayed as x,xxx format or xx.xx
        playTimeText = playTimeText.replace(",", "");
        playTime = Number(playTimeText.match(/\d+(\.\d+)?/g));
      }

      // Get game title
      // remove details first...
      $(badge).find(".badge_view_details").remove();
      name = $(badge)
        .find(".badge_title")
        .text()
        .replace(/&nbsp;/, "")
        .trim();

      // Get appID
      let link = $(badge).find(".badge_row_overlay").attr("href");
      if (!link) return;
      link = link.substring(link.indexOf("gamecards"), link.length);
      appId = Number(link.match(/\d+/));

      // Get dropped cards
      $(badge)
        .find(".card_drop_info_header")
        .each((index, header) => {
          const text = $(header).text();
          if (text.includes("Card drops received")) {
            droppedCards = Number(text.match(/\d+(\.\d+)?/g));
            return;
          }
        });

      FarmableGame.push({ name, appId, playTime, remainingCards, droppedCards });
    });
    return FarmableGame;
  }

  private validateRes(res: Response) {
    if (res.status === 429) throw new SteamWebError(ERRORS.RATE_LIMIT);
    if (res.status === 401) throw new SteamWebError(ERRORS.NOT_LOGGEDIN);
    if (!res.ok) throw res;
  }
}
