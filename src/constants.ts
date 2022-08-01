import { SteamcommunityError } from "./index.js";
import { RequestInit } from "node-fetch";

export const fetchOptions: RequestInit = {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36",
  },
};

export const ERRORS = {
  NEED_WEBNONCE: new SteamcommunityError("NeedWebNonce"),
  RATE_LIMIT: new SteamcommunityError("RateLimitExceeded"),
  NEED_COOKIE: new SteamcommunityError("NeedCookie"),
  COOKIE_EXPIRED: new SteamcommunityError("CookieExpired"),
  BAD_REQUEST: new SteamcommunityError("BadRequest"),
} as const;
