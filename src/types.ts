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
