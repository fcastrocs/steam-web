export default class SteamWebError extends Error {
  constructor(message: string) {
    super(message);
    super.name = "steam-web";
  }
}
