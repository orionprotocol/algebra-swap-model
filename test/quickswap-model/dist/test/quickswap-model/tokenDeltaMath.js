"use strict";
/// @title Functions based on Q64.96 sqrt price and liquidity
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenDeltaMath = void 0;
const assert_1 = __importDefault(require("assert"));
const constants_1 = require("./constants");
const FullMath_1 = require("./FullMath");
/// @notice Contains the math that uses square root of price as a Q64.96 and liquidity to compute deltas
class TokenDeltaMath {
    /// @notice Gets the token0 delta between two prices
    /// @dev Calculates liquidity / sqrt(lower) - liquidity / sqrt(upper)
    /// @param priceLower A Q64.96 sqrt price
    /// @param priceUpper Another Q64.96 sqrt price
    /// @param liquidity The amount of usable liquidity
    /// @param roundUp Whether to round the amount up or down
    /// @return token0Delta Amount of token0 required to cover a position of size liquidity between the two passed prices
    static getToken0DeltaRoundUp(priceLower, priceUpper, liquidity, roundUp) {
        const priceDelta = priceUpper - priceLower;
        (0, assert_1.default)(priceDelta < priceUpper); // forbids underflow and 0 priceLower
        const liquidityShifted = liquidity << constants_1.Constants.RESOLUTION;
        const token0Delta = roundUp
            ? FullMath_1.FullMath.divRoundingUp(FullMath_1.FullMath.mulDivRoundingUp(priceDelta, liquidityShifted, priceUpper), priceLower)
            : FullMath_1.FullMath.mulDiv(priceDelta, liquidityShifted, priceUpper) / priceLower;
        console.log('Inside getToken0DeltaRoundUp');
        console.log('priceLower');
        console.log(priceLower);
        console.log('priceUpper');
        console.log(priceUpper);
        console.log('liquidity');
        console.log(liquidity);
        console.log('roundUp');
        console.log(roundUp);
        console.log('priceDelta');
        console.log(priceDelta);
        console.log('liquidityShifted');
        console.log(liquidityShifted);
        console.log('token0Delta');
        console.log(token0Delta);
        return token0Delta;
    }
    /// @notice Gets the token1 delta between two prices
    /// @dev Calculates liquidity * (sqrt(upper) - sqrt(lower))
    /// @param priceLower A Q64.96 sqrt price
    /// @param priceUpper Another Q64.96 sqrt price
    /// @param liquidity The amount of usable liquidity
    /// @param roundUp Whether to round the amount up, or down
    /// @return token1Delta Amount of token1 required to cover a position of size liquidity between the two passed prices
    static getToken1DeltaRoundUp(priceLower, priceUpper, liquidity, roundUp) {
        (0, assert_1.default)(priceUpper >= priceLower);
        const priceDelta = priceUpper - priceLower;
        const token1Delta = roundUp
            ? FullMath_1.FullMath.mulDivRoundingUp(priceDelta, liquidity, constants_1.Constants.Q96)
            : FullMath_1.FullMath.mulDiv(priceDelta, liquidity, constants_1.Constants.Q96);
        console.log('Inside getToken1DeltaRoundUp');
        console.log('priceLower');
        console.log(priceLower);
        console.log('priceUpper');
        console.log(priceUpper);
        console.log('liquidity');
        console.log(liquidity);
        console.log('roundUp');
        console.log(roundUp);
        console.log('priceDelta');
        console.log(priceDelta);
        console.log('token1Delta');
        console.log(token1Delta);
        return token1Delta;
    }
    /// @notice Helper that gets signed token0 delta
    /// @param priceLower A Q64.96 sqrt price
    /// @param priceUpper Another Q64.96 sqrt price
    /// @param liquidity The change in liquidity for which to compute the token0 delta
    /// @return token0Delta Amount of token0 corresponding to the passed liquidityDelta between the two prices
    static getToken0Delta(priceLower, priceUpper, liquidity) {
        const token0Delta = liquidity >= 0
            ? TokenDeltaMath.getToken0DeltaRoundUp(priceLower, priceUpper, liquidity, true)
            : -TokenDeltaMath.getToken0DeltaRoundUp(priceLower, priceUpper, -liquidity, false);
    }
    /// @notice Helper that gets signed token1 delta
    /// @param priceLower A Q64.96 sqrt price
    /// @param priceUpper Another Q64.96 sqrt price
    /// @param liquidity The change in liquidity for which to compute the token1 delta
    /// @return token1Delta Amount of token1 corresponding to the passed liquidityDelta between the two prices
    static getToken1Delta(priceLower, priceUpper, liquidity) {
        const token1Delta = liquidity >= 0
            ? TokenDeltaMath.getToken1DeltaRoundUp(priceLower, priceUpper, liquidity, true)
            : -TokenDeltaMath.getToken1DeltaRoundUp(priceLower, priceUpper, -liquidity, false);
    }
}
exports.TokenDeltaMath = TokenDeltaMath;
//# sourceMappingURL=tokenDeltaMath.js.map