"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCardsInventory = exports.getFarmingData = exports.login = void 0;
const axios_1 = __importDefault(require("axios"));
const form_data_1 = __importDefault(require("form-data"));
const retry_1 = __importDefault(require("retry"));
const crypto_1 = __importDefault(require("crypto"));
const cheerio_1 = __importDefault(require("cheerio"));
const steam_crypto_ts_1 = __importDefault(require("steam-crypto-ts"));
const HttpsAgent = require("https-proxy-agent");
axios_1.default.defaults.headers = {
    "User-Agent": "Valve/Steam HTTP Client 1.0",
};
const operationOptions = {
    retries: Number(process.env.STEAMACCOUNT_RECCONNECT_RETRIES),
    maxTimeout: 2000,
};
/**
 * Login via steam web to obtain a cookie
 */
async function login(steamid, webNonce, proxy) {
    const url = "https://api.steampowered.com/ISteamUserAuth/AuthenticateUser/v1";
    const operation = retry_1.default.operation(operationOptions);
    const config = {
        url,
        method: "POST",
        timeout: Number(process.env.STEAMCOMMUNITY_TIMEOUT),
        httpsAgent: new HttpsAgent(`http://${proxy.ip}:${proxy.port}`),
    };
    return new Promise((resolve, reject) => {
        operation.attempt(async () => {
            // regenerate form during retries otherwise will reject
            const form = new form_data_1.default();
            form.append("steamid", steamid);
            const sessionkey = steam_crypto_ts_1.default.generateSessionKey();
            const encrypted_loginkey = steam_crypto_ts_1.default.symmetricEncryptWithHmacIv(webNonce, sessionkey.plain);
            form.append("encrypted_loginkey", encrypted_loginkey);
            form.append("sessionkey", sessionkey.encrypted);
            config.data = form;
            config.headers = form.getHeaders();
            try {
                const res = await (0, axios_1.default)(config);
                const cookie = {
                    sessionid: crypto_1.default.randomBytes(12).toString("hex"),
                    steamLoginSecure: res.data.authenticateuser.tokensecure,
                };
                resolve(cookie);
            }
            catch (e) {
                if (e.response && e.response.status === 429) {
                    return reject("RateLimitExceeded");
                }
                if (operation.retry(e)) {
                    return;
                }
                if (e.response) {
                    console.error(`weblogin failed: ${e.response.statusText}`);
                    return reject(`weblogin failed`);
                }
                console.error(e);
                reject("weblogin failed");
            }
        });
    });
}
exports.login = login;
/**
 * Get games with cards left to farm
 */
async function getFarmingData(steamid, cookie, proxy) {
    const url = `https://steamcommunity.com/profiles/${steamid}/badges`;
    const serializedCookie = serializeCookie(cookie);
    const operation = retry_1.default.operation(operationOptions);
    const config = {
        url,
        method: "GET",
        timeout: Number(process.env.STEAMCOMMUNITY_TIMEOUT),
        httpsAgent: new HttpsAgent(`http://${proxy.ip}:${proxy.port}`),
        headers: {
            Cookie: serializedCookie,
        },
    };
    return new Promise((resolve, reject) => {
        operation.attempt(async () => {
            try {
                const res = await (0, axios_1.default)(config);
                const data = parseFarmingData(res.data);
                resolve(data);
            }
            catch (e) {
                if (e.response && e.response.status === 429) {
                    return reject("RateLimitExceeded");
                }
                if (operation.retry(e)) {
                    return;
                }
                if (e.response) {
                    console.error(`farmdata failed: ${e.response.statusText}`);
                    return reject(`farmdata failed`);
                }
                console.error(e);
                reject("farmdata failed");
            }
        });
    });
}
exports.getFarmingData = getFarmingData;
/**
 * Get cards inventory
 */
async function getCardsInventory(steamid, cookie, proxy) {
    const contextId = "6"; // trading cards
    const url = `https://steamcommunity.com/profiles/${steamid}/inventory/json/753/${contextId}`;
    const serializedCookie = serializeCookie(cookie);
    const operation = retry_1.default.operation(operationOptions);
    const config = {
        url,
        method: "GET",
        timeout: Number(process.env.STEAMCOMMUNITY_TIMEOUT),
        httpsAgent: new HttpsAgent(`http://${proxy.ip}:${proxy.port}`),
        headers: {
            Cookie: serializedCookie,
        },
    };
    return new Promise((resolve, reject) => {
        operation.attempt(async () => {
            try {
                const res = await (0, axios_1.default)(config);
                const data = res.data;
                const items = parseItems(data, contextId);
                resolve(items);
            }
            catch (e) {
                if (e.response && e.response.status === 429) {
                    return reject("RateLimitExceeded");
                }
                if (operation.retry(e)) {
                    return;
                }
                if (e.response) {
                    console.error(`inventory failed: ${e.response.statusText}`);
                    return reject(`inventory failed`);
                }
                console.error(e);
                reject("inventory failed");
            }
        });
    });
}
exports.getCardsInventory = getCardsInventory;
/**
 * Helper function for getFarmingData
 */
function parseFarmingData(html) {
    const $ = cheerio_1.default.load(html);
    const farmData = [];
    $(".badge_row").each((index, badge) => {
        let playTime = 0;
        let remainingCards = 0;
        let name = "";
        let appId = 0;
        let droppedCards = 0;
        // check for remaining cards
        const progress = $(badge).find(".progress_info_bold");
        if (!progress) {
            return;
        }
        const remainingCardsText = progress.text();
        // can also include "tasks remaining"
        if (!remainingCardsText.includes("card drops remaining")) {
            return;
        }
        remainingCards = Number(remainingCardsText.match(/\d+/));
        if (remainingCards === 0) {
            return;
        }
        // Get play time
        let playTimeText = $(badge).find(".badge_title_stats_playtime").text();
        if (!playTimeText) {
            return;
        }
        if (playTimeText.includes("hrs on record")) {
            // hrs could be displayed as x,xxx format or xx.xx
            playTimeText = playTimeText.replace(",", "");
            playTime = Number(playTimeText.match(/\d+(\.\d+)?/g));
        }
        // Get game title
        // remove details first...
        $(badge).find(".badge_view_details").remove();
        name = $(badge).find(".badge_title").text().replace("/&nbsp;", "").trim();
        // Get appID
        let link = $(badge).find(".badge_row_overlay").attr("href");
        if (!link)
            return;
        link = link.substring(link.indexOf("gamecards"), link.length);
        appId = Number(link.match(/\d+/));
        // Get dropped cards
        $(badge)
            .find(".card_drop_info_header")
            .each((index, header) => {
            const text = $(header).text();
            if (text.includes("Card drops received")) {
                droppedCards = Number(text.match(/\d+(\.\d+)?/g));
                return;
            }
        });
        farmData.push({ name, appId, playTime, remainingCards, droppedCards });
    });
    return farmData;
}
/**
 * Helper function for getCardsInventory
 */
function parseItems(data, contextId) {
    const inventory = data.rgInventory;
    const description = data.rgDescriptions;
    const items = [];
    for (const key in inventory) {
        const c_i = inventory[key].classid + "_" + inventory[key].instanceid;
        items.push({
            assetid: inventory[key].id,
            amount: inventory[key].amount,
            icon: description[c_i].icon_url,
            name: description[c_i].name,
            type: description[c_i].type,
            tradable: description[c_i].tradable == 1,
            contextId,
        });
    }
    return items;
}
/**
 * serialize cookie to use in http headers
 */
function serializeCookie(cookie) {
    return `sessionid=${cookie.sessionid}; steamLoginSecure=${cookie.steamLoginSecure};`;
}
//# sourceMappingURL=index.js.map