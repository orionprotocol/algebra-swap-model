import {LiquidityMath} from './liquidityMath';
import {Constants} from './constants';
import { Tick } from "./types";
import { BigNumberish } from 'ethers';


export class TickManager {

	static getTick(ticks: Partial<{[n: number]: Tick}>, index: BigNumberish) {
		let tick = ticks[Number(index)];
		if (tick == undefined) {
			tick = {
				liquidityTotal: 0n,
				liquidityDelta: 0n,
				outerFeeGrowth0Token: 0n,
				outerFeeGrowth1Token: 0n,
				outerTickCumulative: 0n,
				outerSecondsPerLiquidity: 0n,
				outerSecondsSpent: 0n,
				initialized: false,
			};
		}
		return tick;
	}

	/// @notice Retrieves fee growth data
	/// @param self The mapping containing all tick information for initialized ticks
	/// @param bottomTick The lower tick boundary of the position
	/// @param topTick The upper tick boundary of the position
	/// @param currentTick The current tick
	/// @param totalFeeGrowth0Token The all-time global fee growth, per unit of liquidity, in token0
	/// @param totalFeeGrowth1Token The all-time global fee growth, per unit of liquidity, in token1
	/// @return innerFeeGrowth0Token The all-time fee growth in token0, per unit of liquidity, inside the position's tick boundaries
	/// @return innerFeeGrowth1Token The all-time fee growth in token1, per unit of liquidity, inside the position's tick boundaries
	static getInnerFeeGrowth(
		ticks: Partial<{[n: number]: Tick}>,
		bottomTick: bigint,
		topTick: bigint,
		currentTick: bigint,
		totalFeeGrowth0Token: bigint,
		totalFeeGrowth1Token: bigint
	): [innerFeeGrowth0Token: bigint, innerFeeGrowth1Token: bigint] {
		let innerFeeGrowth0Token: bigint, innerFeeGrowth1Token: bigint;
		const lower = this.getTick(ticks, bottomTick);
		const upper = this.getTick(ticks, topTick);

		if (currentTick < topTick) {
			if (currentTick >= bottomTick) {
				innerFeeGrowth0Token = totalFeeGrowth0Token - lower.outerFeeGrowth0Token;
				innerFeeGrowth1Token = totalFeeGrowth1Token - lower.outerFeeGrowth1Token;
			} else {
				innerFeeGrowth0Token = lower.outerFeeGrowth0Token;
				innerFeeGrowth1Token = lower.outerFeeGrowth1Token;
			}
			innerFeeGrowth0Token -= upper.outerFeeGrowth0Token;
			innerFeeGrowth1Token -= upper.outerFeeGrowth1Token;
		} else {
			innerFeeGrowth0Token = upper.outerFeeGrowth0Token - lower.outerFeeGrowth0Token;
			innerFeeGrowth1Token = upper.outerFeeGrowth1Token - lower.outerFeeGrowth1Token;
		}
		return [innerFeeGrowth0Token, innerFeeGrowth1Token];
	}

	/// @notice Updates a tick and returns true if the tick was flipped from initialized to uninitialized, or vice versa
	/// @param self The mapping containing all tick information for initialized ticks
	/// @param tick The tick that will be updated
	/// @param currentTick The current tick
	/// @param liquidityDelta A new amount of liquidity to be added (subtracted) when tick is crossed from left to right (right to left)
	/// @param totalFeeGrowth0Token The all-time global fee growth, per unit of liquidity, in token0
	/// @param totalFeeGrowth1Token The all-time global fee growth, per unit of liquidity, in token1
	/// @param secondsPerLiquidityCumulative The all-time seconds per max(1, liquidity) of the pool
	/// @param tickCumulative The all-time global cumulative tick
	/// @param time The current block timestamp cast to a uint32
	/// @param upper true for updating a position's upper tick, or false for updating a position's lower tick
	/// @return flipped Whether the tick was flipped from initialized to uninitialized, or vice versa
	static update(
		ticks: Partial<{[n: number]: Tick}>,
		tick: bigint,
		currentTick: bigint,
		liquidityDelta: bigint,
		totalFeeGrowth0Token: bigint,
		totalFeeGrowth1Token: bigint,
		secondsPerLiquidityCumulative: bigint,
		tickCumulative: bigint,
		time: bigint,
		upper: boolean
	): boolean {
		let data = TickManager.getTick(ticks, tick);

		const liquidityDeltaBefore = data.liquidityDelta;
		const liquidityTotalBefore = data.liquidityTotal;

		const liquidityTotalAfter = LiquidityMath.addDelta(liquidityTotalBefore, liquidityDelta);
		if (liquidityTotalAfter >= Constants.MAX_LIQUIDITY_PER_TICK + 1n) {
			throw 'LO';
		}

		// when the lower (upper) tick is crossed left to right (right to left), liquidity must be added (removed)
		data.liquidityDelta = upper ? liquidityDeltaBefore - liquidityDelta : liquidityDeltaBefore + liquidityDelta;

		data.liquidityTotal = liquidityTotalAfter;

		let flipped = liquidityTotalAfter == 0n;
		if (liquidityTotalBefore == 0n) {
			flipped = !flipped;
			// by convention, we assume that all growth before a tick was initialized happened _below_ the tick
			if (tick <= currentTick) {
				data.outerFeeGrowth0Token = totalFeeGrowth0Token;
				data.outerFeeGrowth1Token = totalFeeGrowth1Token;
				data.outerSecondsPerLiquidity = secondsPerLiquidityCumulative;
				data.outerTickCumulative = tickCumulative;
				data.outerSecondsSpent = time;
			}
			data.initialized = true;
		}
		ticks[Number(tick)] = data;
		return flipped
	}

	/// @notice Transitions to next tick as needed by price movement
	/// @param self The mapping containing all tick information for initialized ticks
	/// @param tick The destination tick of the transition
	/// @param totalFeeGrowth0Token The all-time global fee growth, per unit of liquidity, in token0
	/// @param totalFeeGrowth1Token The all-time global fee growth, per unit of liquidity, in token1
	/// @param secondsPerLiquidityCumulative The current seconds per liquidity
	/// @param tickCumulative The all-time global cumulative tick
	/// @param time The current block.timestamp
	/// @return liquidityDelta The amount of liquidity added (subtracted) when tick is crossed from left to right (right to left)
	static cross(
		ticks: Partial<{[n: number]: Tick}>,
		tick: bigint,
		totalFeeGrowth0Token: bigint,
		totalFeeGrowth1Token: bigint,
		secondsPerLiquidityCumulative: bigint,
		tickCumulative: bigint,
		time: bigint
	) {
		//console.log("==============================================");
		//console.log("cross")
		//console.log("Params")
		//console.log("tick");
		//console.log(tick);
		//console.log("totalFeeGrowth0Token");
		//console.log(totalFeeGrowth0Token);
		//console.log("totalFeeGrowth1Token");
		//console.log(totalFeeGrowth1Token);
		//console.log("secondsPerLiquidityCumulative");
		//console.log(secondsPerLiquidityCumulative);
		//console.log("tickCumulative");
		//console.log(tickCumulative);
		//console.log("time");
		//console.log(time);
		const data = TickManager.getTick(ticks, tick);

		data.outerSecondsSpent = time - data.outerSecondsSpent;
		data.outerSecondsPerLiquidity = secondsPerLiquidityCumulative - data.outerSecondsPerLiquidity;
		data.outerTickCumulative = tickCumulative - data.outerTickCumulative;

		data.outerFeeGrowth1Token = totalFeeGrowth1Token - data.outerFeeGrowth1Token;
		data.outerFeeGrowth0Token = totalFeeGrowth0Token - data.outerFeeGrowth0Token;
		//console.log("data");
		//console.log("data.initialized");
		//console.log(data.initialized);
		//console.log("data.liquidityDelta");
		//console.log(data.liquidityDelta);
		//console.log("data.liquidityTotal");
		//console.log(data.liquidityTotal);
		//console.log("data.outerFeeGrowth0Token");
		//console.log(data.outerFeeGrowth0Token);
		//console.log("data.outerFeeGrowth1Token");
		//console.log(data.outerFeeGrowth1Token);
		//console.log("data.outerSecondsPerLiquidity");
		//console.log(data.outerSecondsPerLiquidity);
		//console.log("data.outerSecondsSpent");
		//console.log(data.outerSecondsSpent);
		//console.log("data.outerTickCumulative");
		//console.log(data.outerTickCumulative);
		//console.log("==============================================");
		ticks[Number(tick)] = data;
		return data.liquidityDelta;
	}
}
