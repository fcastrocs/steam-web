import { Headers } from "node-fetch";
import { SocksProxyAgentOptions } from "socks-proxy-agent";

export interface Options {
  agentOptions?: SocksProxyAgentOptions;
}

interface FetchOptions {
  agent: Agent;
  headers: Headers;
}

export default interface ISteamWeb {
  /**
   * Login to steam with refresh_token
   * (takes longer than with access_token)
   * @returns Cookie header
   */
  loginWithRefreshToken(refreshToken: string): Promise<void>;
  /**
   * Login to steam with access_token
   * @returns auth cookie
   */
  loginWithAccessToken(accessToken: string): Promise<void>;
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

interface FinalizeloginRes {
  steamID: string;
  redir: string;
  transfer_info: { url: string; params: { nonce: string; auth: string } }[];
  primary_domain: string;
  success?: boolean;
  error?: number;
}

interface Payload {
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

interface Notifications {
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
