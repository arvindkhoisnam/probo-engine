"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchSellOrders = exports.matchBuyOrders = void 0;
const engine_1 = require("../engine");
const calcFillableQuantity_1 = require("./calcFillableQuantity");
const updateStockBalance_1 = require("./updateStockBalance");
function matchBuyOrders(userId, stockType, quantity, price, buy, stockSymbol) {
    const arr = Object.entries(buy[stockType]).reverse();
    let maxFillableQuant = (0, calcFillableQuantity_1.calcFillableSELLQuantity)(quantity, price, arr);
    let executedOrders = 0;
    let LTP = 0;
    arr.forEach(([key, value]) => {
        const [buyer] = Object.keys(value.orders);
        if (price <= Number(key) && maxFillableQuant > 0) {
            let toFill = Math.min(value.total, maxFillableQuant);
            maxFillableQuant -= toFill;
            value.total -= toFill;
            value.orders[buyer] -= toFill;
            executedOrders += toFill;
            LTP = Number(key);
            engine_1.Engine.getInstance().inrbalances[buyer].balance -= toFill * Number(key);
            engine_1.Engine.getInstance().inrbalances[userId].balance += toFill * Number(key);
            engine_1.Engine.getInstance().stockBalances[userId][stockSymbol][stockType].locked -= toFill;
            (0, updateStockBalance_1.updateStockBalance)(buyer, stockSymbol, stockType, quantity);
            // clean-up
            if (value.total === 0) {
                delete buy[stockType][Number(key)];
            }
            if (Object.keys(buy[stockType]).length === 0) {
                delete buy[stockType];
            }
        }
    });
    const pendingOrders = quantity - executedOrders;
    return { pendingOrders, executedOrders, LTP };
}
exports.matchBuyOrders = matchBuyOrders;
function matchSellOrders(userId, stockType, quantity, price, sell, stockSymbol) {
    const arr = Object.entries(sell[stockType]);
    let maxFillableQuant = (0, calcFillableQuantity_1.calcFillableBUYQuantity)(quantity, price, arr);
    let executedOrders = 0;
    let LTP = 0;
    arr.forEach(([key, value]) => {
        const [seller] = Object.keys(value.orders);
        if (price >= Number(key) && maxFillableQuant > 0) {
            let toFill = Math.min(value.total, maxFillableQuant);
            maxFillableQuant -= toFill;
            value.total -= toFill;
            value.orders[seller] -= toFill;
            executedOrders += toFill;
            LTP = Number(key);
            if (value.reverseOrder) {
                engine_1.Engine.getInstance().inrbalances[seller].locked -=
                    toFill * (1000 - Number(key));
                engine_1.Engine.getInstance().inrbalances[userId].locked -= toFill * Number(key);
                (0, updateStockBalance_1.updateStockBalance)(userId, stockSymbol, stockType, toFill);
                if (stockType === "yes") {
                    (0, updateStockBalance_1.updateStockBalance)(seller, stockSymbol, "no", toFill);
                }
                else {
                    (0, updateStockBalance_1.updateStockBalance)(seller, stockSymbol, "yes", toFill);
                }
            }
            else {
                // credit seller's INR balance
                engine_1.Engine.getInstance().inrbalances[seller].balance +=
                    toFill * Number(key);
                // debit buyer's INR balance
                engine_1.Engine.getInstance().inrbalances[userId].locked -= toFill * Number(key);
                // debit seller's STOCK balances
                engine_1.Engine.getInstance().stockBalances[seller][stockSymbol][stockType].locked -= toFill;
                // credit buyer's STOCK balances
            }
            // clean-up
            if (value.total === 0) {
                delete sell[stockType][Number(key)];
            }
            if (Object.keys(sell[stockType]).length === 0) {
                delete sell[stockType];
            }
        }
    });
    const pendingOrders = quantity - executedOrders;
    return { pendingOrders, executedOrders, LTP };
}
exports.matchSellOrders = matchSellOrders;
