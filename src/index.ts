import { FormData, Blob } from "formdata-node";
import Crypto from "crypto";
import { load } from "cheerio";
import SteamCrypto from "steam-crypto-esm";
import fetch, { BodyInit, RequestInit } from "node-fetch";
import { SocksProxyAgent } from "socks-proxy-agent";

import { Cookie, FarmData, Item, Inventory, Avatar, PrivacySettings, Options } from "../@types";
import { URLSearchParams } from "url";

const fetchOptions: RequestInit = {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows; U; Windows NT 10.0; en-US; Valve Steam Client/default/1634158817; ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.117 Safari/537.36",
  },
};

export default class Steamcommunity {
  private readonly steamid: string;
  private readonly webNonce: string;
  private _cookie: Cookie;

  constructor(options: Options) {
    fetchOptions.agent = new SocksProxyAgent(options.agentOptions);
    this.steamid = options.steamid;
    this.webNonce = options.webNonce;
  }

  /**
   * Set cookie from JSON string
   */
  public set cookie(cookie: Cookie) {
    this._cookie = cookie;
    fetchOptions.headers = { ...fetchOptions.headers, Cookie: this.stringifyCookie(this._cookie) };
  }

  /**
   * Login via Steam API to obtain a cookie session
   */
  async login(): Promise<Cookie> {
    const url = "https://api.steampowered.com/ISteamUserAuth/AuthenticateUser/v1";

    const sessionkey = SteamCrypto.generateSessionKey();
    const encrypted_loginkey = SteamCrypto.symmetricEncryptWithHmacIv(this.webNonce, sessionkey.plain);

    const form = new FormData();
    form.append("steamid", this.steamid);
    form.append("encrypted_loginkey", new Blob([encrypted_loginkey]));
    form.append("sessionkey", new Blob([sessionkey.encrypted]));

    const res: any = await fetch(url, { ...fetchOptions, method: "POST", body: form as BodyInit }).then((res) => {
      if (res.ok) return res.json();
      if (res.status === 429) throw "RateLimitExceeded";
      if (res.status === 401) throw "Unauthorized";
      throw res;
    });

    this.cookie = {
      sessionid: Crypto.randomBytes(12).toString("hex"),
      steamLoginSecure: res.authenticateuser.tokensecure,
    };

    return this._cookie;
  }

  /**
   * Get games with cards left to farm
   */
  async getFarmingData(): Promise<FarmData[]> {
    if (!this._cookie) throw "NeedCookie";
    const url = `https://steamcommunity.com/profiles/${this.steamid}/badges`;

    const res = await fetch(url, fetchOptions).then((res) => {
      if (res.ok) return res.text();
      if (res.status === 429) throw "RateLimitExceeded";
      if (res.status === 401) throw "Unauthorized";
      throw res;
    });

    const data: FarmData[] = this.parseFarmingData(res);
    return data;
  }

  /**
   * Get cards inventory
   */
  async getCardsInventory(): Promise<Item[]> {
    if (!this._cookie) throw "NeedCookie";
    const contextId = "6"; // trading cards
    const url = `https://steamcommunity.com/profiles/${this.steamid}/inventory/json/753/${contextId}`;

    const data = await fetch(url, fetchOptions).then((res) => {
      if (res.ok) return res.json();
      if (res.status === 429) throw "RateLimitExceeded";
      if (res.status === 401) throw "Unauthorized";
      throw res;
    });

    const items = this.parseItems(data as Inventory, contextId);
    return items;
  }

  /**
   * Change account profile avatar
   */
  async changeAvatar(avatar: Avatar): Promise<string> {
    if (!this._cookie) throw "NeedCookie";
    const url = "https://steamcommunity.com/actions/FileUploader/";
    const blob = new Blob([avatar.buffer], { type: avatar.type });
    const form = new FormData();
    form.append("name", "avatar");
    form.append("filename", "blob");
    form.append("avatar", blob);
    form.append("type", "player_avatar_image");
    form.append("sId", this.steamid);
    form.append("sessionid", this._cookie.sessionid);
    form.append("doSub", 1);
    form.append("json", 1);

    const res = await fetch(url, { ...fetchOptions, method: "POST", body: form as BodyInit });

    if (res.ok) {
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const json: any = await res.json();
        if (json.success) {
          return json.images.full;
        }
        throw `${json.message}`;
      }

      // error is given with 200 http code as text because it's valve.
      const text = await res.text();
      throw text;
    }

    if (res.status === 429) throw "RateLimitExceeded";
    if (res.status === 401) throw "Unauthorized";
    throw res;
  }

  /**
   * Clear account's previous aliases
   */
  async clearAliases(): Promise<void> {
    if (!this._cookie) throw "NeedCookie";
    const url = `https://steamcommunity.com/profiles/${this.steamid}/ajaxclearaliashistory/`;

    const params = new URLSearchParams();
    params.append("sessionid", this._cookie.sessionid);

    const res = await fetch(url, { ...fetchOptions, method: "POST", body: params });
    if (res.ok) return;
    if (res.status === 429) throw "RateLimitExceeded";
    if (res.status === 401) throw "Unauthorized";
    throw res;
  }

  /**
   * Change account's privacy settings
   */
  async changePrivacy(settings: PrivacySettings): Promise<void> {
    if (!this._cookie) throw "NeedCookie";
    const url = `https://steamcommunity.com/profiles/${this.steamid}/ajaxsetprivacy/`;

    const form = new FormData();
    form.append("sessionid", this._cookie.sessionid);
    const Privacy: { [key: string]: number } = {};
    for (const [key, value] of Object.entries(settings)) {
      if (key !== "eCommentPermission") {
        Privacy[key] = value;
      }
    }
    form.append("Privacy", JSON.stringify(Privacy));
    form.append("eCommentPermission", settings.eCommentPermission);

    const res = await fetch(url, { ...fetchOptions, method: "POST", body: form as BodyInit });
    if (res.ok) return;
    if (res.status === 429) throw "RateLimitExceeded";
    if (res.status === 401) throw "Unauthorized";
    throw res;
  }

  /**
   * Helper function for getCardsInventory
   */
  private parseItems(data: Inventory, contextId: string): Item[] {
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
   * Helper function for getFarmingData
   */
  private parseFarmingData(html: string): FarmData[] {
    const $ = load(html);

    const farmData: FarmData[] = [];

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
      if (!remainingCardsText.includes("card drops remaining")) {
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
      name = $(badge).find(".badge_title").text().replace("/&nbsp;", "").trim();

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

      farmData.push({ name, appId, playTime, remainingCards, droppedCards });
    });
    return farmData;
  }

  private stringifyCookie(cookie: Cookie): string {
    return `sessionid=${cookie.sessionid}; steamLoginSecure=${cookie.steamLoginSecure};`;
  }
}
