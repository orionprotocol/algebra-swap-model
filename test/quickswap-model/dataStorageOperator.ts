import assert from 'assert';
import {BigNumberish} from 'ethers';
import {AdaptiveFee, Configuration} from './adaptiveFee';
import {ethers} from 'hardhat';
import {AlgebraPool, DataStorageOperator as DataStorageOperatorContract} from '../../typechain';

const WINDOW = 60n * 60n * 24n;
const UINT16_MODULO = 65536n;
interface Timepoint {
	initialized: boolean; // whether or not the timepoint is initialized
	blockTimestamp: bigint; // the block timestamp of th: biginte
	tickCumulative: bigint; // the tick accumulator, i.e. tick * time elapsed since the pool was first initialized
	secondsPerLiquidityCumulative: bigint; // the seconds per liquidity since the pool was first initialized
	volatilityCumulative: bigint; // the volatility accumulator; overflow after ~34800 years is desired :)
	averageTick: bigint; // average tick at this blockTimestamp
	volumePerLiquidityCumulative: bigint; // the gmean(volumes)/liquidity accumulator
}

export class DataStorageOperator {
	timepoints: Timepoint[];
	feeConfig: Configuration;
	poolAddress: string;

	constructor(poolAddress: string) {
		this.timepoints = [];
		this.feeConfig = {} as Configuration;
		this.poolAddress = poolAddress;
	}

	async getFeeConfig() {
		const pool = <AlgebraPool>await ethers.getContractAt('AlgebraPool', this.poolAddress);
		const dataStorageContract = <DataStorageOperatorContract>(
			await ethers.getContractAt('DataStorageOperator', await pool.dataStorageOperator())
		);
		return (await dataStorageContract.feeConfig()).toObject();
	}

	async getTimepoint(index: BigNumberish) {
		index = BigInt(index) % 2n ** 16n;
		const pool = <AlgebraPool>await ethers.getContractAt('AlgebraPool', this.poolAddress);
		let timepoint = this.timepoints[Number(index)];
		if (timepoint == undefined) {
			timepoint = (await pool.timepoints(index)).toObject();
		}
		// console.log("DataStorageOperator::getTimepoint ", index)
		return timepoint;
	}

	async write(
		index: bigint,
		blockTimestamp: bigint,
		tick: bigint,
		liquidity: bigint,
		volumePerLiquidity: bigint
	): Promise<bigint> {
		let _last = await this.getTimepoint(index);
		// early return if we've already written an timepoint this block
		console.log(blockTimestamp);
		console.log(_last);
		if (_last.blockTimestamp == blockTimestamp) {
			return index;
		}
		let last = _last;

		// get next index considering overflow
		const indexUpdated = index + 1n;

		let oldestIndex = 0n;
		// check if we have overflow in the past
		if ((await this.getTimepoint(indexUpdated)).initialized) {
			oldestIndex = indexUpdated;
		}

		const avgTick = await this._getAverageTick(
			blockTimestamp,
			tick,
			index,
			oldestIndex,
			last.blockTimestamp,
			last.tickCumulative
		);
		let prevTick = tick;
		if (index != oldestIndex) {
			const _prevLast = await this.getTimepoint(index - 1n); // considering index underflow
			const _prevLastBlockTimestamp = _prevLast.blockTimestamp;
			const _prevLastTickCumulative = _prevLast.tickCumulative;
			prevTick =
				(last.tickCumulative - _prevLastTickCumulative) / (last.blockTimestamp - _prevLastBlockTimestamp);
		}

		this[Number(indexUpdated)] = DataStorageOperator.createNewTimepoint(
			last,
			blockTimestamp,
			tick,
			prevTick,
			liquidity,
			avgTick,
			volumePerLiquidity
		);

		return indexUpdated;
	}

	static lteConsideringOverflow(a: bigint, b: bigint, currentTime: bigint) {
		let res = a > currentTime;
		if (res == b > currentTime) res = a <= b; // if both are on the same side
		return res;
	}

	/// @dev guaranteed that the result is within the bounds of int24
	/// returns int256 for fuzzy tests
	private async _getAverageTick(
		time: bigint,
		tick: bigint,
		index: bigint,
		oldestIndex: bigint,
		lastTimestamp: bigint,
		lastTickCumulative: bigint
	): Promise<bigint> {
		const oldestTimestamp = (await this.getTimepoint(oldestIndex)).blockTimestamp;
		const oldestTickCumulative = (await this.getTimepoint(oldestIndex)).tickCumulative;
		console.log('_getAverageTick');
		console.log('time');
		console.log(time);
		console.log('tick');
		console.log(tick);
		console.log('index');
		console.log(index);
		console.log('oldestIndex');
		console.log(oldestIndex);
		console.log('lastTimestamp');
		console.log(lastTimestamp);
		console.log('lastTickCumulative');
		console.log(lastTickCumulative);
		let avgTick;
		if (DataStorageOperator.lteConsideringOverflow(oldestTimestamp, time - WINDOW, time)) {
			if (DataStorageOperator.lteConsideringOverflow(lastTimestamp, time - WINDOW, time)) {
				index = (index - 1n) % UINT16_MODULO; // considering underflow
				const startTimepoint = await this.getTimepoint(index);
				console.log('startTimepoint');
				console.log(startTimepoint);
				avgTick = startTimepoint.initialized
					? (lastTickCumulative - startTimepoint.tickCumulative) /
					  (lastTimestamp - startTimepoint.blockTimestamp)
					: tick;
			} else {
				const startOfWindow = await this.getSingleTimepoint(time, WINDOW, tick, index, 0n);

				//    current-WINDOW  last   current
				// _________*____________*_______*_
				//           ||||||||||||
				avgTick = (lastTickCumulative - startOfWindow.tickCumulative) / (lastTimestamp - time + WINDOW);
			}
		} else {
			avgTick =
				lastTimestamp == oldestTimestamp
					? tick
					: (lastTickCumulative - oldestTickCumulative) / (lastTimestamp - oldestTimestamp);
		}
		return avgTick;
	}

	async getSingleTimepoint(time: bigint, secondsAgo: bigint, tick: bigint, index: bigint, liquidity: bigint) {
		let oldestIndex = 0n;
		// check if we have overflow in the past
		const nextIndex = index + 1n; // considering overflow
		if ((await this.getTimepoint(nextIndex)).initialized) {
			oldestIndex = nextIndex;
		}
		return this._getSingleTimepoint(time, secondsAgo, tick, index, oldestIndex, liquidity);
	}

	async _getSingleTimepoint(
		time: bigint,
		secondsAgo: bigint,
		tick: bigint,
		index: bigint,
		oldestIndex: bigint,
		liquidity: bigint
	) {
		const target = time - secondsAgo;

		// if target is newer than last timepoint
		if (
			secondsAgo == 0n ||
			DataStorageOperator.lteConsideringOverflow((await this.getTimepoint(index)).blockTimestamp, target, time)
		) {
			const last = await this.getTimepoint(index);
			if (last.blockTimestamp == target) {
				return last;
			} else {
				// otherwise, we need to add new timepoint
				const avgTick = await this._getAverageTick(
					time,
					tick,
					index,
					oldestIndex,
					last.blockTimestamp,
					last.tickCumulative
				);
				let prevTick = tick;
				{
					if (index != oldestIndex) {
						const _prevLast = await this.getTimepoint(index - 1n); // considering index underflow
						prevTick =
							(last.tickCumulative - _prevLast.tickCumulative) /
							(last.blockTimestamp - _prevLast.blockTimestamp);
					}
				}
				return DataStorageOperator.createNewTimepoint(last, target, tick, prevTick, liquidity, avgTick, 0n);
			}
		}

		assert(
			DataStorageOperator.lteConsideringOverflow(
				(await this.getTimepoint(oldestIndex)).blockTimestamp,
				target,
				time
			),
			'OLD'
		);
		const [beforeOrAt, atOrAfter] = await this.binarySearch(time, target, index, oldestIndex);

		if (target == atOrAfter.blockTimestamp) {
			return atOrAfter; // we're at the right boundary
		}

		if (target != beforeOrAt.blockTimestamp) {
			// we're in the middle
			const timepointTimeDelta = atOrAfter.blockTimestamp - beforeOrAt.blockTimestamp;
			const targetDelta = target - beforeOrAt.blockTimestamp;

			// For gas savings the resulting point is written to beforeAt
			beforeOrAt.tickCumulative +=
				((atOrAfter.tickCumulative - beforeOrAt.tickCumulative) / timepointTimeDelta) * targetDelta;
			beforeOrAt.secondsPerLiquidityCumulative +=
				((atOrAfter.secondsPerLiquidityCumulative - beforeOrAt.secondsPerLiquidityCumulative) * targetDelta) /
				timepointTimeDelta;
			beforeOrAt.volatilityCumulative +=
				((atOrAfter.volatilityCumulative - beforeOrAt.volatilityCumulative) / timepointTimeDelta) * targetDelta;
			beforeOrAt.volumePerLiquidityCumulative +=
				((atOrAfter.volumePerLiquidityCumulative - beforeOrAt.volumePerLiquidityCumulative) /
					timepointTimeDelta) *
				targetDelta;
		}

		// we're at the left boundary or at the middle
		return beforeOrAt;
	}

	async binarySearch(
		time: bigint,
		target: bigint,
		lastIndex: bigint,
		oldestIndex: bigint
	): Promise<[beforeOrAt: Timepoint, atOrAfter: Timepoint]> {
		let left = oldestIndex; // oldest timepoint
		let right = lastIndex >= oldestIndex ? lastIndex : lastIndex + UINT16_MODULO; // newest timepoint considering one index overflow
		let current = (left + right) >> 1n; // "middle" point between the boundaries

		let beforeOrAt;
		let atOrAfter;
		do {
			beforeOrAt = await this.getTimepoint(current); // checking the "middle" point between the boundaries
			const [initializedBefore, timestampBefore] = [beforeOrAt.initialized, beforeOrAt.blockTimestamp];
			if (initializedBefore) {
				if (DataStorageOperator.lteConsideringOverflow(timestampBefore, target, time)) {
					// is current point before or at `target`?
					atOrAfter = await this.getTimepoint(current + 1n); // checking the next point after "middle"
					const [initializedAfter, timestampAfter] = [atOrAfter.initialized, atOrAfter.blockTimestamp];
					if (initializedAfter) {
						if (DataStorageOperator.lteConsideringOverflow(target, timestampAfter, time)) {
							// is the "next" point after or at `target`?
							return [beforeOrAt, atOrAfter]; // the only fully correct way to finish
						}
						left = current + 1n; // "next" point is before the `target`, so looking in the right half
					} else {
						// beforeOrAt is initialized and <= target, and next timepoint is uninitialized
						// should be impossible if initial boundaries and `target` are correct
						return [beforeOrAt, beforeOrAt];
					}
				} else {
					right = current - 1n; // current point is after the `target`, so looking in the left half
				}
			} else {
				// we've landed on an uninitialized timepoint, keep searching higher
				// should be impossible if initial boundaries and `target` are correct
				left = current + 1n;
			}
			current = (left + right) >> 1n; // calculating the new "middle" point index after updating the bounds
		} while (true);
	}

	static createNewTimepoint(
		last: Timepoint,
		blockTimestamp: bigint,
		tick: bigint,
		prevTick: bigint,
		liquidity: bigint,
		averageTick: bigint,
		volumePerLiquidity: bigint
	) {
		const delta = blockTimestamp - last.blockTimestamp;
		let newLast = {} as Timepoint;
		newLast.initialized = true;
		newLast.blockTimestamp = blockTimestamp;
		newLast.tickCumulative = last.tickCumulative + tick * delta;
		newLast.secondsPerLiquidityCumulative =
			last.secondsPerLiquidityCumulative + (delta << 128n) / (liquidity > 0n ? liquidity : 1n); // just timedelta if liquidity == 0
		newLast.volatilityCumulative =
			last.volatilityCumulative +
			DataStorageOperator._volatilityOnRange(delta, prevTick, tick, last.averageTick, averageTick); // always fits 88 bits
		newLast.averageTick = averageTick;
		newLast.volumePerLiquidityCumulative = last.volumePerLiquidityCumulative + volumePerLiquidity;

		return newLast;
	}

	static _volatilityOnRange(dt: bigint, tick0: bigint, tick1: bigint, avgTick0: bigint, avgTick1: bigint) {
		// On the time interval from the previous timepoint to the current
		// we can represent tick and average tick change as two straight lines:
		// tick = k*t + b, where k and b are some constants
		// avgTick = p*t + q, where p and q are some constants
		// we want to get sum of (tick(t) - avgTick(t))^2 for every t in the interval (0; dt]
		// so: (tick(t) - avgTick(t))^2 = ((k*t + b) - (p*t + q))^2 = (k-p)^2 * t^2 + 2(k-p)(b-q)t + (b-q)^2
		// since everything except t is a constant, we need to use progressions for t and t^2:
		// sum(t) for t from 1 to dt = dt*(dt + 1)/2 = sumOfSequence
		// sum(t^2) for t from 1 to dt = dt*(dt+1)*(2dt + 1)/6 = sumOfSquares
		// so result will be: (k-p)^2 * sumOfSquares + 2(k-p)(b-q)*sumOfSequence + dt*(b-q)^2
		const K = tick1 - tick0 - (avgTick1 - avgTick0); // (k - p)*dt
		const B = (tick0 - avgTick0) * dt; // (b - q)*dt
		const sumOfSquares = dt * (dt + 1n) * (2n * dt + 1n); // sumOfSquares * 6
		const sumOfSequence = dt * (dt + 1n); // sumOfSequence * 2
		const volatility = (K ** 2n * sumOfSquares + 6n * B * K * sumOfSequence + 6n * dt * B ** 2n) / (6n * dt ** 2n);
		return volatility;
	}
	async getAverages(
		time: bigint,
		tick: bigint,
		index: bigint,
		liquidity: bigint
	): Promise<[volatilityAverage: bigint, volumePerLiqAverage: bigint]> {
		let oldestIndex = 0n;
		let oldest = await this.getTimepoint(0n);
		const nextIndex = (index + 1n) % 2n ** 16n; // considering overflow
		if ((await this.getTimepoint(nextIndex)).initialized) {
			oldest = await this.getTimepoint(nextIndex);
			oldestIndex = nextIndex;
		}

		const endOfWindow = await this._getSingleTimepoint(time, 0n, tick, index, oldestIndex, liquidity);
		console.log('endOfWindow');
		console.log(endOfWindow);
		const oldestTimestamp = oldest.blockTimestamp;
		if (DataStorageOperator.lteConsideringOverflow(oldestTimestamp, time - WINDOW, time)) {
			const startOfWindow = await this._getSingleTimepoint(time, WINDOW, tick, index, oldestIndex, liquidity);
			console.log('startOfWindow');
			console.log(startOfWindow);
			return [
				(endOfWindow.volatilityCumulative - startOfWindow.volatilityCumulative) / WINDOW,
				(endOfWindow.volumePerLiquidityCumulative - startOfWindow.volumePerLiquidityCumulative) >> 57n,
			];
		} else if (time != oldestTimestamp) {
			const _oldestVolatilityCumulative = oldest.volatilityCumulative;
			const _oldestVolumePerLiquidityCumulative = oldest.volumePerLiquidityCumulative;
			return [
				(endOfWindow.volatilityCumulative - _oldestVolatilityCumulative) / (time - oldestTimestamp),
				(endOfWindow.volumePerLiquidityCumulative - _oldestVolumePerLiquidityCumulative) >> 57n,
			];
		}
		throw 'END OF GET AVERAGES';
	}
	/// @inheritdoc IDataStorageOperator
	async getFee(_time: bigint, _tick: bigint, _index: bigint, _liquidity: bigint) {
		console.log('_time');
		console.log(_time);
		console.log('_tick');
		console.log(_tick);
		console.log('_index');
		console.log(_index);
		console.log('_liquidity');
		console.log(_liquidity);
		const [volatilityAverage, volumePerLiqAverage] = await this.getAverages(_time, _tick, _index, _liquidity);
		console.log('volatilityAverage');
		console.log(volatilityAverage);
		console.log('volumePerLiqAverage');
		console.log(volumePerLiqAverage);
		const feeConfig = await this.getFeeConfig();
		return AdaptiveFee.getFee(volatilityAverage / 15n, volumePerLiqAverage, feeConfig);
	}
}
