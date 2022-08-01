import { SocksProxyAgentOptions } from "socks-proxy-agent";

export interface Options {
  agentOptions?: SocksProxyAgentOptions;
  steamid: string;
  webNonce?: string;
  cookie?: Cookie;
}

export default class Steamcommunity {
  private readonly steamid;
  private readonly webNonce;
  private cookie;
  constructor(options: Options);
  /**
   * Set cookie from JSON string
   */
  setCookie(cookie: Cookie): void;
  /**
   * Login via Steam API to obtain a cookie session
   */
  login(): Promise<Cookie>;
  /**
   * Get games with cards left to farm
   */
  getFarmableGames(): Promise<FarmableGame[]>;
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
  changePrivacy(privacy: ProfilePrivacy): Promise<void>;
  /**
   * Helper function for getCardsInventory
   */
  private parseItems;
  /**
   * Helper function for getFarmableGames
   */
  private parseFarmingData;
  private stringifyCookie;
}

export interface FarmableGame {
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

export interface Avatar {
  buffer: Buffer;
  type: "image/jpeg" | "image/png";
}

export type ProfilePrivacy = "public" | "friendsOnly" | "private";

interface AvatarUploadResponse {
  success: boolean;
  images: { "0": string; full: string; medium: string };
  hash: string;
  message: string;
}

interface InventoryResponse {
  success: boolean;
  Error?: string;
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

interface LoginResponse {
  authenticateuser: {
    token: string;
    tokensecure: string;
  };
}

interface PrivacyResponce {
  success: number;
  Privacy: {
    PrivacySettings: {
      PrivacyProfile: number;
      PrivacyInventory: number;
      PrivacyInventoryGifts: number;
      PrivacyOwnedGames: number;
      PrivacyPlaytime: number;
      PrivacyFriendsList: number;
    };
    eCommentPermission: number;
  };
}
