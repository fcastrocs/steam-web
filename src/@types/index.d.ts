/**
 * Login via steam web to obtain a cookie session
 */
export declare function login(steamid: string, webNonce: string, proxy: Proxy): Promise<Cookie>;
/**
 * Get games with cards left to farm
 */
export declare function getFarmingData(steamid: string, cookie: Cookie, proxy: Proxy): Promise<FarmData[]>;
/**
 * Get cards inventory
 */
export declare function getCardsInventory(steamid: string, cookie: Cookie, proxy: Proxy): Promise<Item[]>;

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
