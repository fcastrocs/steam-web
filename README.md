# @machiavelli/steam-web
steam-web is a library to interact with steamcommunity.com. It provides an easy API to important account data that is otherwise hard to obtain programmatically without scraping it.

## Features
- Login using access_token.
- Login using refresh_token.
- Make requests behind authentication walls to scrape account data.
- Take actions against account (i.e. change privacy, avatar ...)

## Usage
```javascript 
const steamWeb = new SteamWeb();
await steamWeb.login(token);
// token can be access_token or refresh_token
// these tokens are obtainable through the steam-client (todo: insert link to steam-client)
```

```javascript
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