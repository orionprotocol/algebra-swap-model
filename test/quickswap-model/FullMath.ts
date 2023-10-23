import { MaxUint256 } from "ethers";

export class FullMath {

  static mulDiv(
    a: bigint,
    b: bigint,
    denominator: bigint
  ) {
    // 512-bit multiply [prod1 prod0] = a * b
    // Compute the product mod 2**256 and mod 2**256 - 1
    // then use the Chinese Remainder Theorem to reconstruct
    // the 512 bit result. The result is stored in two 256
    // variables such that product = prod1 * 2**256 + prod0
    let prod0 = a * b; // Least significant 256 bits of the product
    const mm = (a * b) % MaxUint256 // Most significant 256 bits of the product
    let prod1 = mm - prod0
    if (mm < prod0) {
      prod1 -= 1n
    }

    // Make sure the result is less than 2**256.
    // Also prevents denominator == 0
    if (denominator <= prod1) {
      throw "denominator <= prod1"
    };

    // Handle non-overflow cases, 256 by 256 division
    if (prod1 == 0n) {
      const result = prod0 / denominator
      return result;
    }

    ///////////////////////////////////////////////
    // 512 by 256 division.
    ///////////////////////////////////////////////

    // Make division exact by subtracting the remainder from [prod1 prod0]
    // Compute remainder using mulmod
    // Subtract 256 bit remainder from 512 bit number
    const remainder = a * b % denominator
    prod1 = prod1 - (remainder > prod0 ? 1n : 0n)
    prod0 = prod0 - remainder

    // Factor powers of two out of denominator
    // Compute largest power of two divisor of denominator.
    // Always >= 1.
    let twos = -denominator & denominator;
    // Divide denominator by power of two
    denominator = denominator / twos

    // Divide [prod1 prod0] by the factors of two
    prod0 = prod0 / twos

    // Shift in bits from prod1 into prod0. For this we need
    // to flip `twos` such that it is 2**256 / twos.
    // If twos is zero, then it becomes one
    if (twos == 0n) {
      twos = 1n
    } else if (twos == MaxUint256) {
      twos = 0n
    } else {
      twos = (MaxUint256 + 1n - twos) / twos + 1n

    }
    prod0 |= prod1 * twos;

    // Invert denominator mod 2**256
    // Now that denominator is an odd number, it has an inverse
    // modulo 2**256 such that denominator * inv = 1 mod 2**256.
    // Compute the inverse by starting with a seed that is correct
    // correct for four bits. That is, denominator * inv = 1 mod 2**4
    let inv = (3n * denominator) ^ 2n;
    // Now use Newton-Raphson iteration to improve the precision.
    // Thanks to Hensel's lifting lemma, this also works in modular
    // arithmetic, doubling the correct bits in each step.
    inv *= 2n - denominator * inv; // inverse mod 2**8
    inv *= 2n - denominator * inv; // inverse mod 2**16
    inv *= 2n - denominator * inv; // inverse mod 2**32
    inv *= 2n - denominator * inv; // inverse mod 2**64
    inv *= 2n - denominator * inv; // inverse mod 2**128
    inv *= 2n - denominator * inv; // inverse mod 2**256

    // Because the division is now exact we can divide by multiplying
    // with the modular inverse of denominator. This will give us the
    // correct result modulo 2**256. Since the preconditions guarantee
    // that the outcome is less than 2**256, this is the final result.
    // We don't need to compute the high bits of the result and prod1
    // is no longer required.
    const result = prod0 * inv;
    return result;
  }

  /// @notice Calculates ceil(a×b÷denominator) with full precision. Throws if result overflows a uint256 or denominator == 0
  /// @param a The multiplicand
  /// @param b The multiplier
  /// @param denominator The divisor
  /// @return result The 256-bit result
  static mulDivRoundingUp(
    a: bigint,
    b: bigint,
    denominator: bigint
  ) {
    if (a === 0n) return 0n
    let result = a * b / a
    if (a == 0n || (result == b)) {
      if (denominator <= 0) {
        throw ("denominator <= 0")
      };
      result = FullMath.divRoundingUp(result, denominator)
    } else {
      result = FullMath.mulDiv(a, b, denominator);
      if (a * b % denominator > 0n) {
        if (result == MaxUint256) {
          throw ("result == MaxUint256")
        };
        result++;
      }
    }
    return result
  }

  /// @notice Returns ceil(x / y)
  /// @dev division by 0 has unspecified behavior, and must be checked externally
  /// @param x The dividend
  /// @param y The divisor
  /// @return z The quotient, ceil(x / y)
  static divRoundingUp(x: bigint, y: bigint) {
    return x / y + x % y > 0 ? 1n : 0n
  }
}