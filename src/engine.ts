import fs from "fs";
import { Redis } from "./Redis";
import { Orderbook } from "./Orderbook";
import { updateStockBalance } from "./services/updateStockBalance";

interface INR {
  [userId: string]: {
    [balance: string]: number;
    locked: number;
  };
}
interface STOCKS {
  [userId: string]: {
    [stockSymbol: string]: {
      [stockType: string]: {
        quantity: number;
        locked: number;
      };
    };
  };
}

export class Engine {
  markets: Orderbook[] = [];
  inrbalances: INR;
  stockBalances: STOCKS;
  private static instance: Engine;

  constructor() {
    const snapshots = fs.readFileSync("./snapshots.json");
    const parsedSnaps = JSON.parse(snapshots.toString());

    this.markets = parsedSnaps.MARKETS.map(
      (orderbook: any) =>
        new Orderbook(
          orderbook.stockSymbol,
          orderbook.buy,
          orderbook.sell,
          orderbook.currentYesPrice,
          orderbook.currentNoPrice
        )
    );
    this.inrbalances = parsedSnaps.INR_BALANCES;
    this.stockBalances = parsedSnaps.STOCK_BALANCES;
  }
  public static getInstance() {
    if (!this.instance) {
      this.instance = new Engine();
    }
    return this.instance;
  }
  process({ clientId, message }: { clientId: string; message: any }) {
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
        Redis.getInstance().sendToApi(clientId, {
          statusCode: 200,
          payload: this.getAllMarkets(),
        });
        break;
      case "createMarket":
        this.createMarket(clientId, message.data);
        break;
      case "mint":
        this.mint(
          clientId,
          message.data.userId,
          message.data.stockSymbol,
          message.data.quantity,
          message.data.price
        );
        break;
      case "sellOrder":
        this.placeOrder(
          clientId,
          message.data.userId,
          message.data.stockSymbol,
          message.data.stockType,
          message.data.quantity,
          message.data.price,
          "sell"
        );
        break;
      case "buyOrder":
        this.placeOrder(
          clientId,
          message.data.userId,
          message.data.stockSymbol,
          message.data.stockType,
          message.data.quantity,
          message.data.price,
          "buy"
        );
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
  createUser(clientId: string, userId: string) {
    const existingUser = this.inrbalances.hasOwnProperty(userId);
    if (!existingUser) {
      //@ts-ignore
      this.inrbalances[userId] = {
        balance: 0,
        locked: 0,
      };
      Redis.getInstance().sendToApi(clientId, {
        statusCode: 200,
        payload: `${userId} successfully created.`,
      });
    } else {
      Redis.getInstance().sendToApi(clientId, {
        statusCode: 400,
        payload: "User already exists.",
      });
    }
  }
  onrampInr(clientId: string, userId: string, amount: number) {
    const existingUser = this.inrbalances.hasOwnProperty(userId);
    if (existingUser) {
      //@ts-ignore
      this.inrbalances[userId].balance += amount;
      Redis.getInstance().sendToApi(clientId, {
        statusCode: 200,
        payload: `Onramped ${userId} with amount ${amount}`,
      });
    } else {
      Redis.getInstance().sendToApi(clientId, {
        statusCode: 400,
        payload: "User does not exist.",
      });
    }
  }
  createMarket(clientId: string, symbol: string) {
    const marketAlreadyExists = this.markets.find(
      //@ts-ignore
      (market) => market.stockSymbol === symbol
    );
    if (!marketAlreadyExists) {
      //@ts-ignore

      const newMarket = new Orderbook(symbol, {}, {}, 0, 0);
      this.markets.push(newMarket);
      Redis.getInstance().sendToApi(clientId, {
        statusCode: 200,
        payload: `Market ${symbol} successfully created`,
      });
    } else {
      Redis.getInstance().sendToApi(clientId, {
        statusCode: 400,
        payload: `Market already exists.`,
      });
    }
  }

  mint(
    clientId: string,
    userId: string,
    stockSymbol: string,
    quantity: number,
    price: number
  ) {
    //@ts-ignore
    const user = this.inrbalances.hasOwnProperty(userId);
    if (!user) {
      Redis.getInstance().sendToApi(clientId, {
        statusCode: 400,
        payload: "User does not exist.",
      });
      return;
    }
    const sufficientBalance =
      //@ts-ignore
      this.inrbalances[userId].balance >= price * quantity * 2;
    if (!sufficientBalance) {
      Redis.getInstance().sendToApi(clientId, {
        statusCode: 400,
        payload: "Insufficient balance.",
      });
      return;
    }

    this.stockBalances[userId] = {
      ...this.stockBalances[userId],
      [stockSymbol]: {
        yes: {
          quantity: quantity,
          locked: 0,
        },
        no: {
          quantity: quantity,
          locked: 0,
        },
      },
    };
    this.inrbalances[userId].balance -= price * quantity * 2;
    Redis.getInstance().sendToApi(clientId, {
      statusCode: 200,
      payload: `Minted ${quantity} 'yes' and 'no' tokens for user ${userId}, remaining balance is ${this.inrbalances[userId].balance}`,
    });
    return;
  }

  placeOrder(
    clientId: string,
    userId: string,
    stockSymbol: string,
    stockType: string,
    quantity: number,
    price: number,
    orderType: string
  ) {
    if (orderType === "sell") {
      const market = this.markets.find(
        (market) => market.stockSymbol === stockSymbol
      );
      const sufficientStocks = this.checkLockStocks(
        userId,
        stockSymbol,
        stockType,
        quantity
      );

      if (market && sufficientStocks) {
        market.sellOrder(quantity, price, userId, stockType, clientId);
      } else {
        Redis.getInstance().sendToApi(clientId, {
          statusCode: 200,
          payload: `Insufficient Balance or market does not exist at the moment.`,
        });
        return;
      }
    } else if (orderType === "buy") {
      const market = this.markets.find(
        (market) => market.stockSymbol === stockSymbol
      );

      const sufficientBalance = this.checkLockBalance(userId, quantity, price);
      if (market && sufficientBalance) {
        market.buyOrder(quantity, price, userId, stockType, clientId);
      } else {
        console.log("Market does not exist or insuffiecient balance");
      }
    }
  }

  checkLockStocks(
    userId: string,
    stockSymbol: string,
    stockType: string,
    quantity: number
  ) {
    const sufficientStocks =
      // @ts-ignore
      this.stockBalances[userId]?.[stockSymbol]?.[stockType]?.quantity >=
      quantity;

    if (!sufficientStocks) {
      return false;
    } else {
      // @ts-ignore
      this.stockBalances[userId][stockSymbol][stockType].quantity -= quantity;
      // @ts-ignore
      this.stockBalances[userId][stockSymbol][stockType].locked += quantity;
      return true;
    }
  }
  checkLockBalance(userId: string, quantity: number, price: number) {
    const userHasSuffBal =
      // @ts-ignore
      this.inrbalances[userId].balance >= price * quantity;

    if (!userHasSuffBal) {
      return false;
    } else {
      // @ts-ignore
      this.inrbalances[userId].balance -= price * quantity;
      // @ts-ignore
      this.inrbalances[userId].locked += price * quantity;
      return true;
    }
  }

  getSellOrderbook(clientId: string, stockSymbol: string) {
    const orderbook = this.markets.find(
      (market) => market.stockSymbol === stockSymbol
    )?.sell;
    Redis.getInstance().sendToApi(clientId, {
      statusCode: 200,
      payload: orderbook,
    });
  }
  getBuyOrderbook(clientId: string, stockSymbol: string) {
    const orderbook = this.markets.find(
      (market) => market.stockSymbol === stockSymbol
    )?.buy;
    Redis.getInstance().sendToApi(clientId, {
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
  getTickerAndDepth(clientId: string, stockSymbol: string) {
    const ticker = this.markets.find(
      (market) => market.stockSymbol === stockSymbol
    );
    const depth = ticker?.getDepth();
    const payload = {
      stockSymbol: ticker?.stockSymbol,
      currentYesPrice: ticker?.currentYesPrice,
      currentNoPrice: ticker?.currentNoPrice,
      depth: depth,
    };
    Redis.getInstance().sendToApi(clientId, {
      statusCode: 200,
      payload: payload,
    });
  }
  getStockBalance(clientId: string, userId: string) {
    if (this.stockBalances.hasOwnProperty(userId)) {
      const userStockBalance = this.stockBalances[userId];
      Redis.getInstance().sendToApi(clientId, {
        statusCode: 200,
        payload: userStockBalance,
      });
    } else {
      Redis.getInstance().sendToApi(clientId, {
        statusCode: 400,
        payload: "User not found",
      });
    }
  }
  getInrBalance(clientId: string, userId: string) {
    if (userId in this.inrbalances) {
      const userInrBalance = this.inrbalances[userId];
      Redis.getInstance().sendToApi(clientId, {
        statusCode: 200,
        payload: userInrBalance,
      });
    } else {
      Redis.getInstance().sendToApi(clientId, {
        statusCode: 400,
        payload: "User not found",
      });
    }
  }
}
