import { FormData, Blob } from "formdata-node";
import Crypto from "crypto";
import { load } from "cheerio";
import SteamCrypto from "steam-crypto-esm";
import fetch, { BodyInit, RequestInit } from "node-fetch";
import { SocksProxyAgent } from "socks-proxy-agent";

import {
  Cookie,
  FarmableGame,
  Item,
  InventoryResponse,
  Avatar,
  Options,
  ProfilePrivacy,
  AvatarUploadResponse,
  LoginResponse,
  PrivacyResponce,
} from "../@types";
import { URLSearchParams } from "url";

const fetchOptions: RequestInit = {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36",
  },
};

const ERRORS = {
  NEED_WEBNONCE: "NeedWebNonce",
  RATE_LIMIT: "RateLimitExceeded",
  NEED_COOKIE: "NeedCookie",
  COOKIE_EXPIRED: "CookieExpired",
  BAD_REQUEST: "BadRequest",
} as const;

export default class Steamcommunity {
  private readonly steamid: string;
  private readonly webNonce: string;
  private cookie: Cookie;

  constructor(options: Options) {
    if (options.agentOptions) {
      fetchOptions.agent = new SocksProxyAgent(options.agentOptions);
    }
    this.steamid = options.steamid;
    this.webNonce = options.webNonce;
    if (options.cookie) {
      this.setCookie(options.cookie);
    }
  }

  /**
   * Set cookie from JSON string
   */
  public setCookie(cookie: Cookie) {
    this.cookie = cookie;
    fetchOptions.headers = { ...fetchOptions.headers, Cookie: this.stringifyCookie(this.cookie) };
  }

  /**
   * Login via Steam API to obtain a cookie session
   */
  async login(): Promise<Cookie> {
    if (!this.webNonce) throw Error(ERRORS.NEED_WEBNONCE);

    const url = "https://api.steampowered.com/ISteamUserAuth/AuthenticateUser/v1";

    const sessionkey = SteamCrypto.generateSessionKey();
    const encrypted_loginkey = SteamCrypto.symmetricEncryptWithHmacIv(this.webNonce, sessionkey.plain);

    const form = new FormData();
    form.append("steamid", this.steamid);
    form.append("encrypted_loginkey", new Blob([encrypted_loginkey]));
    form.append("sessionkey", new Blob([sessionkey.encrypted]));

    const res: LoginResponse = await fetch(url, { ...fetchOptions, method: "POST", body: form as BodyInit }).then(
      (res) => {
        if (res.ok) return res.json() as unknown as LoginResponse;
        if (res.status === 429) throw Error(ERRORS.RATE_LIMIT);
        if (res.status === 401) throw Error(ERRORS.COOKIE_EXPIRED);
        throw res;
      }
    );

    this.setCookie({
      sessionid: Crypto.randomBytes(12).toString("hex"),
      steamLoginSecure: res.authenticateuser.tokensecure,
    });
    return this.cookie;
  }

  /**
   * Get games with cards left to farm
   */
  async getFarmableGames(): Promise<FarmableGame[]> {
    const url = `https://steamcommunity.com/profiles/${this.steamid}/badges`;

    const res = await fetch(url, fetchOptions).then((res) => {
      if (res.ok) return res.text();
      if (res.status === 429) throw Error(ERRORS.RATE_LIMIT);
      throw res;
    });

    const data: FarmableGame[] = this.parseFarmingData(res);
    return data;
  }

  /**
   * Get cards inventory
   */
  async getCardsInventory(): Promise<Item[]> {
    if (!this.cookie) throw Error(ERRORS.NEED_COOKIE);

    const contextId = "6"; // trading cards
    const url = `https://steamcommunity.com/profiles/${this.steamid}/inventory/json/753/${contextId}`;

    const data = await fetch(url, fetchOptions).then((res) => {
      if (res.ok) return res.json() as unknown as InventoryResponse;
      if (res.status === 429) throw Error(ERRORS.RATE_LIMIT);
      throw res;
    });

    if (!data.success) {
      if (data.Error === "This profile is private.") throw Error(ERRORS.COOKIE_EXPIRED);
      throw data;
    }

    const items = this.parseItems(data, contextId);
    return items;
  }

  /**
   * Change account profile avatar
   */
  async changeAvatar(avatar: Avatar): Promise<string> {
    if (!this.cookie) throw Error(ERRORS.NEED_COOKIE);

    const url = "https://steamcommunity.com/actions/FileUploader/";
    const blob = new Blob([avatar.buffer], { type: avatar.type });
    const form = new FormData();
    form.append("name", "avatar");
    form.append("filename", "blob");
    form.append("avatar", blob);
    form.append("type", "player_avatar_image");
    form.append("sId", this.steamid);
    form.append("sessionid", this.cookie.sessionid);
    form.append("doSub", 1);
    form.append("json", 1);

    const res = await fetch(url, { ...fetchOptions, method: "POST", body: form });
    if (res.status === 429) throw Error(ERRORS.RATE_LIMIT);
    if (res.status === 400) throw Error(ERRORS.BAD_REQUEST);

    const contentType = res.headers.get("content-type");
    // avatar uploaded successfully
    if (contentType && contentType.includes("application/json")) {
      const json = (await res.json()) as unknown as AvatarUploadResponse;
      if (json.success) return json.images.full;
      throw json;
    }

    // error is given with 200 code as text because it's valve.
    const text = await res.text();
    if (text === "#Error_BadOrMissingSteamID") throw Error(ERRORS.COOKIE_EXPIRED);
    throw text;
  }

  /**
   * Clear account's previous aliases
   */
  async clearAliases() {
    if (!this.cookie) throw Error(ERRORS.NEED_COOKIE);
    const url = `https://steamcommunity.com/profiles/${this.steamid}/ajaxclearaliashistory/`;

    const params = new URLSearchParams();
    params.append("sessionid", this.cookie.sessionid);

    const res = await fetch(url, { ...fetchOptions, method: "POST", body: params });
    if (res.ok) return;
    if (res.status === 429) throw Error(ERRORS.RATE_LIMIT);
    if (res.status === 401) throw Error(ERRORS.COOKIE_EXPIRED);
    throw res;
  }

  /**
   * Change account's privacy settings
   */
  async changePrivacy(privacy: ProfilePrivacy) {
    if (!this.cookie) throw Error(ERRORS.NEED_COOKIE);
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
    form.append("sessionid", this.cookie.sessionid);
    form.append("Privacy", JSON.stringify(settings));
    form.append("eCommentPermission", 1);

    const res = await fetch(url, { ...fetchOptions, method: "POST", body: form });
    if (res.status === 429) throw Error(ERRORS.RATE_LIMIT);
    if (res.status === 401) throw Error(ERRORS.COOKIE_EXPIRED);
    if (res.ok) {
      const json = (await res.json()) as unknown as PrivacyResponce;
      if (json.success) return;
      throw json;
    }
    throw res;
  }

  /**
   * Helper function for getCardsInventory
   */
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

  /**
   * Helper function for getFarmableGames
   */
  private parseFarmingData(html: string): FarmableGame[] {
    const $ = load(html);

    // check if cookie expired
    if ($(".global_action_link").first().text().includes("login")) throw Error(ERRORS.COOKIE_EXPIRED);

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

  private stringifyCookie(cookie: Cookie): string {
    return `sessionid=${cookie.sessionid}; steamLoginSecure=${cookie.steamLoginSecure};`;
  }
}
