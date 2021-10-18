"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const form_data_1 = __importDefault(require("form-data"));
const retry_1 = __importDefault(require("@machiavelli/retry"));
const crypto_1 = __importDefault(require("crypto"));
const cheerio_1 = __importDefault(require("cheerio"));
const steam_crypto_ts_1 = __importDefault(require("steam-crypto-ts"));
const socks_proxy_agent_1 = require("socks-proxy-agent");
axios_1.default.defaults.headers = {
    "User-Agent": "Valve/Steam HTTP Client 1.0",
};
const operationOptions = {
    retries: 2,
    interval: 2000,
    noDelay: true,
};
class Steamcommunity {
    constructor(steamid, agentOptions, timeout, webNonce) {
        this.timeout = 5000;
        this.steamid = steamid;
        this.webNonce = webNonce;
        this.agent = new socks_proxy_agent_1.SocksProxyAgent(agentOptions);
        this.timeout = timeout;
    }
    /**
     * Set cookie from JSON string
     */
    set cookie(cookie) {
        this._cookie = JSON.parse(cookie);
        axios_1.default.defaults.headers.Cookie = this.stringifyCookie(this._cookie);
    }
    /**
     * Login via steam web to obtain a cookie session
     * @returns cookie
     */
    async login() {
        if (!this.webNonce)
            throw Error("WebNonce is needed.");
        const url = "https://api.steampowered.com/ISteamUserAuth/AuthenticateUser/v1";
        const operation = new retry_1.default(operationOptions);
        const axiosConfig = {
            url,
            method: "POST",
            timeout: this.timeout,
            httpsAgent: this.agent,
        };
        const _login = async () => {
            const form = new form_data_1.default();
            form.append("steamid", this.steamid);
            const sessionkey = steam_crypto_ts_1.default.generateSessionKey();
            const encrypted_loginkey = steam_crypto_ts_1.default.symmetricEncryptWithHmacIv(this.webNonce, sessionkey.plain);
            form.append("encrypted_loginkey", encrypted_loginkey);
            form.append("sessionkey", sessionkey.encrypted);
            axiosConfig.data = form;
            axiosConfig.headers = form.getHeaders();
            const res = await (0, axios_1.default)(axiosConfig);
            this._cookie = {
                sessionid: crypto_1.default.randomBytes(12).toString("hex"),
                steamLoginSecure: res.data.authenticateuser.tokensecure,
            };
            return JSON.stringify(this._cookie);
        };
        return new Promise((resolve, reject) => {
            operation.attempt(async () => {
                try {
                    const cookie = await _login();
                    resolve(cookie);
                }
                catch (e) {
                    // reject without retrying.
                    if (e.response && e.response.status === 429) {
                        return reject("RateLimitExceeded");
                    }
                    // retry operation
                    if (operation.retry()) {
                        return;
                    }
                    reject(e);
                }
            });
        });
    }
    /**
     * Get games with cards left to farm
     */
    async getFarmingData() {
        if (!this._cookie)
            throw Error("Cookie is not set.");
        const url = `https://steamcommunity.com/profiles/${this.steamid}/badges`;
        const operation = new retry_1.default(operationOptions);
        const axiosConfig = {
            url,
            method: "GET",
            timeout: this.timeout,
            httpsAgent: this.agent,
        };
        return new Promise((resolve, reject) => {
            operation.attempt(async () => {
                try {
                    const res = await (0, axios_1.default)(axiosConfig);
                    const data = this.parseFarmingData(res.data);
                    resolve(data);
                }
                catch (e) {
                    if (e.response && e.response.status === 429) {
                        return reject("RateLimitExceeded");
                    }
                    if (operation.retry()) {
                        return;
                    }
                    if (e.response) {
                        return reject(`farmdata failed: ${e.response.statusText}`);
                    }
                    reject(e);
                }
            });
        });
    }
    /**
     * Get cards inventory
     */
    async getCardsInventory() {
        if (!this._cookie)
            throw Error("Cookie is not set.");
        const contextId = "6"; // trading cards
        const url = `https://steamcommunity.com/profiles/${this.steamid}/inventory/json/753/${contextId}`;
        const operation = new retry_1.default(operationOptions);
        const axiosConfig = {
            url,
            method: "GET",
            timeout: this.timeout,
            httpsAgent: this.agent,
        };
        return new Promise((resolve, reject) => {
            operation.attempt(async () => {
                try {
                    const res = await (0, axios_1.default)(axiosConfig);
                    const data = res.data;
                    const items = this.parseItems(data, contextId);
                    resolve(items);
                }
                catch (e) {
                    if (e.response && e.response.status === 429) {
                        return reject("RateLimitExceeded");
                    }
                    if (operation.retry()) {
                        return;
                    }
                    if (e.response) {
                        return reject(`inventory failed: ${e.response.statusText}`);
                    }
                    reject(e);
                }
            });
        });
    }
    /**
     * Change account profile avatar
     */
    async changeAvatar(avatar) {
        if (!this._cookie)
            throw Error("Cookie is not set.");
        const formData = new form_data_1.default();
        formData.append("avatar", avatar.buffer, { filename: "blob", contentType: avatar.type });
        formData.append("type", "player_avatar_image");
        formData.append("sId", this.steamid);
        formData.append("sessionid", this._cookie.sessionid);
        formData.append("doSub", 1);
        formData.append("json", 1);
        const operation = new retry_1.default(operationOptions);
        const axiosConfig = {
            url: "https://steamcommunity.com/actions/FileUploader/",
            method: "POST",
            timeout: this.timeout,
            httpsAgent: this.agent,
            headers: { "Content-Type": `multipart/form-data; boundary=${formData.getBoundary()}` },
            data: formData,
        };
        return new Promise((resolve, reject) => {
            operation.attempt(async () => {
                try {
                    const res = await (0, axios_1.default)(axiosConfig);
                    if (res.data.success) {
                        resolve(res.data.images.full);
                    }
                    else {
                        reject(res.data.message);
                    }
                }
                catch (e) {
                    if (operation.retry()) {
                        return;
                    }
                    reject(e);
                }
            });
        });
    }
    /**
     * Clear account's previous aliases
     */
    async clearAliases() {
        if (!this._cookie)
            throw Error("Cookie is not set.");
        const params = new URLSearchParams();
        params.append("sessionid", this._cookie.sessionid);
        const operation = new retry_1.default(operationOptions);
        const axiosConfig = {
            url: `https://steamcommunity.com/profiles/${this.steamid}/ajaxclearaliashistory/`,
            method: "POST",
            timeout: this.timeout,
            httpsAgent: this.agent,
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            data: params,
        };
        return new Promise((resolve, reject) => {
            operation.attempt(async () => {
                try {
                    await (0, axios_1.default)(axiosConfig);
                    resolve();
                }
                catch (e) {
                    if (operation.retry()) {
                        return;
                    }
                    reject(e);
                }
            });
        });
    }
    /**
     * Change account's privacy settings
     */
    async changePrivacy(settings) {
        if (!this._cookie)
            throw Error("Cookie is not set.");
        const formData = new form_data_1.default();
        formData.append("sessionid", this._cookie.sessionid);
        const Privacy = {};
        for (const [key, value] of Object.entries(settings)) {
            if (key !== "eCommentPermission") {
                Privacy[key] = value;
            }
        }
        formData.append("Privacy", JSON.stringify(Privacy));
        formData.append("eCommentPermission", settings.eCommentPermission);
        const operation = new retry_1.default(operationOptions);
        const axiosConfig = {
            url: `https://steamcommunity.com/profiles/${this.steamid}/ajaxsetprivacy/`,
            method: "POST",
            timeout: this.timeout,
            httpsAgent: this.agent,
            data: formData,
            headers: formData.getHeaders(),
        };
        return new Promise((resolve, reject) => {
            operation.attempt(async () => {
                try {
                    await (0, axios_1.default)(axiosConfig);
                    resolve();
                }
                catch (e) {
                    if (operation.retry()) {
                        return;
                    }
                    reject(e);
                }
            });
        });
    }
    /**
     * Helper function for getCardsInventory
     */
    parseItems(data, contextId) {
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
     * Helper function for getFarmingData
     */
    parseFarmingData(html) {
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
    stringifyCookie(cookie) {
        return `sessionid=${cookie.sessionid}; steamLoginSecure=${cookie.steamLoginSecure};`;
    }
}
exports.default = Steamcommunity;
