"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reverseOrder = void 0;
const Redis_1 = require("../Redis");
function reverseOrder(userId, quantity, price, stockType, sell, clientId) {
    if (stockType === "yes") {
        sell = Object.assign(Object.assign({}, sell), { ["no"]: {
                [String(1000 - price)]: {
                    reverseOrder: true,
                    total: quantity,
                    orders: {
                        [userId]: quantity,
                    },
                },
            } });
        Redis_1.Redis.getInstance().sendToApi(clientId, {
            statusCode: 200,
            payload: `Placed a reverse order for ${quantity} "NO" at ${1000 - price}.`,
        });
    }
    else if (stockType === "no") {
        sell = Object.assign(Object.assign({}, sell), { ["yes"]: {
                [String(1000 - price)]: {
                    reverseOrder: true,
                    total: quantity,
                    orders: {
                        [userId]: quantity,
                    },
                },
            } });
        Redis_1.Redis.getInstance().sendToApi(clientId, {
            statusCode: 200,
            payload: `Placed a reverse order for ${quantity} "YES" at ${1000 - price}.`,
        });
    }
}
exports.reverseOrder = reverseOrder;
