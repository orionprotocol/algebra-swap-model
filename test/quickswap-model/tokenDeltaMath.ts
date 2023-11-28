/// @title Functions based on Q64.96 sqrt price and liquidity

import assert from 'assert';
import {Constants} from './constants';
import {FullMath} from './FullMath';

/// @notice Contains the math that uses square root of price as a Q64.96 and liquidity to compute deltas
export class TokenDeltaMath {
	/// @notice Gets the token0 delta between two prices
	/// @dev Calculates liquidity / sqrt(lower) - liquidity / sqrt(upper)
	/// @param priceLower A Q64.96 sqrt price
	/// @param priceUpper Another Q64.96 sqrt price
	/// @param liquidity The amount of usable liquidity
	/// @param roundUp Whether to round the amount up or down
	/// @return token0Delta Amount of token0 required to cover a position of size liquidity between the two passed prices
	static getToken0DeltaRoundUp(priceLower: bigint, priceUpper: bigint, liquidity: bigint, roundUp: boolean) {
		const priceDelta = priceUpper - priceLower;
		assert(priceDelta < priceUpper); // forbids underflow and 0 priceLower
		const liquidityShifted = liquidity << Constants.RESOLUTION;

		const token0Delta = roundUp
			? FullMath.divRoundingUp(FullMath.mulDivRoundingUp(priceDelta, liquidityShifted, priceUpper), priceLower)
			: FullMath.mulDiv(priceDelta, liquidityShifted, priceUpper) / priceLower;
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
	static getToken1DeltaRoundUp(priceLower: bigint, priceUpper: bigint, liquidity: bigint, roundUp: boolean) {
		assert(priceUpper >= priceLower);
		const priceDelta = priceUpper - priceLower;
		const token1Delta = roundUp
			? FullMath.mulDivRoundingUp(priceDelta, liquidity, Constants.Q96)
			: FullMath.mulDiv(priceDelta, liquidity, Constants.Q96);
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
	static getToken0Delta(priceLower: bigint, priceUpper: bigint, liquidity: bigint) {
		const token0Delta =
			liquidity >= 0
				? TokenDeltaMath.getToken0DeltaRoundUp(priceLower, priceUpper, liquidity, true)
				: -TokenDeltaMath.getToken0DeltaRoundUp(priceLower, priceUpper, -liquidity, false);
	}

	/// @notice Helper that gets signed token1 delta
	/// @param priceLower A Q64.96 sqrt price
	/// @param priceUpper Another Q64.96 sqrt price
	/// @param liquidity The change in liquidity for which to compute the token1 delta
	/// @return token1Delta Amount of token1 corresponding to the passed liquidityDelta between the two prices
	static getToken1Delta(priceLower: bigint, priceUpper: bigint, liquidity: bigint) {
		const token1Delta =
			liquidity >= 0
				? TokenDeltaMath.getToken1DeltaRoundUp(priceLower, priceUpper, liquidity, true)
				: -TokenDeltaMath.getToken1DeltaRoundUp(priceLower, priceUpper, -liquidity, false);
	}
}
