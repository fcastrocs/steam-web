import { FormData, Blob } from "formdata-node";
import retry from "@machiavelli/retry";
import Crypto from "crypto";
import cheerio from "cheerio";
import SteamCrypto from "steam-crypto-esm";
import fetch, { BodyInit, RequestInit } from "node-fetch";
import SocksProxyAgent, { SocksProxyAgentOptions } from "socks-proxy-agent";

import { Cookie, FarmData, Item, Inventory, Avatar, PrivacySettings } from "../@types";
import { URLSearchParams } from "url";

const fetchOptions: RequestInit = {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows; U; Windows NT 10.0; en-US; Valve Steam Client/default/1634158817; ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.117 Safari/537.36",
  },
};

const operationOptions = {
  retries: 2,
  interval: 2000,
  noDelay: true,
};

export default class Steamcommunity {
  private steamid: string;
  private webNonce: string;
  private _cookie: Cookie;

  constructor(steamid: string, agentOptions: SocksProxyAgentOptions, timeout: number, webNonce?: string) {
    // add timeout to agentOptions
    agentOptions.timeout = timeout;
    fetchOptions.agent = SocksProxyAgent(agentOptions);

    this.steamid = steamid;
    this.webNonce = webNonce;
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
   * @returns cookie
   */
  async login(): Promise<Cookie> {
    if (!this.webNonce) throw Error("WebNonce is needed.");
    const url = "https://api.steampowered.com/ISteamUserAuth/AuthenticateUser/v1";
    const operation = new retry(operationOptions);

    const _login = async () => {
      const sessionkey = SteamCrypto.generateSessionKey();
      const encrypted_loginkey = SteamCrypto.symmetricEncryptWithHmacIv(this.webNonce, sessionkey.plain);

      const form = new FormData();
      form.append("steamid", this.steamid);
      form.append("encrypted_loginkey", new Blob([encrypted_loginkey]));
      form.append("sessionkey", new Blob([sessionkey.encrypted]));

      const res: any = await fetch(url, { ...fetchOptions, method: "POST", body: form as BodyInit }).then((res) => {
        if (res.ok) return res.json();
        throw res;
      });

      this.cookie = {
        sessionid: Crypto.randomBytes(12).toString("hex"),
        steamLoginSecure: res.authenticateuser.tokensecure,
      };

      return this._cookie;
    };

    return new Promise((resolve, reject) => {
      operation.attempt(async () => {
        try {
          const cookie = await _login();
          resolve(cookie);
        } catch (e) {
          // reject without retrying.
          if (e.status && e.status === 429) {
            return reject("RateLimitExceeded");
          }

          // retry operation
          if (operation.retry()) {
            return;
          }

          reject(e);
        }
      });
    });
  }

  /**
   * Get games with cards left to farm
   */
  async getFarmingData(): Promise<FarmData[]> {
    if (!this._cookie) throw Error("Cookie is not set.");

    const url = `https://steamcommunity.com/profiles/${this.steamid}/badges`;
    const operation = new retry(operationOptions);

    return new Promise((resolve, reject) => {
      operation.attempt(async () => {
        try {
          const res = await fetch(url, fetchOptions).then((res) => {
            if (res.ok) return res.text();
            throw res;
          });

          const data: FarmData[] = this.parseFarmingData(res);
          resolve(data);
        } catch (e) {
          if (e.status) {
            if (e.status === 429) return reject("RateLimitExceeded");
            if (e.status === 401) return reject("Unauthorized");
          }

          if (operation.retry()) {
            return;
          }

          reject(e);
        }
      });
    });
  }

  /**
   * Get cards inventory
   */
  async getCardsInventory(): Promise<Item[]> {
    if (!this._cookie) throw Error("Cookie is not set.");
    const contextId = "6"; // trading cards
    const url = `https://steamcommunity.com/profiles/${this.steamid}/inventory/json/753/${contextId}`;
    const operation = new retry(operationOptions);

    return new Promise((resolve, reject) => {
      operation.attempt(async () => {
        try {
          const data = await fetch(url, fetchOptions).then((res) => {
            if (res.ok) return res.json();
            throw res;
          });

          const items = this.parseItems(data as Inventory, contextId);
          resolve(items);
        } catch (e) {
          if (e.status) {
            if (e.status === 429) return reject("RateLimitExceeded");
            if (e.status === 401) return reject("Unauthorized");
          }

          if (operation.retry()) {
            return;
          }

          reject(e);
        }
      });
    });
  }

  /**
   * Change account profile avatar
   */
  async changeAvatar(avatar: Avatar): Promise<string> {
    if (!this._cookie) throw Error("Cookie is not set.");

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

    const operation = new retry(operationOptions);

    return new Promise((resolve, reject) => {
      operation.attempt(async () => {
        try {
          const res: any = await fetch(url, { ...fetchOptions, method: "POST", body: form as BodyInit }).then((res) => {
            if (res.ok) return res.json();
            throw res;
          });

          if (res.success) {
            resolve(res.images.full);
          } else {
            reject(`Avatar upload failed: ${res.message}`);
          }
        } catch (e) {
          if (e.status) {
            if (e.status === 429) return reject("RateLimitExceeded");
            if (e.status === 401) return reject("Unauthorized");
          }

          if (operation.retry()) {
            return;
          }

          reject(e);
        }
      });
    });
  }

  /**
   * Clear account's previous aliases
   */
  async clearAliases(): Promise<void> {
    if (!this._cookie) throw Error("Cookie is not set.");
    const url = `https://steamcommunity.com/profiles/${this.steamid}/ajaxclearaliashistory/`;

    const params = new URLSearchParams();
    params.append("sessionid", this._cookie.sessionid);
    const operation = new retry(operationOptions);

    return new Promise((resolve, reject) => {
      operation.attempt(async () => {
        try {
          const res = await fetch(url, { ...fetchOptions, method: "POST", body: params });
          if (!res.ok) throw res;
          resolve();
        } catch (e) {
          if (e.status) {
            if (e.status === 429) return reject("RateLimitExceeded");
            if (e.status === 401) return reject("Unauthorized");
          }

          if (operation.retry()) {
            return;
          }

          reject(e);
        }
      });
    });
  }

  /**
   * Change account's privacy settings
   */
  async changePrivacy(settings: PrivacySettings): Promise<void> {
    if (!this._cookie) throw Error("Cookie is not set.");
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

    const operation = new retry(operationOptions);

    return new Promise((resolve, reject) => {
      operation.attempt(async () => {
        try {
          const res = await fetch(url, { ...fetchOptions, method: "POST", body: form as BodyInit });
          if (!res.ok) throw res;
          resolve();
        } catch (e) {
          if (e.status) {
            if (e.status === 429) return reject("RateLimitExceeded");
            if (e.status === 401) return reject("Unauthorized");
          }

          if (operation.retry()) {
            return;
          }

          reject(e);
        }
      });
    });
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
    const $ = cheerio.load(html);

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
