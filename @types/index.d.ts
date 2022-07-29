import { SocksProxyAgentOptions } from "socks-proxy-agent";

export interface Options {
  agentOptions?: SocksProxyAgentOptions;
  steamid: string;
  webNonce?: string;
  cookie?: Cookie;
}

export type Errors = "NeedCookie" | "RateLimitExceeded" | "Unauthorized";

export default class Steamcommunity {
  private readonly steamid;
  private readonly webNonce;
  private _cookie;
  constructor(options: Options);
  /**
   * Set cookie from JSON string
   */
  set cookie(cookie: Cookie);
  /**
   * Login via Steam API to obtain a cookie session
   * @returns cookie
   */
  login(): Promise<Cookie>;
  /**
   * Get games with cards left to farm
   */
  getFarmingData(): Promise<FarmData[]>;
  /**
   * Get cards inventory
   */
  getCardsInventory(): Promise<Item[]>;
  /**
   * Change account profile avatar
   */
  changeAvatar(avatar: Avatar): Promise<string>;
  /**
   * Clear account's previous aliases
   */
  clearAliases(): Promise<void>;
  /**
   * Change account's privacy settings
   */
  changePrivacy(settings: PrivacySettings): Promise<void>;
  /**
   * Helper function for getCardsInventory
   */
  private parseItems;
  /**
   * Helper function for getFarmingData
   */
  private parseFarmingData;
  private stringifyCookie;
}

export interface FarmData {
  name: string;
  appId: number;
  playTime: number;
  remainingCards: number;
  droppedCards: number;
}

export interface Item {
  assetid: string;
  amount: string;
  icon: string;
  name: string;
  type: string;
  tradable: boolean;
  contextId: string;
}

export interface Cookie {
  sessionid: string;
  steamLoginSecure: string;
}

export interface Inventory {
  rgInventory: {
    [key: string]: {
      id: string;
      classid: string;
      instanceid: string;
      amount: string;
    };
  };
  rgDescriptions: {
    [key: string]: {
      icon_url: string;
      name: string;
      type: string;
      tradable: number;
    };
  };
}

export interface Avatar {
  buffer: Buffer;
  type: string;
}

export type ProfilePrivacy = "public" | "friendsOnly" | "private";
