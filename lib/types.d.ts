/**
 * Steamcommunity
 */
interface FarmData {
    name: string;
    appId: number;
    playTime: number;
    remainingCards: number;
    droppedCards: number;
}
interface Item {
    assetid: string;
    amount: string;
    icon: string;
    name: string;
    type: string;
    tradable: boolean;
    contextId: string;
}
interface Cookie {
    sessionid: string;
    steamLoginSecure: string;
}
interface Inventory {
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
interface Proxy {
    ip: string;
    port: number;
}
