"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Pool = void 0;
const tickTable_1 = require("./tickTable");
const tickMath_1 = require("./tickMath");
const priceMovementMath_1 = require("./priceMovementMath");
const constants_1 = require("./constants");
const FullMath_1 = require("./FullMath");
const tickManager_1 = require("./tickManager");
const liquidityMath_1 = require("./liquidityMath");
const dataStorageOperator_1 = require("./dataStorageOperator");
class Pool {
    constructor(poolAddress, storage) {
        if (storage != undefined) {
            this.storage = storage;
        }
        else {
            this.storage.tickTable = {};
            this.storage.ticks = {};
            this.storage.timepoints = new Array(Number(constants_1.Constants.UINT16_MODULO));
            this.storage.feeConfig = {};
        }
        this.poolAddress = poolAddress;
    }
    getTick(index) {
        let tick = this.storage.ticks[Number(index)];
        if (tick == undefined) {
            return {
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
    getTickFromTickTable(index) {
        const tick = this.storage.tickTable[Number(index)];
        if (tick == undefined) {
            return 0n;
        }
        return tick;
    }
    calculateSwap(zeroToOne, amountRequired, limitSqrtPrice) {
        let result = {
            amount0: 0n,
            amount1: 0n,
            currentPrice: 0n,
            currentTick: 0n,
            currentLiquidity: 0n,
            communityFeeAmount: 0n,
        };
        const globalState = this.storage.globalState;
        let cache = {
            communityFee: 0n, // The community fee of the selling token, to : minimize casts
            volumePerLiquidityInBlock: 0n,
            tickCumulative: 0n, // The global tickCumulative at the moment
            secondsPerLiquidityCumulative: 0n, // The global secondPerLiquidity at the moment
            computedLatestTimepoint: false, //  if we have already fetched _tickCumulative_ and _secondPerLiquidity_ from the DataOperator
            amountRequiredInitial: 0n, // The initial value of the exact input\output amount
            amountCalculated: 0n, // The additive amount of total output\input calculated trough the swap
            totalFeeGrowth: 0n, // The initial totalFeeGrowth + the fee growth during a swap
            totalFeeGrowthB: 0n,
            incentiveStatus: 0, // If there is an active incentive at the moment
            exactInput: false, // Whether the exact input or output is specified
            fee: 0n, // The current dynamic fee
            startTick: 0n, // The tick at the start of a swap
            timepointIndex: 0n, // The index of last written timepoint
        };
        result.currentLiquidity = this.storage.liquidity;
        cache.fee = globalState.fee;
        cache.timepointIndex = globalState.timepointIndex;
        cache.volumePerLiquidityInBlock = this.storage.volumePerLiquidityInBlock;
        cache.amountRequiredInitial = amountRequired;
        cache.exactInput = amountRequired > 0n;
        if (zeroToOne) {
            cache.totalFeeGrowth = this.storage.totalFeeGrowth0Token;
            cache.communityFee = globalState.communityFeeToken0;
        }
        else {
            cache.totalFeeGrowth = this.storage.totalFeeGrowth1Token;
            cache.communityFee = globalState.communityFeeToken1;
        }
        result.currentPrice = globalState.price;
        result.currentTick = globalState.tick;
        cache.startTick = result.currentTick;
        //TODO add blockTimestamp if needed
        const blockTimestamp = this.timestamp;
        let activeIncentive = this.storage.activeIncentive;
        // if (activeIncentive != ZeroAddress) {
        //   const status = IAlgebraVirtualPool(activeIncentive).increaseCumulative(blockTimestamp);
        //   if (status == Status.NOT_EXIST) {
        //     activeIncentive = ZeroAddress;
        //   } else if (status == Status.ACTIVE) {
        //     cache.incentiveStatus = Status.ACTIVE;
        //   } else if (status == Status.NOT_STARTED) {
        //     cache.incentiveStatus = Status.NOT_STARTED;
        //   }
        // }
        console.log('dataStorageOperator.write params');
        console.log('cache.timepointIndex');
        console.log(cache.timepointIndex);
        console.log('BigInt(blockTimestamp)');
        console.log(BigInt(blockTimestamp));
        console.log('cache.startTick');
        console.log(cache.startTick);
        console.log('result.currentLiquidity');
        console.log(result.currentLiquidity);
        console.log('cache.volumePerLiquidityInBlock');
        console.log(cache.volumePerLiquidityInBlock);
        const newTimepointIndex = dataStorageOperator_1.DataStorageOperator.write(this.storage.timepoints, cache.timepointIndex, BigInt(blockTimestamp), cache.startTick, result.currentLiquidity, cache.volumePerLiquidityInBlock);
        console.log('newTimepointIndex');
        console.log(newTimepointIndex);
        // new timepoint appears only for first swap in block
        if (newTimepointIndex != cache.timepointIndex) {
            cache.timepointIndex = newTimepointIndex;
            cache.volumePerLiquidityInBlock = 0n;
            cache.fee = dataStorageOperator_1.DataStorageOperator.getFee(this.storage.feeConfig, this.storage.timepoints, BigInt(blockTimestamp), result.currentTick, newTimepointIndex, result.currentLiquidity);
            // cache.fee = 100n
            console.log('cache.fee');
            console.log(cache.fee);
        }
        let step = {};
        while (true) {
            console.log('WHILE ITERATION');
            step.stepSqrtPrice = globalState.price;
            [step.nextTick, step.initialized] = tickTable_1.TickTable.nextTickInTheSameRow(this.storage.tickTable, result.currentTick, zeroToOne);
            step.nextTickPrice = tickMath_1.TickMath.getSqrtRatioAtTick(step.nextTick);
            console.log('step.nextTick');
            console.log(step.nextTick);
            console.log('step.nextTickPrice');
            console.log(step.nextTickPrice);
            console.log('movePriceTowardsTarget params');
            console.log('zeroToOne');
            console.log(zeroToOne);
            console.log('currentPrice');
            console.log(result.currentPrice);
            console.log('nextTickPrice');
            console.log(zeroToOne == step.nextTickPrice < limitSqrtPrice // move the price to the target or to the limit
                ? limitSqrtPrice
                : step.nextTickPrice);
            console.log('currentLiquidity');
            console.log(result.currentLiquidity);
            console.log('amountRequired');
            console.log(amountRequired);
            console.log('cache.fee');
            console.log(cache.fee);
            ({
                resultPrice: result.currentPrice,
                input: step.input,
                output: step.output,
                feeAmount: step.feeAmount,
            } = priceMovementMath_1.PriceMovementMath.movePriceTowardsTarget(zeroToOne, globalState.price, zeroToOne == step.nextTickPrice < limitSqrtPrice // move the price to the target or to the limit
                ? limitSqrtPrice
                : step.nextTickPrice, result.currentLiquidity, amountRequired, cache.fee));
            console.log('movePriceTowardsTarget result');
            console.log('result.currentPrice');
            console.log(result.currentPrice);
            console.log('step.input');
            console.log(step.input);
            console.log('step.output');
            console.log(step.output);
            console.log('step.feeAmount');
            console.log(step.feeAmount);
            // console.log(result.currentPrice, step.input, step.output, step.feeAmount)
            if (cache.exactInput) {
                amountRequired -= step.input + step.feeAmount; // decrease remaining input amount
                cache.amountCalculated -= step.output; // decrease calculated output amount
            }
            else {
                amountRequired += step.output; // increase remaining output amount (since its negative)
                cache.amountCalculated += step.input + step.feeAmount; // increase calculated input amount
            }
            console.log('amountRequired');
            console.log(amountRequired);
            console.log('step.input');
            console.log(step.input);
            console.log('step.output');
            console.log(step.output);
            console.log('step.feeAmount');
            console.log(step.feeAmount);
            if (cache.communityFee > 0) {
                const delta = (step.feeAmount * cache.communityFee) / constants_1.Constants.COMMUNITY_FEE_DENOMINATOR;
                step.feeAmount -= delta;
                result.communityFeeAmount += delta;
            }
            console.log('step.feeAmount');
            console.log(step.feeAmount);
            console.log('result.communityFeeAmount');
            console.log(result.communityFeeAmount);
            if (result.currentLiquidity > 0)
                cache.totalFeeGrowth += FullMath_1.FullMath.mulDiv(step.feeAmount, constants_1.Constants.Q128, result.currentLiquidity);
            console.log('result.currentLiquidity');
            console.log(result.currentLiquidity);
            console.log('result.currentPrice');
            console.log(result.currentPrice);
            console.log('step.nextTickPrice');
            console.log(step.nextTickPrice);
            if (result.currentPrice == step.nextTickPrice) {
                console.log('inside if result.currentPrice == step.nextTickPrice');
                // if the reached tick is initialized then we need to cross it
                if (step.initialized) {
                    console.log('inside step.initialized');
                    // once at a swap we have to get the last timepoint of the observation
                    if (!cache.computedLatestTimepoint) {
                        console.log('inside !cache.computedLatestTimepoint');
                        ({
                            tickCumulative: cache.tickCumulative,
                            secondsPerLiquidityCumulative: cache.secondsPerLiquidityCumulative,
                        } = dataStorageOperator_1.DataStorageOperator.getSingleTimepoint(this.storage.timepoints, BigInt(blockTimestamp), 0n, cache.startTick, cache.timepointIndex, result.currentLiquidity // currentLiquidity can be changed only after computedLatestTimepoint
                        ));
                        cache.computedLatestTimepoint = true;
                        cache.totalFeeGrowthB = zeroToOne
                            ? this.storage.totalFeeGrowth1Token
                            : this.storage.totalFeeGrowth0Token;
                    }
                    // every tick cross is needed to be duplicated in a virtual pool
                    // if (cache.incentiveStatus != 0) {
                    //   IAlgebraVirtualPool(activeIncentive).cross(step.nextTick, zeroToOne);
                    // }
                    let liquidityDelta;
                    if (zeroToOne) {
                        liquidityDelta = -tickManager_1.TickManager.cross(this.storage.ticks, step.nextTick, cache.totalFeeGrowth, // A == 0
                        cache.totalFeeGrowthB, // B == 1
                        cache.secondsPerLiquidityCumulative, cache.tickCumulative, BigInt(blockTimestamp));
                    }
                    else {
                        liquidityDelta = tickManager_1.TickManager.cross(this.storage.ticks, step.nextTick, cache.totalFeeGrowthB, // B == 0
                        cache.totalFeeGrowth, // A == 1
                        cache.secondsPerLiquidityCumulative, cache.tickCumulative, BigInt(blockTimestamp));
                    }
                    result.currentLiquidity = liquidityMath_1.LiquidityMath.addDelta(result.currentLiquidity, liquidityDelta);
                }
                result.currentTick = zeroToOne ? step.nextTick - 1n : step.nextTick;
            }
            else if (result.currentPrice != step.stepSqrtPrice) {
                // if the price has changed but hasn't reached the target
                result.currentTick = tickMath_1.TickMath.getTickAtSqrtRatio(result.currentPrice);
                break; // since the price hasn't reached the target, amountRequired should be 0
            }
            // check stop condition
            if (amountRequired == 0n || result.currentPrice == limitSqrtPrice) {
                break;
            }
        }
        [result.amount0, result.amount1] =
            zeroToOne == cache.exactInput // the amount to provide could be less then initially specified (e.g. reached limit)
                ? [cache.amountRequiredInitial - amountRequired, cache.amountCalculated] // the amount to get could be less then initially specified (e.g. reached limit)
                : [cache.amountCalculated, cache.amountRequiredInitial - amountRequired];
        [globalState.price, globalState.tick, globalState.fee, globalState.timepointIndex] = [
            result.currentPrice,
            result.currentTick,
            cache.fee,
            cache.timepointIndex,
        ];
        return result;
        // Writing liquidity to current state
        // [liquidity, volumePerLiquidityInBlock] = [
        //   result.currentLiquidity,
        //   cache.volumePerLiquidityInBlock + IDataStorageOperator(dataStorageOperator).calculateVolumePerLiquidity(currentLiquidity, amount0, amount1)
        // ];
        // if (zeroToOne) {
        //   totalFeeGrowth0Token = cache.totalFeeGrowth;
        // } else {
        //   totalFeeGrowth1Token = cache.totalFeeGrowth;
        // }
    }
    updatePositionTicksAndFees(owner, bottomTick, topTick, liquidityDelta) {
        const globalState = this.storage.globalState;
        const cache = {
            price: globalState.price,
            tick: globalState.tick,
            timepointIndex: globalState.timepointIndex,
        };
        // position = getOrCreatePosition(owner, bottomTick, topTick);
        const _totalFeeGrowth0Token = this.storage.totalFeeGrowth0Token;
        const _totalFeeGrowth1Token = this.storage.totalFeeGrowth1Token;
        let toggledBottom;
        let toggledTop;
        const liquidity = this.storage.liquidity;
        if (liquidityDelta != 0n) {
            const time = this.timestamp;
            const { tickCumulative, secondsPerLiquidityCumulative } = dataStorageOperator_1.DataStorageOperator.getSingleTimepoint(this.storage.timepoints, BigInt(time), 0n, cache.tick, cache.timepointIndex, liquidity);
            if (tickManager_1.TickManager.update(this.storage.ticks, bottomTick, cache.tick, liquidityDelta, _totalFeeGrowth0Token, _totalFeeGrowth1Token, secondsPerLiquidityCumulative, tickCumulative, BigInt(time), false // isTopTick
            )) {
                toggledBottom = true;
                tickTable_1.TickTable.toggleTick(this.storage.tickTable, bottomTick);
            }
            if (tickManager_1.TickManager.update(this.storage.ticks, topTick, cache.tick, liquidityDelta, _totalFeeGrowth0Token, _totalFeeGrowth1Token, secondsPerLiquidityCumulative, tickCumulative, BigInt(time), true // isTopTick
            )) {
                toggledTop = true;
                tickTable_1.TickTable.toggleTick(this.storage.tickTable, topTick);
            }
        }
        const [feeGrowthInside0X128, feeGrowthInside1X128] = tickManager_1.TickManager.getInnerFeeGrowth(this.storage.ticks, bottomTick, topTick, cache.tick, _totalFeeGrowth0Token, _totalFeeGrowth1Token);
        // _recalculatePosition(position, liquidityDelta, feeGrowthInside0X128, feeGrowthInside1X128);
        if (liquidityDelta != 0n) {
            // if liquidityDelta is negative and the tick was toggled, it means that it should not be initialized anymore, so we delete it
            if (liquidityDelta < 0) {
                if (toggledBottom)
                    delete this.storage.ticks[Number(bottomTick)];
                if (toggledTop)
                    delete this.storage.ticks[Number(topTick)];
            }
            let globalLiquidityDelta = 0n;
            if (cache.tick >= bottomTick && cache.tick < topTick) {
                globalLiquidityDelta = liquidityDelta;
            }
            // (amount0, amount1, globalLiquidityDelta) = _getAmountsForLiquidity(
            // 	bottomTick,
            // 	topTick,
            // 	liquidityDelta,
            // 	cache.tick,
            // 	cache.price
            // );
            if (globalLiquidityDelta != 0n) {
                const liquidityBefore = liquidity;
                const newTimepointIndex = dataStorageOperator_1.DataStorageOperator.write(this.storage.timepoints, cache.timepointIndex, BigInt(this.timestamp), cache.tick, liquidityBefore, this.storage.volumePerLiquidityInBlock);
                if (cache.timepointIndex != newTimepointIndex) {
                    globalState.fee = dataStorageOperator_1.DataStorageOperator.getFee(this.storage.feeConfig, this.storage.timepoints, BigInt(this.timestamp), cache.tick, newTimepointIndex, liquidityBefore);
                    globalState.timepointIndex = newTimepointIndex;
                    this.storage.volumePerLiquidityInBlock = 0n;
                }
                this.storage.liquidity = liquidityMath_1.LiquidityMath.addDelta(liquidityBefore, liquidityDelta);
            }
        }
    }
    Initialize(timestamp, eventParams) {
        this.timestamp = timestamp;
        // Pool initialization
        this.storage.globalState.price = eventParams.price;
        this.storage.globalState.tick = eventParams.tick;
        this.storage.globalState.unlocked = true;
        // dataStorageOperator initialization
        this.storage.timepoints[0].initialized = true;
        this.storage.timepoints[0].blockTimestamp = BigInt(this.timestamp);
        this.storage.timepoints[0].averageTick = eventParams.tick;
    }
    Burn(timestamp, eventParams) {
        this.timestamp = timestamp;
        this.updatePositionTicksAndFees(eventParams.owner, eventParams.bottomTick, eventParams.topTick, -eventParams.liquidityAmount);
    }
    Mint(timestamp, eventParams) {
        this.timestamp = timestamp;
        this.updatePositionTicksAndFees(eventParams.owner, eventParams.bottomTick, eventParams.topTick, eventParams.liquidityAmount);
    }
}
exports.Pool = Pool;
//# sourceMappingURL=model.js.map