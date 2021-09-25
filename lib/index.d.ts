import { Proxy, Cookie, FarmData, Item } from "./types";
/**
 * Login via steam web to obtain a cookie
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
