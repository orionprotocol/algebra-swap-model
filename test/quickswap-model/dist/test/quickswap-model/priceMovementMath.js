"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PriceMovementMath = void 0;
const assert_1 = __importDefault(require("assert"));
const FullMath_1 = require("./FullMath");
const constants_1 = require("./constants");
const tokenDeltaMath_1 = require("./tokenDeltaMath");
class PriceMovementMath {
    /// @notice Gets the next sqrt price given an input amount of token0 or token1
    /// @dev Throws if price or liquidity are 0, or if the next price is out of bounds
    /// @param price The starting Q64.96 sqrt price, i.e., before accounting for the input amount
    /// @param liquidity The amount of usable liquidity
    /// @param input How much of token0, or token1, is being swapped in
    /// @param zeroToOne Whether the amount in is token0 or token1
    /// @return resultPrice The Q64.96 sqrt price after adding the input amount to token0 or token1
    static getNewPriceAfterInput(price, liquidity, input, zeroToOne) {
        return this.getNewPrice(price, liquidity, input, zeroToOne, true);
    }
    /// @notice Gets the next sqrt price given an output amount of token0 or token1
    /// @dev Throws if price or liquidity are 0 or the next price is out of bounds
    /// @param price The starting Q64.96 sqrt price before accounting for the output amount
    /// @param liquidity The amount of usable liquidity
    /// @param output How much of token0, or token1, is being swapped out
    /// @param zeroToOne Whether the amount out is token0 or token1
    /// @return resultPrice The Q64.96 sqrt price after removing the output amount of token0 or token1
    static getNewPriceAfterOutput(price, liquidity, output, zeroToOne) {
        return this.getNewPrice(price, liquidity, output, zeroToOne, false);
    }
    static getNewPrice(price, liquidity, amount, zeroToOne, fromInput) {
        (0, assert_1.default)(price > 0);
        (0, assert_1.default)(liquidity > 0);
        if (zeroToOne == fromInput) {
            // rounding up or down
            if (amount == 0n)
                return price;
            const liquidityShifted = liquidity << constants_1.Constants.RESOLUTION;
            if (fromInput) {
                let product;
                if ((product = amount * price) / amount == price) {
                    let denominator = liquidityShifted + product;
                    if (denominator >= liquidityShifted)
                        return FullMath_1.FullMath.mulDivRoundingUp(liquidityShifted, price, denominator); // always fits in 160 bits
                }
                return FullMath_1.FullMath.divRoundingUp(liquidityShifted, liquidityShifted / price + amount);
            }
            else {
                let product;
                (0, assert_1.default)((product = amount * price) / amount == price); // if the product overflows, we know the denominator underflows
                (0, assert_1.default)(liquidityShifted > product); // in addition, we must check that the denominator does not underflow
                return FullMath_1.FullMath.mulDivRoundingUp(liquidityShifted, price, liquidityShifted - product);
            }
        }
        else {
            // if we're adding (subtracting), rounding down requires rounding the quotient down (up)
            // in both cases, avoid a mulDiv for most inputs
            if (fromInput) {
                return (price +
                    (amount <= constants_1.Constants.MAX_UINT_160
                        ? (amount << constants_1.Constants.RESOLUTION) / liquidity
                        : FullMath_1.FullMath.mulDiv(amount, constants_1.Constants.Q96, liquidity)));
            }
            else {
                const quotient = amount <= constants_1.Constants.MAX_UINT_160
                    ? FullMath_1.FullMath.divRoundingUp(amount << constants_1.Constants.RESOLUTION, liquidity)
                    : FullMath_1.FullMath.mulDivRoundingUp(amount, constants_1.Constants.Q96, liquidity);
                (0, assert_1.default)(price > quotient);
                return (price - quotient) & constants_1.Constants.MAX_UINT_160; // always fits 160 bits
            }
        }
    }
    static getTokenADelta01(to, from, liquidity) {
        return tokenDeltaMath_1.TokenDeltaMath.getToken0DeltaRoundUp(to, from, liquidity, true);
    }
    static getTokenADelta10(to, from, liquidity) {
        return tokenDeltaMath_1.TokenDeltaMath.getToken1DeltaRoundUp(from, to, liquidity, true);
    }
    static getTokenBDelta01(to, from, liquidity) {
        return tokenDeltaMath_1.TokenDeltaMath.getToken1DeltaRoundUp(to, from, liquidity, false);
    }
    static getTokenBDelta10(to, from, liquidity) {
        return tokenDeltaMath_1.TokenDeltaMath.getToken0DeltaRoundUp(from, to, liquidity, false);
    }
    static movePriceTowardsTarget(zeroToOne, currentPrice, targetPrice, liquidity, amountAvailable, fee) {
        console.log('Inside movePriceTowardsTarget');
        const getAmountA = zeroToOne ? this.getTokenADelta01 : this.getTokenADelta10;
        let result = {
            resultPrice: 0n,
            input: 0n,
            output: 0n,
            feeAmount: 0n,
        };
        if (amountAvailable >= 0) {
            // exactIn or not
            const amountAvailableAfterFee = FullMath_1.FullMath.mulDiv(amountAvailable, BigInt(1e6) - fee, BigInt(1e6));
            result.input = getAmountA(targetPrice, currentPrice, liquidity);
            console.log('input');
            console.log(result.input);
            if (amountAvailableAfterFee >= result.input) {
                result.resultPrice = targetPrice;
                result.feeAmount = FullMath_1.FullMath.mulDivRoundingUp(result.input, fee, BigInt(1e6) - fee);
            }
            else {
                result.resultPrice = this.getNewPriceAfterInput(currentPrice, liquidity, amountAvailableAfterFee, zeroToOne);
                if (targetPrice != result.resultPrice) {
                    result.input = getAmountA(result.resultPrice, currentPrice, liquidity);
                    // we didn't reach the target, so take the remainder of the maximum result.input as fee
                    result.feeAmount = amountAvailable - result.input;
                }
                else {
                    result.feeAmount = FullMath_1.FullMath.mulDivRoundingUp(result.input, fee, BigInt(1e6) - fee);
                }
            }
            result.output = (zeroToOne ? this.getTokenBDelta01 : this.getTokenBDelta10)(result.resultPrice, currentPrice, liquidity);
        }
        else {
            const getAmountB = zeroToOne ? this.getTokenBDelta01 : this.getTokenBDelta10;
            result.output = getAmountB(targetPrice, currentPrice, liquidity);
            amountAvailable = -amountAvailable;
            if (amountAvailable >= result.output)
                result.resultPrice = targetPrice;
            else {
                result.resultPrice = this.getNewPriceAfterOutput(currentPrice, liquidity, amountAvailable, zeroToOne);
                if (targetPrice != result.resultPrice) {
                    result.output = getAmountB(result.resultPrice, currentPrice, liquidity);
                }
                // cap the result.output amount to not exceed the remaining result.output amount
                if (result.output > amountAvailable) {
                    result.output = amountAvailable;
                }
            }
            result.input = getAmountA(result.resultPrice, currentPrice, liquidity);
            result.feeAmount = FullMath_1.FullMath.mulDivRoundingUp(result.input, fee, BigInt(1e6) - fee);
        }
        return result;
    }
}
exports.PriceMovementMath = PriceMovementMath;
//# sourceMappingURL=priceMovementMath.js.map