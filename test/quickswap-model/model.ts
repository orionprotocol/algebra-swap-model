import { TickTable } from "./tickTable";
import { MAX_SQRT_RATIO, MIN_SQRT_RATIO, TickMath } from "./tickMath";
import { PriceMovementMath } from "./priceMovementMath";
import { Constants } from "./constants";
import { FullMath } from "./FullMath";
import { TickManager } from "./tickManager";
import { LiquidityMath } from "./liquidityMath";
import { DataStorageOperator } from "./dataStorageOperator";
import { BigNumberish } from "ethers";
import {
	SwapCalculationCache,
	PriceMovementCache,
	Storage,
	Timepoint,
	InitializeEvent,
	MintEvent,
	BurnEvent,
	FeeConfig,
	SwapEvent,
} from "./types";

export class AlgebraV1Pool {
	poolAddress: string;
	storage: Storage = {
		token0: "0x",
		token1: "0x",
		globalState: {
			price: 0n,
			tick: 0n,
			fee: Constants.BASE_FEE,
			timepointIndex: 0n,
			communityFeeToken0: 0n,
			communityFeeToken1: 0n,
			unlocked: false,
		},
		liquidity: 0n,
		totalFeeGrowth0Token: 0n,
		totalFeeGrowth1Token: 0n,
		volumePerLiquidityInBlock: 0n,
		liquidityCooldown: 0n,
		activeIncentive: "",
		tickSpacing: Number(Constants.TICK_SPACING),
		ticks: {},
		tickTable: {},
		timepoints: new Array<Timepoint>(Number(Constants.UINT16_MODULO)),
		feeConfig: {
			alpha1: 2900n,
			alpha2: 12000n,
			beta1: 360n,
			beta2: 60000n,
			gamma1: 59n,
			gamma2: 8500n,
			volumeBeta: 0n,
			volumeGamma: 10n,
			baseFee: 100n,
		},
	};
	timestamp: number;
	blockNumber: number;

	constructor(storage: Storage) {
		for (const key in this.storage) {
			if (storage[key] !== undefined && storage[key] !== null) {
				this.storage[key] = storage[key]
			}
		}
		this.poolAddress = "0x"; //poolAddress;
	}

	getTick(index: BigNumberish) {
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

	getTickFromTickTable(index: BigNumberish) {
		const tick = this.storage.tickTable[Number(index)];
		if (tick == undefined) {
			return 0n;
		}
		return tick;
	}

	getTimepoint(index: BigNumberish) {
		index = BigInt(index) % 2n ** 16n;
		let timepoint = this.storage.timepoints[Number(index)];
		if (timepoint === undefined || timepoint == null) {
			timepoint = {
				initialized: false,
				blockTimestamp: 0n, // the block timestamp of th: biginte
				tickCumulative: 0n, // the tick accumulator, i.e. tick * time elapsed since the pool was first initialized
				secondsPerLiquidityCumulative: 0n, // the seconds per liquidity since the pool was first initialized
				volatilityCumulative: 0n, // the volatility accumulator, overflow after ~34800 years is desired :)
				averageTick: 0n, // average tick at this blockTimestamp
				volumePerLiquidityCumulative: 0n, // the gmean(volumes)/liquidity accumulator
			}
		}
		return timepoint;
	}

	calculateSwap(zeroToOne: boolean, amountRequired: bigint, limitSqrtPrice: bigint) {
		let result = {
			amount0: 0n,
			amount1: 0n,
			currentPrice: 0n,
			currentTick: 0n,
			currentLiquidity: 0n,
			communityFeeAmount: 0n,
		};
		const globalState = this.storage.globalState;
		let cache: SwapCalculationCache = {
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
		} else {
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


		const newTimepointIndex = DataStorageOperator.write(
			this.storage.timepoints,
			cache.timepointIndex,
			BigInt(blockTimestamp),
			cache.startTick,
			result.currentLiquidity,
			cache.volumePerLiquidityInBlock
		);
		// new timepoint appears only for first swap in block
		if (newTimepointIndex != cache.timepointIndex) {
			cache.timepointIndex = newTimepointIndex;
			cache.volumePerLiquidityInBlock = 0n;
			cache.fee = DataStorageOperator.getFee(
				this.storage.feeConfig,
				this.storage.timepoints,
				BigInt(blockTimestamp),
				result.currentTick,
				newTimepointIndex,
				result.currentLiquidity
			);
			// cache.fee = 100n
		}
		let step = {} as PriceMovementCache;
		while (true) {
			// //console.log("WHILE ITERATION");
			step.stepSqrtPrice = result.currentPrice;
			[step.nextTick, step.initialized] = TickTable.nextTickInTheSameRow(
				this.storage.tickTable,
				result.currentTick,
				zeroToOne
			);
			step.nextTickPrice = TickMath.getSqrtRatioAtTick(step.nextTick);
			//console.log("===============================================");
			//console.log("step.nextTick");
			//console.log(step.nextTick);
			//console.log("step.initialized");
			//console.log(step.initialized);
			//console.log("step.nextTickPrice")
			//console.log(step.nextTickPrice)
			//console.log("===============================================");

			({
				resultPrice: result.currentPrice,
				input: step.input,
				output: step.output,
				feeAmount: step.feeAmount,
			} = PriceMovementMath.movePriceTowardsTarget(
				zeroToOne,
				result.currentPrice,
				zeroToOne == step.nextTickPrice < limitSqrtPrice // move the price to the target or to the limit
					? limitSqrtPrice
					: step.nextTickPrice,
				result.currentLiquidity,
				amountRequired,
				cache.fee
			));
			//console.log("===============================================");
			//console.log("result movePriceTowardsTarget");
			//console.log("result.currentPrice")
			//console.log(result.currentPrice)
			//console.log("step.input");
			//console.log(step.input);
			//console.log("step.output");
			//console.log(step.output);
			//console.log("step.feeAmount");
			//console.log(step.feeAmount);
			//console.log("===============================================");

			if (cache.exactInput) {
				amountRequired -= step.input + step.feeAmount; // decrease remaining input amount
				cache.amountCalculated -= step.output; // decrease calculated output amount
			} else {
				amountRequired += step.output; // increase remaining output amount (since its negative)
				cache.amountCalculated += step.input + step.feeAmount; // increase calculated input amount
			}
			//console.log("amountRequired");
			//console.log(amountRequired);
			//console.log("deduct from amountRequired");
			//console.log(step.input + step.feeAmount);
			if (cache.communityFee > 0) {
				const delta = (step.feeAmount * cache.communityFee) / Constants.COMMUNITY_FEE_DENOMINATOR;
				step.feeAmount -= delta;
				result.communityFeeAmount += delta;
			}

			if (result.currentLiquidity > 0)
				cache.totalFeeGrowth += FullMath.mulDiv(step.feeAmount, Constants.Q128, result.currentLiquidity);

			//console.log("========================================================");
			//console.log("Model currentPrice");
			//console.log(result.currentPrice);
			//console.log("Model nextTickPrice");
			//console.log(step.nextTickPrice);
			//console.log(this.timestamp);
			//console.log("========================================================");
			if (result.currentPrice == step.nextTickPrice) {
				// if the reached tick is initialized then we need to cross it
				if (step.initialized) {
					// once at a swap we have to get the last timepoint of the observation
					if (!cache.computedLatestTimepoint) {
						({
							tickCumulative: cache.tickCumulative,
							secondsPerLiquidityCumulative: cache.secondsPerLiquidityCumulative,
						} = DataStorageOperator.getSingleTimepoint(
							this.storage.timepoints,
							BigInt(blockTimestamp),
							0n,
							cache.startTick,
							cache.timepointIndex,
							result.currentLiquidity // currentLiquidity can be changed only after computedLatestTimepoint
						));
						cache.computedLatestTimepoint = true;
						cache.totalFeeGrowthB = zeroToOne ? this.storage.totalFeeGrowth1Token : this.storage.totalFeeGrowth0Token;
					}
					// every tick cross is needed to be duplicated in a virtual pool
					// if (cache.incentiveStatus != 0) {
					//   IAlgebraVirtualPool(activeIncentive).cross(step.nextTick, zeroToOne);
					// }

					let liquidityDelta: bigint;
					if (zeroToOne) {
						liquidityDelta = -TickManager.cross(
							this.storage.ticks,
							step.nextTick,
							cache.totalFeeGrowth, // A == 0
							cache.totalFeeGrowthB, // B == 1
							cache.secondsPerLiquidityCumulative,
							cache.tickCumulative,
							BigInt(blockTimestamp)
						);
					} else {
						liquidityDelta = TickManager.cross(
							this.storage.ticks,
							step.nextTick,
							cache.totalFeeGrowthB, // B == 0
							cache.totalFeeGrowth, // A == 1
							cache.secondsPerLiquidityCumulative,
							cache.tickCumulative,
							BigInt(blockTimestamp)
						);
					}

					//console.log("========================================================");
					//console.log("Contract liquidityDelta");
					//console.log(liquidityDelta);
					//console.log("========================================================");
					result.currentLiquidity = LiquidityMath.addDelta(result.currentLiquidity, liquidityDelta);
				}

				result.currentTick = zeroToOne ? step.nextTick - 1n : step.nextTick;
			} else if (result.currentPrice != step.stepSqrtPrice) {
				// if the price has changed but hasn't reached the target
				result.currentTick = TickMath.getTickAtSqrtRatio(result.currentPrice);
				break; // since the price hasn't reached the target, amountRequired should be 0
			}
			//console.log("========================================================");
			//console.log("amountRequired");
			//console.log(amountRequired);
			//console.log("result.currentPrice");
			//console.log(result.currentPrice);
			//console.log("limitSqrtPrice");
			//console.log(limitSqrtPrice);
			//console.log("========================================================");
			// check stop condition
			if (amountRequired == 0n || result.currentPrice == limitSqrtPrice) {
				break;
			}
		}

		[result.amount0, result.amount1] =
			zeroToOne == cache.exactInput // the amount to provide could be less then initially specified (e.g. reached limit)
				? [cache.amountRequiredInitial - amountRequired, cache.amountCalculated] // the amount to get could be less then initially specified (e.g. reached limit)
				: [cache.amountCalculated, cache.amountRequiredInitial - amountRequired];


		[this.storage.globalState.price, this.storage.globalState.tick, this.storage.globalState.fee, this.storage.globalState.timepointIndex] = [
			result.currentPrice,
			result.currentTick,
			cache.fee,
			cache.timepointIndex,
		];


		[this.storage.liquidity, this.storage.volumePerLiquidityInBlock] = [
			result.currentLiquidity,
			cache.volumePerLiquidityInBlock + DataStorageOperator.calculateVolumePerLiquidity(result.currentLiquidity, result.amount0, result.amount1)
		];

		if (zeroToOne) {
			this.storage.totalFeeGrowth0Token = cache.totalFeeGrowth;
		} else {
			this.storage.totalFeeGrowth1Token = cache.totalFeeGrowth;
		}
		return result;
	}

	updatePositionTicksAndFees(owner: string, bottomTick: bigint, topTick: bigint, liquidityDelta: bigint) {
		const globalState = this.storage.globalState;
		const cache = {
			price: globalState.price,
			tick: globalState.tick,
			timepointIndex: globalState.timepointIndex,
		};

		// position = getOrCreatePosition(owner, bottomTick, topTick);

		const _totalFeeGrowth0Token = this.storage.totalFeeGrowth0Token;
		const _totalFeeGrowth1Token = this.storage.totalFeeGrowth1Token;

		let toggledBottom: boolean;
		let toggledTop: boolean;
		const liquidity = this.storage.liquidity;
		if (liquidityDelta != 0n) {
			const time = this.timestamp;
			const { tickCumulative, secondsPerLiquidityCumulative } = DataStorageOperator.getSingleTimepoint(
				this.storage.timepoints,
				BigInt(time),
				0n,
				cache.tick,
				cache.timepointIndex,
				liquidity
			);

			if (
				TickManager.update(
					this.storage.ticks,
					bottomTick,
					cache.tick,
					liquidityDelta,
					_totalFeeGrowth0Token,
					_totalFeeGrowth1Token,
					secondsPerLiquidityCumulative,
					tickCumulative,
					BigInt(time),
					false // isTopTick
				)
			) {
				toggledBottom = true;
				TickTable.toggleTick(this.storage.tickTable, bottomTick);
			}

			if (
				TickManager.update(
					this.storage.ticks,
					topTick,
					cache.tick,
					liquidityDelta,
					_totalFeeGrowth0Token,
					_totalFeeGrowth1Token,
					secondsPerLiquidityCumulative,
					tickCumulative,
					BigInt(time),
					true // isTopTick
				)
			) {
				toggledTop = true;
				TickTable.toggleTick(this.storage.tickTable, topTick);
			}
		}

		const [feeGrowthInside0X128, feeGrowthInside1X128] = TickManager.getInnerFeeGrowth(
			this.storage.ticks,
			bottomTick,
			topTick,
			cache.tick,
			_totalFeeGrowth0Token,
			_totalFeeGrowth1Token
		);

		// _recalculatePosition(position, liquidityDelta, feeGrowthInside0X128, feeGrowthInside1X128);

		if (liquidityDelta != 0n) {
			// if liquidityDelta is negative and the tick was toggled, it means that it should not be initialized anymore, so we delete it
			if (liquidityDelta < 0) {
				if (toggledBottom) delete this.storage.ticks[Number(bottomTick)];
				if (toggledTop) delete this.storage.ticks[Number(topTick)];
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
				const newTimepointIndex = DataStorageOperator.write(
					this.storage.timepoints,
					cache.timepointIndex,
					BigInt(this.timestamp),
					cache.tick,
					liquidityBefore,
					this.storage.volumePerLiquidityInBlock
				);
				if (cache.timepointIndex != newTimepointIndex) {
					globalState.fee = DataStorageOperator.getFee(
						this.storage.feeConfig,
						this.storage.timepoints,
						BigInt(this.timestamp),
						cache.tick,
						newTimepointIndex,
						liquidityBefore
					);
					globalState.timepointIndex = newTimepointIndex;
					this.storage.volumePerLiquidityInBlock = 0n;
				}
				this.storage.liquidity = LiquidityMath.addDelta(liquidityBefore, liquidityDelta);
			}
		}
	}

	initializeEventCallback(timestamp: number, eventParams: InitializeEvent) {
		this.timestamp = timestamp;
		// Pool initialization
		this.storage.globalState.price = eventParams.price;
		this.storage.globalState.tick = eventParams.tick;
		this.storage.globalState.unlocked = true;

		// dataStorageOperator initialization
		this.storage.timepoints[0] = {
			initialized: true,
			blockTimestamp: BigInt(this.timestamp),
			averageTick: eventParams.tick,
			tickCumulative: 0n,
			secondsPerLiquidityCumulative: 0n,
			volatilityCumulative: 0n,
			volumePerLiquidityCumulative: 0n,
		};
	}

	swapEventCallback(timestamp: number, eventParams: SwapEvent) {
		this.timestamp = timestamp

		const zeroToOne = eventParams.amount1 < 0n
		const amountRequired = zeroToOne ? eventParams.amount0 : eventParams.amount1
		const sqrtLimitPrice = !zeroToOne ? MAX_SQRT_RATIO - 1n : MIN_SQRT_RATIO + 1n

		this.calculateSwap(zeroToOne, amountRequired, sqrtLimitPrice)
		this.storage.globalState.tick = eventParams.tick;
		this.storage.globalState.price = eventParams.price;
	}

	burnEventCallback(timestamp: number, eventParams: BurnEvent) {
		this.timestamp = timestamp;
		this.updatePositionTicksAndFees(
			eventParams.owner,
			eventParams.bottomTick,
			eventParams.topTick,
			-eventParams.liquidityAmount
		);
	}

	mintEventCallback(timestamp: number, eventParams: MintEvent) {
		this.timestamp = timestamp;
		this.updatePositionTicksAndFees(
			eventParams.owner,
			eventParams.bottomTick,
			eventParams.topTick,
			eventParams.liquidityAmount
		);
	}
}
