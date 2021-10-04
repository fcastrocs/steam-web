export default class Steamcommunity {
  private steamid;
  private webNonce;
  private proxy;
  private timeout;
  private _cookie;
  constructor(steamid: string, proxy: Proxy, timeout: number, webNonce?: string);
  /**
   * Set cookie from JSON string
   */
  set cookie(cookie: string);
  /**
   * Login via steam web to obtain a cookie session
   * @returns cookie
   */
  login(): Promise<string>;
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

export interface Proxy {
  ip: string;
  port: number;
}

export interface Avatar {
  blob: string;
  type: string;
}
