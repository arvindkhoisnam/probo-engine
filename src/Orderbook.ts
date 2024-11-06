import { Redis } from "./Redis";
import { OrderReverse } from "./services/buyHelper";
import { matchBuyOrders, matchSellOrders } from "./services/matchOrder";

import {
  addNewUser,
  addStockType,
  addStrikePrice,
  updateExistingOrder,
} from "./services/sellHelper";

export interface SellOrder {
  [type: string]: {
    [price: number]: {
      reverseOrder: boolean;
      total: number;
      orders: {
        [user: string]: number;
      };
    };
  };
}
export interface BuyOrder {
  [type: string]: {
    [price: number]: {
      total: number;
      orders: {
        [user: string]: number;
      };
    };
  };
}

export class Orderbook {
  stockSymbol: string;
  buy: BuyOrder;
  sell: SellOrder;
  currentYesPrice: number;
  currentNoPrice: number;

  constructor(
    stockSymbol: string,
    buy: {},
    sell: {},
    currentYesPrice: number,
    currentNoPrice: number
  ) {
    this.stockSymbol = stockSymbol;
    this.buy = buy;
    this.sell = sell;
    this.currentYesPrice = currentYesPrice;
    this.currentNoPrice = currentNoPrice;
  }

  sellOrder(
    quantity: number,
    price: number,
    userId: string,
    stockType: string,
    clientId: string
  ) {
    const buyerExists = this.buy[stockType]?.hasOwnProperty(price);
    const existingStockType = this.sell.hasOwnProperty(stockType);
    const existingStrikePrice = this.sell[stockType]?.hasOwnProperty(price);
    const existingUser =
      this.sell[stockType]?.[price]?.orders.hasOwnProperty(userId);

    if (buyerExists) {
      const { pendingOrders, executedOrders, LTP } = matchBuyOrders(
        userId,
        stockType,
        quantity,
        price,
        this.buy,
        this.stockSymbol
      );

      if (pendingOrders > 0) {
        if (!existingStockType) {
          this.sell = addStockType(
            this.sell,
            userId,
            stockType,
            price,
            quantity
          );

          this.respondPendingSell(clientId, executedOrders, pendingOrders);
          return;
        }
        if (!existingStrikePrice) {
          this.sell = addStrikePrice(
            this.sell,
            userId,
            stockType,
            price,
            quantity
          );
          this.respondPendingSell(clientId, executedOrders, pendingOrders);
          return;
        }
        if (!existingUser) {
          this.sell = addNewUser(this.sell, userId, stockType, price, quantity);
          this.respondPendingSell(clientId, executedOrders, pendingOrders);
          return;
        }
        if (existingUser) {
          this.sell = updateExistingOrder(
            this.sell,
            userId,
            stockType,
            price,
            quantity
          );
          this.respondPendingSell(clientId, executedOrders, pendingOrders);
          return;
        }
      }
      // All sell orders matched
      Redis.getInstance().sendToApi(clientId, {
        statusCode: 200,
        payload: {
          pendingOrders,
          executedOrders,
          message: "Trade placed and executed.",
        },
      });
    } else {
      if (!existingStockType) {
        this.sell = addStockType(this.sell, userId, stockType, price, quantity);
        this.respondSellOrder(
          clientId,
          quantity,
          stockType,
          this.stockSymbol,
          price
        );
        return;
      }
      if (!existingStrikePrice) {
        this.sell = addStrikePrice(
          this.sell,
          userId,
          stockType,
          price,
          quantity
        );
        this.respondSellOrder(
          clientId,
          quantity,
          stockType,
          this.stockSymbol,
          price
        );
        return;
      }
      if (!existingUser) {
        this.sell = addNewUser(this.sell, userId, stockType, price, quantity);
        this.respondSellOrder(
          clientId,
          quantity,
          stockType,
          this.stockSymbol,
          price
        );
        return;
      }
      if (existingUser) {
        this.sell = updateExistingOrder(
          this.sell,
          userId,
          stockType,
          price,
          quantity
        );
        this.respondSellOrder(
          clientId,
          quantity,
          stockType,
          this.stockSymbol,
          price
        );
        return;
      }
    }
  }

  buyOrder(
    quantity: number,
    price: number,
    userId: string,
    stockType: string,
    clientId: string
  ) {
    const sellerExists = this.sell.hasOwnProperty(stockType);
    const existingStockType = this.buy.hasOwnProperty(stockType);
    const existingStrikePrice = this.buy[stockType]?.hasOwnProperty(price);
    const existingUser =
      this.buy[stockType]?.[price]?.orders.hasOwnProperty(userId);

    if (sellerExists) {
      const { pendingOrders, executedOrders, LTP } = matchSellOrders(
        userId,
        stockType,
        quantity,
        price,
        this.sell,
        this.stockSymbol
      );

      if (stockType === "yes") {
        this.currentYesPrice = LTP;
        this.currentNoPrice = 1000 - LTP;
      } else {
        this.currentNoPrice = LTP;
        this.currentYesPrice = 1000 - LTP;
      }

      if (pendingOrders > 0) {
        if (stockType === "yes") {
          OrderReverse(this.sell, userId, "no", pendingOrders, price);
          Redis.getInstance().sendToApi(clientId, {
            statusCode: 200,
            payload: {
              pendingOrders,
              executedOrders,
              message: `Placed a reverser order for ${pendingOrders} "NO" at ${
                1000 - price
              }`,
            },
          });
          const newDepth = this.getDepth();

          Redis.getInstance().publishToPubSub(
            `depth/${this.stockSymbol}`,
            JSON.stringify(newDepth)
          );
        } else if (stockType === "no") {
          OrderReverse(this.sell, userId, "yes", pendingOrders, price);
          Redis.getInstance().sendToApi(clientId, {
            statusCode: 200,
            payload: {
              pendingOrders,
              executedOrders,
              message: `Placed a reverser order for ${pendingOrders} "YES" at ${
                1000 - price
              }`,
            },
          });
          const newDepth = this.getDepth();
          console.log(newDepth);
          Redis.getInstance().publishToPubSub(
            `depth/${this.stockSymbol}`,
            JSON.stringify(newDepth)
          );
        }
      }

      Redis.getInstance().sendToApi(clientId, {
        statusCode: 200,
        payload: {
          pendingOrders,
          executedOrders,
          message: "Trade placed and executed.",
        },
      });

      const newDepth = this.getDepth();
      Redis.getInstance().publishToPubSub(
        `depth/${this.stockSymbol}`,
        JSON.stringify(newDepth)
      );
      const ticker = this.getTicker();
      Redis.getInstance().publishToPubSub(
        `ticker/${this.stockSymbol}`,
        JSON.stringify(ticker)
      );
      return;
    }

    // reverseOrder(userId, quantity, price, stockType, this.sell, clientId);
    if (stockType === "yes") {
      this.buy = OrderReverse(this.sell, userId, "no", quantity, price);
      Redis.getInstance().sendToApi(clientId, {
        statusCode: 200,
        payload: `Placed a reverse order for ${quantity} "NO" at ${
          1000 - price
        }.`,
      });
      const newDepth = this.getDepth();
      Redis.getInstance().publishToPubSub(
        `depth/${this.stockSymbol}`,
        JSON.stringify(newDepth)
      );
    } else if (stockType === "no") {
      OrderReverse(this.sell, userId, "yes", quantity, price);
      Redis.getInstance().sendToApi(clientId, {
        statusCode: 200,
        payload: `Placed a reverse order for ${quantity} "YES" at ${
          1000 - price
        }.`,
      });
      const newDepth = this.getDepth();
      Redis.getInstance().publishToPubSub(
        `depth/${this.stockSymbol}`,
        JSON.stringify(newDepth)
      );
    }
  }

  getDepth() {
    let noMarket: any = [];
    let yesMarket: any = [];
    if (this.sell.hasOwnProperty("no")) {
      noMarket = Object.entries(this.sell["no"])?.map(([key, value]) => ({
        price: key,
        quantity: value.total,
      }));
    }
    if (this.sell.hasOwnProperty("yes")) {
      yesMarket = Object.entries(this.sell["yes"])?.map(([key, value]) => ({
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
  respondSellOrder(
    clientId: string,
    quantity: number,
    stockType: string,
    stockSymbol: string,
    price: number
  ) {
    Redis.getInstance().sendToApi(clientId, {
      statusCode: 200,
      payload: `Order successfully placed for ${quantity} stocks of ${stockType} of ${this.stockSymbol} at ${price}`,
    });
    const newDepth = this.getDepth();
    Redis.getInstance().publishToPubSub(
      `depth/${this.stockSymbol}`,
      JSON.stringify(newDepth)
    );
  }
  respondPendingSell(
    clientId: string,
    executedOrders: number,
    pendingOrders: number
  ) {
    Redis.getInstance().sendToApi(clientId, {
      statusCode: 200,
      payload: {
        filledOrders: executedOrders,
        pendingOrders,
      },
    });
  }
}
