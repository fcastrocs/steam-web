# @machiavelli/steam-web

steam-web is a library to interact with steamcommunity.com. It provides an easy API to important account data that is otherwise hard to obtain programmatically without scraping it.

## Features
- New steam login support (JWT)
- Login using access_token.
- Login using refresh_token.
- Re-use previous session.
- Proxy support.

## Usage

### connect directly
```javascript
import SteamWeb from "@machiavelli/steam-web";

// these tokens are obtainable through the steam-client
const token = access_token || refresh_token;

const steamWeb = new SteamWeb();
const session = await steamWeb.login(token);
```

### connect through proxy
```javascript
import SteamWeb from "@machiavelli/steam-web";
import { SocksProxyAgent } from "socks-proxy-agent";

const info = {
  hostname: "br41.nordvpn.com",
  userId: "your-name@gmail.com",
  password: "abcdef12345124",
};
const agent = new SocksProxyAgent(info);

const steamWeb = new SteamWeb({ agent });
cosnt session = await steamWeb.login(token);
```

### Re-use previous session to skip login
```javascript
import SteamWeb from "@machiavelli/steam-web";
import { SocksProxyAgent } from "socks-proxy-agent";


// session is returned by login()
const steamWeb = new SteamWeb();
await steamWeb.setSession(session);
```

## Methods

```javascript
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

```
