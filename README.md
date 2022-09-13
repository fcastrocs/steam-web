# @machiavelli/steam-web

steam-web is a library to interact with steamcommunity.com. It provides an easy API to important account data that is otherwise hard to obtain programmatically without scraping it.

## Features
- New steam login support (JWT)
- Login using access_token.
- Login using refresh_token.
- Proxy support.
- Make requests behind authentication walls to scrape account data. (i.e. get farmable games with trading cards ...)
- Take actions against account (i.e. change privacy, avatar ...)

## Usage

```javascript
import SteamWeb from "@machiavelli/steam-web";

// token: access_token or refresh_token
// these tokens are obtainable through the steam-client (todo: insert link to steam-client)
const token = access_token || refresh_token;

// direct connect
const steamWeb = new SteamWeb();
await steamWeb.login(token);

// example for socks proxy, you may use http/https as well
import { SocksProxyAgent } from "socks-proxy-agent";
const info = {
  hostname: "br41.nordvpn.com",
  userId: "your-name@gmail.com",
  password: "abcdef12345124",
};
const agent = new SocksProxyAgent(info);

const steamWeb = new SteamWeb({ agent });
await steamWeb.login(token);
```

## Interfaces

```javascript
// constructor options
interface Options {
  agent?: Agent;
}

interface SteamWeb {
  /**
   * Login to Steamcommunity.com
   * token: access_token or refresh_token
   */
  login(token: string): Promise<void>;
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
```
