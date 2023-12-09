"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataStorageOperator = void 0;
const assert_1 = __importDefault(require("assert"));
const adaptiveFee_1 = require("./adaptiveFee");
const WINDOW = 60n * 60n * 24n;
const UINT16_MODULO = 65536n;
class DataStorageOperator {
    static getTimepoint(timepoints, index) {
        index = BigInt(index) % 2n ** 16n;
        let timepoint = timepoints[Number(index)];
        if (timepoint === undefined) {
            timepoint = {
                initialized: false,
                blockTimestamp: 0n, // the block timestamp of th: biginte
                tickCumulative: 0n, // the tick accumulator, i.e. tick * time elapsed since the pool was first initialized
                secondsPerLiquidityCumulative: 0n, // the seconds per liquidity since the pool was first initialized
                volatilityCumulative: 0n, // the volatility accumulator, overflow after ~34800 years is desired :)
                averageTick: 0n, // average tick at this blockTimestamp
                volumePerLiquidityCumulative: 0n, // the gmean(volumes)/liquidity accumulator
            };
        }
        return timepoint;
    }
    static write(timepoints, index, blockTimestamp, tick, liquidity, volumePerLiquidity) {
        let _last = DataStorageOperator.getTimepoint(timepoints, index);
        // early return if we've already written an timepoint this block
        if (_last.blockTimestamp == blockTimestamp) {
            return index;
        }
        let last = _last;
        // get next index considering overflow
        const indexUpdated = index + 1n;
        let oldestIndex = 0n;
        // check if we have overflow in the past
        if ((DataStorageOperator.getTimepoint(timepoints, indexUpdated)).initialized) {
            oldestIndex = indexUpdated;
        }
        const avgTick = DataStorageOperator._getAverageTick(timepoints, blockTimestamp, tick, index, oldestIndex, last.blockTimestamp, last.tickCumulative);
        let prevTick = tick;
        if (index != oldestIndex) {
            const _prevLast = DataStorageOperator.getTimepoint(timepoints, index - 1n); // considering index underflow
            const _prevLastBlockTimestamp = _prevLast.blockTimestamp;
            const _prevLastTickCumulative = _prevLast.tickCumulative;
            prevTick =
                (last.tickCumulative - _prevLastTickCumulative) / (last.blockTimestamp - _prevLastBlockTimestamp);
        }
        timepoints[Number(indexUpdated)] = DataStorageOperator.createNewTimepoint(last, blockTimestamp, tick, prevTick, liquidity, avgTick, volumePerLiquidity);
        console.log('NewTimepointCreated');
        console.log('{');
        console.log(timepoints[Number(indexUpdated)].initialized);
        console.log(timepoints[Number(indexUpdated)].blockTimestamp);
        console.log(timepoints[Number(indexUpdated)].tickCumulative);
        console.log(timepoints[Number(indexUpdated)].secondsPerLiquidityCumulative);
        console.log(timepoints[Number(indexUpdated)].volatilityCumulative);
        console.log(timepoints[Number(indexUpdated)].averageTick);
        console.log(timepoints[Number(indexUpdated)].volumePerLiquidityCumulative);
        console.log('}');
        return indexUpdated;
    }
    static lteConsideringOverflow(a, b, currentTime) {
        let res = a > currentTime;
        if (res == b > currentTime)
            res = a <= b; // if both are on the same side
        return res;
    }
    /// @dev guaranteed that the result is within the bounds of int24
    /// returns int256 for fuzzy tests
    static _getAverageTick(timepoints, time, tick, index, oldestIndex, lastTimestamp, lastTickCumulative) {
        const oldestTimestamp = (DataStorageOperator.getTimepoint(timepoints, oldestIndex)).blockTimestamp;
        const oldestTickCumulative = (DataStorageOperator.getTimepoint(timepoints, oldestIndex)).tickCumulative;
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
                const startTimepoint = DataStorageOperator.getTimepoint(timepoints, index);
                console.log('startTimepoint');
                console.log(startTimepoint);
                avgTick = startTimepoint.initialized
                    ? (lastTickCumulative - startTimepoint.tickCumulative) /
                        (lastTimestamp - startTimepoint.blockTimestamp)
                    : tick;
            }
            else {
                const startOfWindow = DataStorageOperator.getSingleTimepoint(timepoints, time, WINDOW, tick, index, 0n);
                //    current-WINDOW  last   current
                // _________*____________*_______*_
                //           ||||||||||||
                avgTick = (lastTickCumulative - startOfWindow.tickCumulative) / (lastTimestamp - time + WINDOW);
            }
        }
        else {
            avgTick =
                lastTimestamp == oldestTimestamp
                    ? tick
                    : (lastTickCumulative - oldestTickCumulative) / (lastTimestamp - oldestTimestamp);
        }
        return avgTick;
    }
    static getSingleTimepoint(timepoints, time, secondsAgo, tick, index, liquidity) {
        let oldestIndex = 0n;
        // check if we have overflow in the past
        const nextIndex = index + 1n; // considering overflow
        if (timepoints[Number(nextIndex)] && timepoints[Number(nextIndex)].initialized) {
            oldestIndex = nextIndex;
        }
        return DataStorageOperator._getSingleTimepoint(timepoints, time, secondsAgo, tick, index, oldestIndex, liquidity);
    }
    static _getSingleTimepoint(timepoints, time, secondsAgo, tick, index, oldestIndex, liquidity) {
        const target = time - secondsAgo;
        // if target is newer than last timepoint
        if (secondsAgo == 0n ||
            DataStorageOperator.lteConsideringOverflow((DataStorageOperator.getTimepoint(timepoints, index)).blockTimestamp, target, time)) {
            const last = DataStorageOperator.getTimepoint(timepoints, index);
            console.log('last timepoint');
            console.log(last);
            if (last.blockTimestamp == target) {
                return last;
            }
            else {
                // otherwise, we need to add new timepoint
                const avgTick = DataStorageOperator._getAverageTick(timepoints, time, tick, index, oldestIndex, last.blockTimestamp, last.tickCumulative);
                let prevTick = tick;
                {
                    if (index != oldestIndex) {
                        const _prevLast = DataStorageOperator.getTimepoint(timepoints, index - 1n); // considering index underflow
                        prevTick =
                            (last.tickCumulative - _prevLast.tickCumulative) /
                                (last.blockTimestamp - _prevLast.blockTimestamp);
                    }
                }
                return DataStorageOperator.createNewTimepoint(last, target, tick, prevTick, liquidity, avgTick, 0n);
            }
        }
        (0, assert_1.default)(DataStorageOperator.lteConsideringOverflow((DataStorageOperator.getTimepoint(timepoints, oldestIndex)).blockTimestamp, target, time), 'OLD');
        const [beforeOrAt, atOrAfter] = DataStorageOperator.binarySearch(timepoints, time, target, index, oldestIndex);
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
    static binarySearch(timepoints, time, target, lastIndex, oldestIndex) {
        let left = oldestIndex; // oldest timepoint
        let right = lastIndex >= oldestIndex ? lastIndex : lastIndex + UINT16_MODULO; // newest timepoint considering one index overflow
        let current = (left + right) >> 1n; // "middle" point between the boundaries
        let beforeOrAt;
        let atOrAfter;
        do {
            beforeOrAt = DataStorageOperator.getTimepoint(timepoints, current); // checking the "middle" point between the boundaries
            const [initializedBefore, timestampBefore] = [beforeOrAt.initialized, beforeOrAt.blockTimestamp];
            if (initializedBefore) {
                if (DataStorageOperator.lteConsideringOverflow(timestampBefore, target, time)) {
                    // is current point before or at `target`?
                    atOrAfter = DataStorageOperator.getTimepoint(timepoints, current + 1n); // checking the next point after "middle"
                    const [initializedAfter, timestampAfter] = [atOrAfter.initialized, atOrAfter.blockTimestamp];
                    if (initializedAfter) {
                        if (DataStorageOperator.lteConsideringOverflow(target, timestampAfter, time)) {
                            // is the "next" point after or at `target`?
                            return [beforeOrAt, atOrAfter]; // the only fully correct way to finish
                        }
                        left = current + 1n; // "next" point is before the `target`, so looking in the right half
                    }
                    else {
                        // beforeOrAt is initialized and <= target, and next timepoint is uninitialized
                        // should be impossible if initial boundaries and `target` are correct
                        return [beforeOrAt, beforeOrAt];
                    }
                }
                else {
                    right = current - 1n; // current point is after the `target`, so looking in the left half
                }
            }
            else {
                // we've landed on an uninitialized timepoint, keep searching higher
                // should be impossible if initial boundaries and `target` are correct
                left = current + 1n;
            }
            current = (left + right) >> 1n; // calculating the new "middle" point index after updating the bounds
        } while (true);
    }
    static createNewTimepoint(last, blockTimestamp, tick, prevTick, liquidity, averageTick, volumePerLiquidity) {
        const delta = blockTimestamp - last.blockTimestamp;
        let newLast = {};
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
    static _volatilityOnRange(dt, tick0, tick1, avgTick0, avgTick1) {
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
    static getAverages(timepoints, time, tick, index, liquidity) {
        let oldestIndex = 0n;
        let oldest = DataStorageOperator.getTimepoint(timepoints, 0n);
        const nextIndex = (index + 1n) % 2n ** 16n; // considering overflow
        if ((DataStorageOperator.getTimepoint(timepoints, nextIndex)).initialized) {
            oldest = DataStorageOperator.getTimepoint(timepoints, nextIndex);
            oldestIndex = nextIndex;
        }
        const endOfWindow = DataStorageOperator._getSingleTimepoint(timepoints, time, 0n, tick, index, oldestIndex, liquidity);
        console.log('endOfWindow');
        console.log(endOfWindow);
        const oldestTimestamp = oldest.blockTimestamp;
        if (DataStorageOperator.lteConsideringOverflow(oldestTimestamp, time - WINDOW, time)) {
            const startOfWindow = DataStorageOperator._getSingleTimepoint(timepoints, time, WINDOW, tick, index, oldestIndex, liquidity);
            console.log('startOfWindow');
            console.log(startOfWindow);
            return [
                (endOfWindow.volatilityCumulative - startOfWindow.volatilityCumulative) / WINDOW,
                (endOfWindow.volumePerLiquidityCumulative - startOfWindow.volumePerLiquidityCumulative) >> 57n,
            ];
        }
        else if (time != oldestTimestamp) {
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
    static getFee(feeConfig, timepoints, _time, _tick, _index, _liquidity) {
        console.log('_time');
        console.log(_time);
        console.log('_tick');
        console.log(_tick);
        console.log('_index');
        console.log(_index);
        console.log('_liquidity');
        console.log(_liquidity);
        const [volatilityAverage, volumePerLiqAverage] = DataStorageOperator.getAverages(timepoints, _time, _tick, _index, _liquidity);
        console.log('volatilityAverage');
        console.log(volatilityAverage);
        console.log('volumePerLiqAverage');
        console.log(volumePerLiqAverage);
        return adaptiveFee_1.AdaptiveFee.getFee(volatilityAverage / 15n, volumePerLiqAverage, feeConfig);
    }
}
exports.DataStorageOperator = DataStorageOperator;
//# sourceMappingURL=dataStorageOperator.js.map