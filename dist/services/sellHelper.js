"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateExistingOrder = exports.addNewUser = exports.addStrikePrice = exports.addStockType = void 0;
function addStockType(OB, userId, stockType, price, quantity) {
    OB = Object.assign(Object.assign({}, OB), { [stockType]: {
            [price]: {
                reverseOrder: false,
                total: quantity,
                orders: {
                    [userId]: quantity,
                },
            },
        } });
    return OB;
}
exports.addStockType = addStockType;
function addStrikePrice(OB, userId, stockType, price, quantity) {
    OB[stockType] = Object.assign(Object.assign({}, OB[stockType]), { [price]: {
            reverseOrder: false,
            total: quantity,
            orders: {
                [userId]: quantity,
            },
        } });
    return OB;
}
exports.addStrikePrice = addStrikePrice;
function addNewUser(OB, userId, stockType, price, quantity) {
    OB[stockType][price].total += quantity;
    OB[stockType][price].orders = Object.assign(Object.assign({}, OB[stockType][price].orders), { [userId]: quantity });
    return OB;
}
exports.addNewUser = addNewUser;
function updateExistingOrder(OB, userId, stockType, price, quantity) {
    OB[stockType][price].total += quantity;
    OB[stockType][price].orders[userId] += quantity;
    return OB;
}
exports.updateExistingOrder = updateExistingOrder;
