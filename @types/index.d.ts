import { Agent } from "http";
import { Headers } from "node-fetch";
import SteamWebError from "SteamWebError";

export { SteamWebError };

export default class ISteamWeb {
  constructor(options?: Options);

  /**
   * Re-use a previous session, thus we don't have to login again
   */
  setSession(session: Session): Promise<void>;
  /**
   * Login to Steamcommunity.com
   * token: access_token or refresh_token
   */
  login(token: string): Promise<Session>;
  /**
   * Logout and destroy cookies
   */
  logout(): Promise<void>;
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
  changeAvatar(avatarURL: string): Promise<string>;
  /**
   * Clear account's previous aliases
   */
  clearAliases(): Promise<void>;
  /**
   * Change account's privacy settings
   */
  changePrivacy(privacy: ProfilePrivacy): Promise<void>;
  /**
   * Get avatar frame
   */
  getAvatarFrame(): Promise<string>;
}

export interface Options {
  agent?: Agent;
}

export interface FetchOptions {
  agent: Agent;
  headers: Headers;
}

export interface Session {
  cookies: string;
  sessionid: string;
  steamid: string;
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

export type ProfilePrivacy = "public" | "friendsOnly" | "private";

export interface AvatarUploadResponse {
  success: boolean;
  images: { "0": string; full: string; medium: string };
  hash: string;
  message: string;
}

export interface InventoryResponse {
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

export interface FinalizeloginRes {
  steamID: string;
  redir: string;
  transfer_info: { url: string; params: { nonce: string; auth: string } }[];
  primary_domain: string;
  success?: boolean;
  error?: number;
}

export interface Payload {
  iss: string;
  sub: string;
  aud: string[];
  exp: number;
  nbf: number;
  iat: number;
  jti: string;
  oat: number;
  per: number;
  ip_subject: string;
  ip_confirmer: string;
}

export interface Notifications {
  notifications: {
    "1": number;
    "2": number;
    "3": number;
    "4": number;
    "5": number;
    "6": number;
    "8": number;
    "9": number;
    "10": number;
    "11": number;
  };
}
