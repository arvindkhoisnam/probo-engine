"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Orderbook = void 0;
const Redis_1 = require("./Redis");
const buyHelper_1 = require("./services/buyHelper");
const matchOrder_1 = require("./services/matchOrder");
const sellHelper_1 = require("./services/sellHelper");
class Orderbook {
    constructor(stockSymbol, buy, sell, currentYesPrice, currentNoPrice) {
        this.stockSymbol = stockSymbol;
        this.buy = buy;
        this.sell = sell;
        this.currentYesPrice = currentYesPrice;
        this.currentNoPrice = currentNoPrice;
    }
    sellOrder(quantity, price, userId, stockType, clientId) {
        var _a, _b, _c, _d;
        const buyerExists = (_a = this.buy[stockType]) === null || _a === void 0 ? void 0 : _a.hasOwnProperty(price);
        const existingStockType = this.sell.hasOwnProperty(stockType);
        const existingStrikePrice = (_b = this.sell[stockType]) === null || _b === void 0 ? void 0 : _b.hasOwnProperty(price);
        const existingUser = (_d = (_c = this.sell[stockType]) === null || _c === void 0 ? void 0 : _c[price]) === null || _d === void 0 ? void 0 : _d.orders.hasOwnProperty(userId);
        if (buyerExists) {
            const { pendingOrders, executedOrders, LTP } = (0, matchOrder_1.matchBuyOrders)(userId, stockType, quantity, price, this.buy, this.stockSymbol);
            if (pendingOrders > 0) {
                if (!existingStockType) {
                    this.sell = (0, sellHelper_1.addStockType)(this.sell, userId, stockType, price, quantity);
                    this.respondPendingSell(clientId, executedOrders, pendingOrders);
                    return;
                }
                if (!existingStrikePrice) {
                    this.sell = (0, sellHelper_1.addStrikePrice)(this.sell, userId, stockType, price, quantity);
                    this.respondPendingSell(clientId, executedOrders, pendingOrders);
                    return;
                }
                if (!existingUser) {
                    this.sell = (0, sellHelper_1.addNewUser)(this.sell, userId, stockType, price, quantity);
                    this.respondPendingSell(clientId, executedOrders, pendingOrders);
                    return;
                }
                if (existingUser) {
                    this.sell = (0, sellHelper_1.updateExistingOrder)(this.sell, userId, stockType, price, quantity);
                    this.respondPendingSell(clientId, executedOrders, pendingOrders);
                    return;
                }
            }
            // All sell orders matched
            Redis_1.Redis.getInstance().sendToApi(clientId, {
                statusCode: 200,
                payload: {
                    pendingOrders,
                    executedOrders,
                    message: "Trade placed and executed.",
                },
            });
        }
        else {
            if (!existingStockType) {
                this.sell = (0, sellHelper_1.addStockType)(this.sell, userId, stockType, price, quantity);
                this.respondSellOrder(clientId, quantity, stockType, this.stockSymbol, price);
                return;
            }
            if (!existingStrikePrice) {
                this.sell = (0, sellHelper_1.addStrikePrice)(this.sell, userId, stockType, price, quantity);
                this.respondSellOrder(clientId, quantity, stockType, this.stockSymbol, price);
                return;
            }
            if (!existingUser) {
                this.sell = (0, sellHelper_1.addNewUser)(this.sell, userId, stockType, price, quantity);
                this.respondSellOrder(clientId, quantity, stockType, this.stockSymbol, price);
                return;
            }
            if (existingUser) {
                this.sell = (0, sellHelper_1.updateExistingOrder)(this.sell, userId, stockType, price, quantity);
                this.respondSellOrder(clientId, quantity, stockType, this.stockSymbol, price);
                return;
            }
        }
    }
    buyOrder(quantity, price, userId, stockType, clientId) {
        var _a, _b, _c;
        const sellerExists = this.sell.hasOwnProperty(stockType);
        const existingStockType = this.buy.hasOwnProperty(stockType);
        const existingStrikePrice = (_a = this.buy[stockType]) === null || _a === void 0 ? void 0 : _a.hasOwnProperty(price);
        const existingUser = (_c = (_b = this.buy[stockType]) === null || _b === void 0 ? void 0 : _b[price]) === null || _c === void 0 ? void 0 : _c.orders.hasOwnProperty(userId);
        if (sellerExists) {
            const { pendingOrders, executedOrders, LTP } = (0, matchOrder_1.matchSellOrders)(userId, stockType, quantity, price, this.sell, this.stockSymbol);
            if (stockType === "yes") {
                this.currentYesPrice = LTP;
                this.currentNoPrice = 1000 - LTP;
            }
            else {
                this.currentNoPrice = LTP;
                this.currentYesPrice = 1000 - LTP;
            }
            if (pendingOrders > 0) {
                if (stockType === "yes") {
                    (0, buyHelper_1.OrderReverse)(this.sell, userId, "no", pendingOrders, price);
                    Redis_1.Redis.getInstance().sendToApi(clientId, {
                        statusCode: 200,
                        payload: {
                            pendingOrders,
                            executedOrders,
                            message: `Placed a reverser order for ${pendingOrders} "NO" at ${1000 - price}`,
                        },
                    });
                    const newDepth = this.getDepth();
                    Redis_1.Redis.getInstance().publishToPubSub(`depth/${this.stockSymbol}`, JSON.stringify(newDepth));
                }
                else if (stockType === "no") {
                    (0, buyHelper_1.OrderReverse)(this.sell, userId, "yes", pendingOrders, price);
                    Redis_1.Redis.getInstance().sendToApi(clientId, {
                        statusCode: 200,
                        payload: {
                            pendingOrders,
                            executedOrders,
                            message: `Placed a reverser order for ${pendingOrders} "YES" at ${1000 - price}`,
                        },
                    });
                    const newDepth = this.getDepth();
                    console.log(newDepth);
                    Redis_1.Redis.getInstance().publishToPubSub(`depth/${this.stockSymbol}`, JSON.stringify(newDepth));
                }
            }
            Redis_1.Redis.getInstance().sendToApi(clientId, {
                statusCode: 200,
                payload: {
                    pendingOrders,
                    executedOrders,
                    message: "Trade placed and executed.",
                },
            });
            const newDepth = this.getDepth();
            Redis_1.Redis.getInstance().publishToPubSub(`depth/${this.stockSymbol}`, JSON.stringify(newDepth));
            const ticker = this.getTicker();
            Redis_1.Redis.getInstance().publishToPubSub(`ticker/${this.stockSymbol}`, JSON.stringify(ticker));
            return;
        }
        // reverseOrder(userId, quantity, price, stockType, this.sell, clientId);
        if (stockType === "yes") {
            this.buy = (0, buyHelper_1.OrderReverse)(this.sell, userId, "no", quantity, price);
            Redis_1.Redis.getInstance().sendToApi(clientId, {
                statusCode: 200,
                payload: `Placed a reverse order for ${quantity} "NO" at ${1000 - price}.`,
            });
            const newDepth = this.getDepth();
            Redis_1.Redis.getInstance().publishToPubSub(`depth/${this.stockSymbol}`, JSON.stringify(newDepth));
        }
        else if (stockType === "no") {
            (0, buyHelper_1.OrderReverse)(this.sell, userId, "yes", quantity, price);
            Redis_1.Redis.getInstance().sendToApi(clientId, {
                statusCode: 200,
                payload: `Placed a reverse order for ${quantity} "YES" at ${1000 - price}.`,
            });
            const newDepth = this.getDepth();
            Redis_1.Redis.getInstance().publishToPubSub(`depth/${this.stockSymbol}`, JSON.stringify(newDepth));
        }
    }
    getDepth() {
        var _a, _b;
        let noMarket = [];
        let yesMarket = [];
        if (this.sell.hasOwnProperty("no")) {
            noMarket = (_a = Object.entries(this.sell["no"])) === null || _a === void 0 ? void 0 : _a.map(([key, value]) => ({
                price: key,
                quantity: value.total,
            }));
        }
        if (this.sell.hasOwnProperty("yes")) {
            yesMarket = (_b = Object.entries(this.sell["yes"])) === null || _b === void 0 ? void 0 : _b.map(([key, value]) => ({
                price: key,
                quantity: value.total,
            }));
        }
        return { yesMarket, noMarket };
    }
    getTicker() {
        const ticker = {
            ticker: this.stockSymbol,
            noPrice: this.currentNoPrice,
            yesPrice: this.currentYesPrice,
        };
        return ticker;
    }
    respondSellOrder(clientId, quantity, stockType, stockSymbol, price) {
        Redis_1.Redis.getInstance().sendToApi(clientId, {
            statusCode: 200,
            payload: `Order successfully placed for ${quantity} stocks of ${stockType} of ${this.stockSymbol} at ${price}`,
        });
        const newDepth = this.getDepth();
        Redis_1.Redis.getInstance().publishToPubSub(`depth/${this.stockSymbol}`, JSON.stringify(newDepth));
    }
    respondPendingSell(clientId, executedOrders, pendingOrders) {
        Redis_1.Redis.getInstance().sendToApi(clientId, {
            statusCode: 200,
            payload: {
                filledOrders: executedOrders,
                pendingOrders,
            },
        });
    }
}
exports.Orderbook = Orderbook;
