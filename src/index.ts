import axios, { AxiosRequestConfig } from "axios";
import FormData, { from } from "form-data";
import retry from "retry";
import Crypto from "crypto";
import cheerio from "cheerio";
import SteamCrypto from "steam-crypto-ts";
import { SocksProxyAgent } from "socks-proxy-agent";
// import types
import { Avatar, Cookie, FarmData, Inventory, Item, Proxy } from "./@types/";

axios.defaults.headers = {
  "User-Agent": "Valve/Steam HTTP Client 1.0",
};

const operationOptions: retry.OperationOptions = {
  retries: 2,
  maxTimeout: 2000,
};

export default class Steamcommunity {
  private steamid: string;
  private webNonce: string;
  private proxy: Proxy;
  private timeout = 5000;
  private _cookie: Cookie;

  constructor(steamid: string, proxy: Proxy, timeout: number, webNonce?: string) {
    this.steamid = steamid;
    this.webNonce = webNonce;
    this.proxy = proxy;
    this.timeout = timeout;
  }

  /**
   * Set cookie from JSON string
   */
  public set cookie(cookie: string) {
    this._cookie = JSON.parse(cookie);
    axios.defaults.headers.Cookie = this.stringifyCookie(this._cookie);
  }

  /**
   * Login via steam web to obtain a cookie session
   * @returns cookie
   */
  async login(): Promise<string> {
    if (!this.webNonce) throw Error("WebNonce is needed.");
    const url = "https://api.steampowered.com/ISteamUserAuth/AuthenticateUser/v1";
    const operation = retry.operation(operationOptions);

    const config: AxiosRequestConfig = {
      url,
      method: "POST",
      timeout: this.timeout,
      httpsAgent: new SocksProxyAgent(`socks://${this.proxy.ip}:${this.proxy.port}`),
    };

    return new Promise((resolve, reject) => {
      operation.attempt(async () => {
        // regenerate form during retries otherwise will reject
        const form = new FormData();
        form.append("steamid", this.steamid);
        const sessionkey = SteamCrypto.generateSessionKey();
        const encrypted_loginkey = SteamCrypto.symmetricEncryptWithHmacIv(this.webNonce, sessionkey.plain);
        form.append("encrypted_loginkey", encrypted_loginkey);
        form.append("sessionkey", sessionkey.encrypted);

        config.data = form;
        config.headers = form.getHeaders();

        try {
          const res = await axios(config);
          this._cookie = {
            sessionid: Crypto.randomBytes(12).toString("hex"),
            steamLoginSecure: res.data.authenticateuser.tokensecure,
          };
          resolve(JSON.stringify(this._cookie));
        } catch (e) {
          if (e.response && e.response.status === 429) {
            return reject("RateLimitExceeded");
          }

          if (operation.retry(e)) {
            return;
          }

          if (e.response) {
            return reject(`weblogin failed: ${e.response.statusText}`);
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
    const operation = retry.operation(operationOptions);

    const config: AxiosRequestConfig = {
      url,
      method: "GET",
      timeout: this.timeout,
      httpsAgent: new SocksProxyAgent(`socks://${this.proxy.ip}:${this.proxy.port}`),
    };

    return new Promise((resolve, reject) => {
      operation.attempt(async () => {
        try {
          const res = await axios(config);
          const data: FarmData[] = this.parseFarmingData(res.data);
          resolve(data);
        } catch (e) {
          if (e.response && e.response.status === 429) {
            return reject("RateLimitExceeded");
          }

          if (operation.retry(e)) {
            return;
          }

          if (e.response) {
            return reject(`farmdata failed: ${e.response.statusText}`);
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

    const operation = retry.operation(operationOptions);

    const config: AxiosRequestConfig = {
      url,
      method: "GET",
      timeout: this.timeout,
      httpsAgent: new SocksProxyAgent(`socks://${this.proxy.ip}:${this.proxy.port}`),
    };

    return new Promise((resolve, reject) => {
      operation.attempt(async () => {
        try {
          const res = await axios(config);
          const data: Inventory = res.data;
          const items = this.parseItems(data, contextId);
          resolve(items);
        } catch (e) {
          if (e.response && e.response.status === 429) {
            return reject("RateLimitExceeded");
          }

          if (operation.retry(e)) {
            return;
          }

          if (e.response) {
            return reject(`inventory failed: ${e.response.statusText}`);
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

    const formData = new FormData();
    formData.append("avatar", avatar.buffer, { filename: "blob", contentType: avatar.type });
    formData.append("type", "player_avatar_image");
    formData.append("sId", this.steamid);
    formData.append("sessionid", this._cookie.sessionid);
    formData.append("doSub", 1);
    formData.append("json", 1);

    const operation = retry.operation(operationOptions);
    const config: AxiosRequestConfig = {
      url: "https://steamcommunity.com/actions/FileUploader/",
      method: "POST",
      timeout: this.timeout,
      httpsAgent: new SocksProxyAgent(`socks://${this.proxy.ip}:${this.proxy.port}`),
      headers: { "Content-Type": `multipart/form-data; boundary=${formData.getBoundary()}` },
      data: formData,
    };

    return new Promise((resolve, reject) => {
      operation.attempt(async () => {
        try {
          const res = await axios(config);
          if (res.data.success) {
            resolve(res.data.images.full);
          } else {
            reject(res.data.message);
          }
        } catch (e) {
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
    const formData = new FormData();
    formData.append("sessionid", this._cookie.sessionid);

    const operation = retry.operation(operationOptions);
    const config: AxiosRequestConfig = {
      url: `https://steamcommunity.com/profiles/${this.steamid}/ajaxclearaliashistory/`,
      method: "POST",
      timeout: this.timeout,
      httpsAgent: new SocksProxyAgent(`socks://${this.proxy.ip}:${this.proxy.port}`),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      data: formData,
    };

    return new Promise((resolve, reject) => {
      operation.attempt(async () => {
        try {
          const res = await axios(config);
          resolve();
        } catch (e) {
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
