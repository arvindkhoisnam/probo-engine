"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateStockBalance = void 0;
const engine_1 = require("../engine");
function updateStockBalance(userId, stockSymbol, stockType, quantity) {
    var _a;
    const existingStockSymbol = engine_1.Engine.getInstance().stockBalances[userId].hasOwnProperty(stockSymbol);
    const existingStockType = (_a = engine_1.Engine.getInstance().stockBalances[userId][stockSymbol]) === null || _a === void 0 ? void 0 : _a.hasOwnProperty(stockType);
    if (!existingStockSymbol) {
        engine_1.Engine.getInstance().stockBalances[userId] = Object.assign(Object.assign({}, engine_1.Engine.getInstance().stockBalances[userId]), { [stockSymbol]: {
                [stockType]: {
                    quantity: quantity,
                    locked: 0,
                },
            } });
        return;
    }
    if (!existingStockType) {
        engine_1.Engine.getInstance().stockBalances[userId][stockSymbol] = Object.assign(Object.assign({}, engine_1.Engine.getInstance().stockBalances[userId][stockSymbol]), { [stockType]: {
                quantity: quantity,
                locked: 0,
            } });
        return;
    }
    if (existingStockType) {
        engine_1.Engine.getInstance().stockBalances[userId][stockSymbol][stockType].quantity += quantity;
        return;
    }
}
exports.updateStockBalance = updateStockBalance;
