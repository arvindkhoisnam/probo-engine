"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderReverse = void 0;
// import { reverseOrder } from "./reverseOrder";
function OrderReverse(OB, userId, stockType, quantity, price) {
    var _a;
    const newStrikePrice = 1000 - Number(price);
    const existingStockType = OB.hasOwnProperty(stockType);
    const existingStrikePrice = (_a = OB[stockType]) === null || _a === void 0 ? void 0 : _a.hasOwnProperty(newStrikePrice);
    if (!existingStockType) {
        OB[stockType] = {
            [newStrikePrice]: {
                reverseOrder: true,
                total: quantity,
                orders: {
                    [userId]: quantity,
                },
            },
        };
    }
    if (!existingStrikePrice) {
        OB[stockType] = Object.assign(Object.assign({}, OB[stockType]), { [newStrikePrice]: {
                reverseOrder: true,
                total: quantity,
                orders: {
                    [userId]: quantity,
                },
            } });
    }
    if (existingStrikePrice) {
        OB[stockType][newStrikePrice].total += quantity;
        OB[stockType][newStrikePrice].orders[userId] += quantity;
    }
    return OB;
}
exports.OrderReverse = OrderReverse;
