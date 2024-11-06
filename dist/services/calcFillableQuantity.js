"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calcFillableBUYQuantity = exports.calcFillableSELLQuantity = void 0;
function calcFillableSELLQuantity(quantity, price, arr) {
    let maxFillableQuant = 0;
    let remainingQuant = quantity;
    arr.forEach(([key, value]) => {
        if (Number(key) >= price && maxFillableQuant < quantity) {
            if (remainingQuant > value.total) {
                maxFillableQuant += value.total;
                remainingQuant -= value.total;
            }
            else {
                maxFillableQuant += remainingQuant;
                return;
            }
        }
    });
    return maxFillableQuant;
}
exports.calcFillableSELLQuantity = calcFillableSELLQuantity;
function calcFillableBUYQuantity(quantity, price, arr) {
    let fillQuant = 0;
    let remainingQuant = quantity;
    arr.forEach(([key, value]) => {
        if (Number(key) <= price && fillQuant < quantity) {
            if (remainingQuant > value.total) {
                fillQuant += value.total;
                remainingQuant -= value.total;
            }
            else {
                fillQuant += remainingQuant;
                return;
            }
        }
    });
    return fillQuant;
}
exports.calcFillableBUYQuantity = calcFillableBUYQuantity;
