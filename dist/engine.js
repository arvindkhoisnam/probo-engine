"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Engine = void 0;
const fs_1 = __importDefault(require("fs"));
const Redis_1 = require("./Redis");
const Orderbook_1 = require("./Orderbook");
class Engine {
    constructor() {
        this.markets = [];
        const snapshots = fs_1.default.readFileSync("./snapshots.json");
        const parsedSnaps = JSON.parse(snapshots.toString());
        this.markets = parsedSnaps.MARKETS.map((orderbook) => new Orderbook_1.Orderbook(orderbook.stockSymbol, orderbook.buy, orderbook.sell, orderbook.currentYesPrice, orderbook.currentNoPrice));
        this.inrbalances = parsedSnaps.INR_BALANCES;
        this.stockBalances = parsedSnaps.STOCK_BALANCES;
    }
    static getInstance() {
        if (!this.instance) {
            this.instance = new Engine();
        }
        return this.instance;
    }
    process({ clientId, message }) {
        switch (message.type) {
            case "createUser":
                this.createUser(clientId, message.data);
                break;
            case "onramp":
                this.onrampInr(clientId, message.data.userId, message.data.amount);
            case "balanceInr":
                this.getInrBalance(clientId, message.data);
                break;
            case "balanceStock":
                this.getStockBalance(clientId, message.data);
                break;
            case "allMarkets":
                Redis_1.Redis.getInstance().sendToApi(clientId, {
                    statusCode: 200,
                    payload: this.getAllMarkets(),
                });
                break;
            case "createMarket":
                this.createMarket(clientId, message.data);
                break;
            case "mint":
                this.mint(clientId, message.data.userId, message.data.stockSymbol, message.data.quantity, message.data.price);
                break;
            case "sellOrder":
                this.placeOrder(clientId, message.data.userId, message.data.stockSymbol, message.data.stockType, message.data.quantity, message.data.price, "sell");
                break;
            case "buyOrder":
                this.placeOrder(clientId, message.data.userId, message.data.stockSymbol, message.data.stockType, message.data.quantity, message.data.price, "buy");
                break;
            case "sellOrderbook":
                this.getSellOrderbook(clientId, message.data);
                break;
            case "buyOrderbook":
                this.getBuyOrderbook(clientId, message.data);
                break;
            case "getTickerAndDepth":
                this.getTickerAndDepth(clientId, message.data);
            default:
                break;
        }
    }
    createUser(clientId, userId) {
        const existingUser = this.inrbalances.hasOwnProperty(userId);
        if (!existingUser) {
            //@ts-ignore
            this.inrbalances[userId] = {
                balance: 0,
                locked: 0,
            };
            Redis_1.Redis.getInstance().sendToApi(clientId, {
                statusCode: 200,
                payload: `${userId} successfully created.`,
            });
        }
        else {
            Redis_1.Redis.getInstance().sendToApi(clientId, {
                statusCode: 400,
                payload: "User already exists.",
            });
        }
    }
    onrampInr(clientId, userId, amount) {
        const existingUser = this.inrbalances.hasOwnProperty(userId);
        if (existingUser) {
            //@ts-ignore
            this.inrbalances[userId].balance += amount;
            Redis_1.Redis.getInstance().sendToApi(clientId, {
                statusCode: 200,
                payload: `Onramped ${userId} with amount ${amount}`,
            });
        }
        else {
            Redis_1.Redis.getInstance().sendToApi(clientId, {
                statusCode: 400,
                payload: "User does not exist.",
            });
        }
    }
    createMarket(clientId, symbol) {
        const marketAlreadyExists = this.markets.find(
        //@ts-ignore
        (market) => market.stockSymbol === symbol);
        if (!marketAlreadyExists) {
            //@ts-ignore
            const newMarket = new Orderbook_1.Orderbook(symbol, {}, {}, 0, 0);
            this.markets.push(newMarket);
            Redis_1.Redis.getInstance().sendToApi(clientId, {
                statusCode: 200,
                payload: `Market ${symbol} successfully created`,
            });
        }
        else {
            Redis_1.Redis.getInstance().sendToApi(clientId, {
                statusCode: 400,
                payload: `Market already exists.`,
            });
        }
    }
    mint(clientId, userId, stockSymbol, quantity, price) {
        //@ts-ignore
        const user = this.inrbalances.hasOwnProperty(userId);
        if (!user) {
            Redis_1.Redis.getInstance().sendToApi(clientId, {
                statusCode: 400,
                payload: "User does not exist.",
            });
            return;
        }
        const sufficientBalance = 
        //@ts-ignore
        this.inrbalances[userId].balance >= price * quantity * 2;
        if (!sufficientBalance) {
            Redis_1.Redis.getInstance().sendToApi(clientId, {
                statusCode: 400,
                payload: "Insufficient balance.",
            });
            return;
        }
        this.stockBalances[userId] = Object.assign(Object.assign({}, this.stockBalances[userId]), { [stockSymbol]: {
                yes: {
                    quantity: quantity,
                    locked: 0,
                },
                no: {
                    quantity: quantity,
                    locked: 0,
                },
            } });
        this.inrbalances[userId].balance -= price * quantity * 2;
        Redis_1.Redis.getInstance().sendToApi(clientId, {
            statusCode: 200,
            payload: `Minted ${quantity} 'yes' and 'no' tokens for user ${userId}, remaining balance is ${this.inrbalances[userId].balance}`,
        });
        return;
    }
    placeOrder(clientId, userId, stockSymbol, stockType, quantity, price, orderType) {
        if (orderType === "sell") {
            const market = this.markets.find((market) => market.stockSymbol === stockSymbol);
            const sufficientStocks = this.checkLockStocks(userId, stockSymbol, stockType, quantity);
            if (market && sufficientStocks) {
                market.sellOrder(quantity, price, userId, stockType, clientId);
            }
            else {
                Redis_1.Redis.getInstance().sendToApi(clientId, {
                    statusCode: 200,
                    payload: `Insufficient Balance or market does not exist at the moment.`,
                });
                return;
            }
        }
        else if (orderType === "buy") {
            const market = this.markets.find((market) => market.stockSymbol === stockSymbol);
            const sufficientBalance = this.checkLockBalance(userId, quantity, price);
            if (market && sufficientBalance) {
                market.buyOrder(quantity, price, userId, stockType, clientId);
            }
            else {
                console.log("Market does not exist or insuffiecient balance");
            }
        }
    }
    checkLockStocks(userId, stockSymbol, stockType, quantity) {
        var _a, _b, _c;
        const sufficientStocks = 
        // @ts-ignore
        ((_c = (_b = (_a = this.stockBalances[userId]) === null || _a === void 0 ? void 0 : _a[stockSymbol]) === null || _b === void 0 ? void 0 : _b[stockType]) === null || _c === void 0 ? void 0 : _c.quantity) >=
            quantity;
        if (!sufficientStocks) {
            return false;
        }
        else {
            // @ts-ignore
            this.stockBalances[userId][stockSymbol][stockType].quantity -= quantity;
            // @ts-ignore
            this.stockBalances[userId][stockSymbol][stockType].locked += quantity;
            return true;
        }
    }
    checkLockBalance(userId, quantity, price) {
        const userHasSuffBal = 
        // @ts-ignore
        this.inrbalances[userId].balance >= price * quantity;
        if (!userHasSuffBal) {
            return false;
        }
        else {
            // @ts-ignore
            this.inrbalances[userId].balance -= price * quantity;
            // @ts-ignore
            this.inrbalances[userId].locked += price * quantity;
            return true;
        }
    }
    getSellOrderbook(clientId, stockSymbol) {
        var _a;
        const orderbook = (_a = this.markets.find((market) => market.stockSymbol === stockSymbol)) === null || _a === void 0 ? void 0 : _a.sell;
        Redis_1.Redis.getInstance().sendToApi(clientId, {
            statusCode: 200,
            payload: orderbook,
        });
    }
    getBuyOrderbook(clientId, stockSymbol) {
        var _a;
        const orderbook = (_a = this.markets.find((market) => market.stockSymbol === stockSymbol)) === null || _a === void 0 ? void 0 : _a.buy;
        Redis_1.Redis.getInstance().sendToApi(clientId, {
            statusCode: 200,
            payload: orderbook,
        });
    }
    getAllMarkets() {
        const markets = this.markets.map((market) => ({
            stockSymbol: market.stockSymbol,
            currentYesPrice: market.currentYesPrice,
            currentNoPrice: market.currentNoPrice,
        }));
        return markets;
    }
    getTickerAndDepth(clientId, stockSymbol) {
        const ticker = this.markets.find((market) => market.stockSymbol === stockSymbol);
        const depth = ticker === null || ticker === void 0 ? void 0 : ticker.getDepth();
        const payload = {
            stockSymbol: ticker === null || ticker === void 0 ? void 0 : ticker.stockSymbol,
            currentYesPrice: ticker === null || ticker === void 0 ? void 0 : ticker.currentYesPrice,
            currentNoPrice: ticker === null || ticker === void 0 ? void 0 : ticker.currentNoPrice,
            depth: depth,
        };
        Redis_1.Redis.getInstance().sendToApi(clientId, {
            statusCode: 200,
            payload: payload,
        });
    }
    getStockBalance(clientId, userId) {
        if (this.stockBalances.hasOwnProperty(userId)) {
            const userStockBalance = this.stockBalances[userId];
            Redis_1.Redis.getInstance().sendToApi(clientId, {
                statusCode: 200,
                payload: userStockBalance,
            });
        }
        else {
            Redis_1.Redis.getInstance().sendToApi(clientId, {
                statusCode: 400,
                payload: "User not found",
            });
        }
    }
    getInrBalance(clientId, userId) {
        if (userId in this.inrbalances) {
            const userInrBalance = this.inrbalances[userId];
            Redis_1.Redis.getInstance().sendToApi(clientId, {
                statusCode: 200,
                payload: userInrBalance,
            });
        }
        else {
            Redis_1.Redis.getInstance().sendToApi(clientId, {
                statusCode: 400,
                payload: "User not found",
            });
        }
    }
}
exports.Engine = Engine;
