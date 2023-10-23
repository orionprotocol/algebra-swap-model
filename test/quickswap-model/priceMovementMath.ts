import assert from "assert";
import { FullMath } from "./FullMath";
import { Constants } from "./constants";
import { TokenDeltaMath } from "./tokenDeltaMath";

export class PriceMovementMath {
  /// @notice Gets the next sqrt price given an input amount of token0 or token1
  /// @dev Throws if price or liquidity are 0, or if the next price is out of bounds
  /// @param price The starting Q64.96 sqrt price, i.e., before accounting for the input amount
  /// @param liquidity The amount of usable liquidity
  /// @param input How much of token0, or token1, is being swapped in
  /// @param zeroToOne Whether the amount in is token0 or token1
  /// @return resultPrice The Q64.96 sqrt price after adding the input amount to token0 or token1
  static getNewPriceAfterInput(
    price: bigint,
    liquidity: bigint,
    input: bigint,
    zeroToOne: boolean
  ) {
    return this.getNewPrice(price, liquidity, input, zeroToOne, true);
  }

  /// @notice Gets the next sqrt price given an output amount of token0 or token1
  /// @dev Throws if price or liquidity are 0 or the next price is out of bounds
  /// @param price The starting Q64.96 sqrt price before accounting for the output amount
  /// @param liquidity The amount of usable liquidity
  /// @param output How much of token0, or token1, is being swapped out
  /// @param zeroToOne Whether the amount out is token0 or token1
  /// @return resultPrice The Q64.96 sqrt price after removing the output amount of token0 or token1
  static getNewPriceAfterOutput(
    price: bigint,
    liquidity: bigint,
    output: bigint,
    zeroToOne: boolean
  ) {
    return this.getNewPrice(price, liquidity, output, zeroToOne, false);
  }

  static getNewPrice(
    price: bigint,
    liquidity: bigint,
    amount: bigint,
    zeroToOne: boolean,
    fromInput: boolean
  ) {
    assert(price > 0);
    assert(liquidity > 0);

    if (zeroToOne == fromInput) {
      // rounding up or down
      if (amount == 0n) return price;
      const liquidityShifted = liquidity << Constants.RESOLUTION;

      if (fromInput) {
        let product;
        if ((product = amount * price) / amount == price) {
          let denominator = liquidityShifted + product;
          if (denominator >= liquidityShifted) return FullMath.mulDivRoundingUp(liquidityShifted, price, denominator); // always fits in 160 bits
        }

        return FullMath.divRoundingUp(liquidityShifted, (liquidityShifted / price) + amount);
      } else {
        let product;
        assert((product = amount * price) / amount == price); // if the product overflows, we know the denominator underflows
        assert(liquidityShifted > product); // in addition, we must check that the denominator does not underflow
        return FullMath.mulDivRoundingUp(liquidityShifted, price, liquidityShifted - product);
      }
    } else {
      // if we're adding (subtracting), rounding down requires rounding the quotient down (up)
      // in both cases, avoid a mulDiv for most inputs
      if (fromInput) {
        return price + (amount <= Constants.MAX_UINT_160 ? (amount << Constants.RESOLUTION) / liquidity : FullMath.mulDiv(amount, Constants.Q96, liquidity));
      } else {
        const quotient = amount <= Constants.MAX_UINT_160
          ? FullMath.divRoundingUp(amount << Constants.RESOLUTION, liquidity)
          : FullMath.mulDivRoundingUp(amount, Constants.Q96, liquidity);

        assert(price > quotient);
        return (price - quotient) & Constants.MAX_UINT_160; // always fits 160 bits
      }
    }
  }
  static  getTokenADelta01(
    to: bigint,
    from: bigint,
    liquidity: bigint
  ) {
    return TokenDeltaMath.getToken0DeltaRoundUp(to, from, liquidity, true);
  }

  static getTokenADelta10(
    to: bigint,
    from: bigint,
    liquidity: bigint
  ) {
    return TokenDeltaMath.getToken1DeltaRoundUp(from, to, liquidity, true);
  }

  static  getTokenBDelta01(
    to: bigint,
    from: bigint,
    liquidity: bigint
  ) {
    return TokenDeltaMath.getToken1DeltaRoundUp(to, from, liquidity, false);
  }

  static  getTokenBDelta10(
    to: bigint,
    from: bigint,
    liquidity: bigint
  ) {
    return TokenDeltaMath.getToken0DeltaRoundUp(from, to, liquidity, false);
  }

  static movePriceTowardsTarget(
    zeroToOne: boolean,
    currentPrice: bigint,
    targetPrice: bigint,
    liquidity: bigint,
    amountAvailable: bigint,
    fee: bigint
  ) {
    const getAmountA = zeroToOne ? this.getTokenADelta01 : this.getTokenADelta10;
    let result = {
      resultPrice: 0n,
      input: 0n,
      output: 0n,
      feeAmount: 0n
    }
    if (amountAvailable >= 0) {
      // exactIn or not
      const amountAvailableAfterFee = FullMath.mulDiv(amountAvailable, BigInt(1e6) - fee, BigInt(1e6))
      let input = getAmountA(targetPrice, currentPrice, liquidity);
      if (amountAvailableAfterFee >= input) {
        result.resultPrice = targetPrice;
        result.feeAmount = FullMath.mulDivRoundingUp(input, fee, BigInt(1e6) - fee);
      } else {
        result.resultPrice = this.getNewPriceAfterInput(currentPrice, liquidity, amountAvailableAfterFee, zeroToOne);
        if (targetPrice != result.resultPrice) {
          input = getAmountA(result.resultPrice, currentPrice, liquidity);

          // we didn't reach the target, so take the remainder of the maximum input as fee
          result.feeAmount = amountAvailable - input;
        } else {
          result.feeAmount = FullMath.mulDivRoundingUp(input, fee, BigInt(1e6) - fee);
        }
      }

      result.output = (zeroToOne ? this.getTokenBDelta01 : this.getTokenBDelta10)(result.resultPrice, currentPrice, liquidity);
    } else {
      const getAmountB = zeroToOne ? this.getTokenBDelta01 : this.getTokenBDelta10;

      result.output = getAmountB(targetPrice, currentPrice, liquidity);
      amountAvailable = -amountAvailable;
      if (amountAvailable >= result.output) result.resultPrice = targetPrice;
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
      result.feeAmount = FullMath.mulDivRoundingUp(result.input, fee, BigInt(1e6) - fee);
    }
    return result
  }
}