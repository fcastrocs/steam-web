export default class SteamcommunityError extends Error {
  constructor(message: string) {
    super(message);
    super.name = "steamcommunity-api";
  }
}
