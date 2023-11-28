import {ethers, time} from 'hardhat';
import {AlgebraPool} from '../../typechain';
import {TickTable} from './tickTable';
import {TickMath} from './tickMath';
import {PriceMovementMath} from './priceMovementMath';
import {Constants} from './constants';
import {FullMath} from './FullMath';
import {TickManager} from './tickManager';
import {LiquidityMath} from './liquidityMath';
import {DataStorageOperator} from './dataStorageOperator';
import {BurnEvent, InitializeEvent, MintEvent} from '../../typechain/contracts/AlgebraPool';

interface GlobalState {
	price: bigint;
	tick: bigint;
	fee: bigint;
	timepointIndex: bigint;
	communityFeeToken0: bigint;
	communityFeeToken1: bigint;
	unlocked: boolean;
}

interface PriceMovementCache {
	stepSqrtPrice: bigint; // The Q64.96 sqrt of the price at the start of the step
	nextTick: bigint; // The tick till the current step goes
	initialized: boolean; // True if the _nextTick is initialized
	nextTickPrice: bigint; // The Q64.96 sqrt of the price calculated from the _nextTick
	input: bigint; // The additive amount of tokens that have been provided
	output: bigint; // The additive amount of token that have been withdrawn
	feeAmount: bigint; // The total amount of fee earned within a current step
}

enum Status {
	NOT_EXIST,
	ACTIVE,
	NOT_STARTED,
}

interface SwapCalculationCache {
	communityFee: bigint; // The community fee of the selling token, to : minimize casts
	volumePerLiquidityInBlock: bigint;
	tickCumulative: bigint; // The global tickCumulative at the moment
	secondsPerLiquidityCumulative: bigint; // The global secondPerLiquidity at the moment
	computedLatestTimepoint: boolean; //  if we have already fetched _tickCumulative_ and _secondPerLiquidity_ from the DataOperator
	amountRequiredInitial: bigint; // The initial value of the exact input\output amount
	amountCalculated: bigint; // The additive amount of total output\input calculated trough the swap
	totalFeeGrowth: bigint; // The initial totalFeeGrowth + the fee growth during a swap
	totalFeeGrowthB: bigint;
	incentiveStatus: Status; // If there is an active incentive at the moment
	exactInput: boolean; // Whether the exact input or output is specified
	fee: bigint; // The current dynamic fee
	startTick: bigint; // The tick at the start of a swap
	timepointIndex: bigint; // The index of last written timepoint
}

export class Pool {
	tickTable: TickTable;
	ticks: TickManager;
	dataStorageOperator: DataStorageOperator;
	poolAddress: string;

	// pool storage
	globalState: GlobalState;
	liquidity: bigint;
	volumePerLiquidityInBlock: bigint;
	totalFeeGrowth0Token: bigint;
	totalFeeGrowth1Token: bigint;
	timestamp: bigint;

	constructor(poolAddress: string) {
		this.tickTable = new TickTable(poolAddress);
		this.ticks = new TickManager(poolAddress);
		this.dataStorageOperator = new DataStorageOperator(poolAddress);
		this.poolAddress = poolAddress;
		this.timestamp;
	}

	async getTimestamp() {
		return time.getTime();
	}

	async getLiquidity() {
		const pool = <AlgebraPool>await ethers.getContractAt('AlgebraPool', this.poolAddress);
		return pool.liquidity();
	}

	async getGlobalState() {
		const pool = <AlgebraPool>await ethers.getContractAt('AlgebraPool', this.poolAddress);
		return ((await pool.globalState()) as any).toObject() as GlobalState;
	}

	async getCurrentLiquidity() {
		const pool = <AlgebraPool>await ethers.getContractAt('AlgebraPool', this.poolAddress);
		return pool.liquidity();
	}

	async getActiveIncentive() {
		const pool = <AlgebraPool>await ethers.getContractAt('AlgebraPool', this.poolAddress);
		return pool.activeIncentive();
	}

	async getTotalFeeGrowth0Token() {
		const pool = <AlgebraPool>await ethers.getContractAt('AlgebraPool', this.poolAddress);
		return pool.totalFeeGrowth0Token();
	}

	async getTotalFeeGrowth1Token() {
		const pool = <AlgebraPool>await ethers.getContractAt('AlgebraPool', this.poolAddress);
		return pool.totalFeeGrowth1Token();
	}

	// field isn't public change later to get slot
	async getVolumePerLiquidityInBlock() {
		const pool = <AlgebraPool>await ethers.getContractAt('AlgebraPool', this.poolAddress);
		return pool.volumePerLiquidityInBlock();
	}

	async calculateSwap(zeroToOne: boolean, amountRequired: bigint, limitSqrtPrice: bigint) {
		let result = {
			amount0: 0n,
			amount1: 0n,
			currentPrice: 0n,
			currentTick: 0n,
			currentLiquidity: 0n,
			communityFeeAmount: 0n,
		};
		const globalState = await this.getGlobalState();
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
		result.currentLiquidity = await this.getCurrentLiquidity();

		cache.fee = globalState.fee;
		cache.timepointIndex = globalState.timepointIndex;
		cache.volumePerLiquidityInBlock = await this.getVolumePerLiquidityInBlock();
		cache.amountRequiredInitial = amountRequired;
		cache.exactInput = amountRequired > 0n;

		if (zeroToOne) {
			cache.totalFeeGrowth = await this.getTotalFeeGrowth0Token();
			cache.communityFee = globalState.communityFeeToken0;
		} else {
			cache.totalFeeGrowth = await this.getTotalFeeGrowth1Token();
			cache.communityFee = globalState.communityFeeToken1;
		}
		result.currentPrice = globalState.price;
		result.currentTick = globalState.tick;
		cache.startTick = result.currentTick;

		//TODO add blockTimestamp if needed
		const blockTimestamp = await time.getTime();
		let activeIncentive = await this.getActiveIncentive();

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

		const newTimepointIndex = await this.dataStorageOperator.write(
			cache.timepointIndex,
			BigInt(blockTimestamp),
			cache.startTick,
			result.currentLiquidity,
			cache.volumePerLiquidityInBlock
		);
		console.log('newTimepointIndex');
		console.log(newTimepointIndex);
		// new timepoint appears only for first swap in block
		if (newTimepointIndex != cache.timepointIndex) {
			cache.timepointIndex = newTimepointIndex;
			cache.volumePerLiquidityInBlock = 0n;
			cache.fee = await this.dataStorageOperator.getFee(
				BigInt(blockTimestamp),
				result.currentTick,
				newTimepointIndex,
				result.currentLiquidity
			);
			// cache.fee = 100n
			console.log('cache.fee');
			console.log(cache.fee);
		}
		let step = {} as PriceMovementCache;
		while (true) {
			console.log('WHILE ITERATION');
			step.stepSqrtPrice = globalState.price;
			[step.nextTick, step.initialized] = await this.tickTable.nextTickInTheSameRow(
				result.currentTick,
				zeroToOne
			);
			step.nextTickPrice = TickMath.getSqrtRatioAtTick(step.nextTick);
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
			console.log(
				zeroToOne == step.nextTickPrice < limitSqrtPrice // move the price to the target or to the limit
					? limitSqrtPrice
					: step.nextTickPrice
			);
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
			} = PriceMovementMath.movePriceTowardsTarget(
				zeroToOne,
				globalState.price,
				zeroToOne == step.nextTickPrice < limitSqrtPrice // move the price to the target or to the limit
					? limitSqrtPrice
					: step.nextTickPrice,
				result.currentLiquidity,
				amountRequired,
				cache.fee
			));
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
			} else {
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
				const delta = (step.feeAmount * cache.communityFee) / Constants.COMMUNITY_FEE_DENOMINATOR;
				step.feeAmount -= delta;
				result.communityFeeAmount += delta;
			}
			console.log('step.feeAmount');
			console.log(step.feeAmount);
			console.log('result.communityFeeAmount');
			console.log(result.communityFeeAmount);

			if (result.currentLiquidity > 0)
				cache.totalFeeGrowth += FullMath.mulDiv(step.feeAmount, Constants.Q128, result.currentLiquidity);

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
						} = await this.dataStorageOperator.getSingleTimepoint(
							BigInt(blockTimestamp),
							0n,
							cache.startTick,
							cache.timepointIndex,
							result.currentLiquidity // currentLiquidity can be changed only after computedLatestTimepoint
						));
						cache.computedLatestTimepoint = true;
						cache.totalFeeGrowthB = zeroToOne
							? await this.getTotalFeeGrowth1Token()
							: await this.getTotalFeeGrowth0Token();
					}
					// every tick cross is needed to be duplicated in a virtual pool
					// if (cache.incentiveStatus != 0) {
					//   IAlgebraVirtualPool(activeIncentive).cross(step.nextTick, zeroToOne);
					// }

					let liquidityDelta;
					if (zeroToOne) {
						liquidityDelta = -this.ticks.cross(
							step.nextTick,
							cache.totalFeeGrowth, // A == 0
							cache.totalFeeGrowthB, // B == 1
							cache.secondsPerLiquidityCumulative,
							cache.tickCumulative,
							BigInt(blockTimestamp)
						);
					} else {
						liquidityDelta = this.ticks.cross(
							step.nextTick,
							cache.totalFeeGrowthB, // B == 0
							cache.totalFeeGrowth, // A == 1
							cache.secondsPerLiquidityCumulative,
							cache.tickCumulative,
							BigInt(blockTimestamp)
						);
					}

					result.currentLiquidity = LiquidityMath.addDelta(result.currentLiquidity, liquidityDelta);
				}

				result.currentTick = zeroToOne ? step.nextTick - 1n : step.nextTick;
			} else if (result.currentPrice != step.stepSqrtPrice) {
				// if the price has changed but hasn't reached the target
				result.currentTick = TickMath.getTickAtSqrtRatio(result.currentPrice);
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

	async updatePositionTicksAndFees(owner: string, bottomTick: bigint, topTick: bigint, liquidityDelta: bigint) {
		const globalState = await this.getGlobalState();
		const cache = {
			price: globalState.price,
			tick: globalState.tick,
			timepointIndex: globalState.timepointIndex,
		};

		// position = getOrCreatePosition(owner, bottomTick, topTick);

		const _totalFeeGrowth0Token = await this.getTotalFeeGrowth0Token();
		const _totalFeeGrowth1Token = await this.getTotalFeeGrowth1Token();

		let toggledBottom: boolean;
		let toggledTop: boolean;
		const liquidity = await this.getLiquidity();
		if (liquidityDelta != 0n) {
			const time = await this.getTimestamp();
			const {tickCumulative, secondsPerLiquidityCumulative} = await this.dataStorageOperator.getSingleTimepoint(
				BigInt(time),
				0n,
				cache.tick,
				cache.timepointIndex,
				liquidity
			);

			if (
				this.ticks.update(
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
				this.tickTable.toggleTick(bottomTick);
			}

			if (
				this.ticks.update(
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
				this.tickTable.toggleTick(topTick);
			}
		}

		const [feeGrowthInside0X128, feeGrowthInside1X128] = this.ticks.getInnerFeeGrowth(
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
				if (toggledBottom) delete this.ticks.ticks[Number(bottomTick)];
				if (toggledTop) delete this.ticks.ticks[Number(topTick)];
			}

			let globalLiquidityDelta;
			// (amount0, amount1, globalLiquidityDelta) = _getAmountsForLiquidity(
			// 	bottomTick,
			// 	topTick,
			// 	liquidityDelta,
			// 	cache.tick,
			// 	cache.price
			// );
			if (globalLiquidityDelta != 0) {
				const liquidityBefore = liquidity;
				const newTimepointIndex = await this.dataStorageOperator.write(
					cache.timepointIndex,
					BigInt(await this.getTimestamp()),
					cache.tick,
					liquidityBefore,
					await this.getVolumePerLiquidityInBlock()
				);
				if (cache.timepointIndex != newTimepointIndex) {
					globalState.fee = await this.dataStorageOperator.getFee(
						BigInt(await this.getTimestamp()),
						cache.tick,
						newTimepointIndex,
						liquidityBefore
					);
					globalState.timepointIndex = newTimepointIndex;
					this.volumePerLiquidityInBlock = 0n;
				}
				this.liquidity = LiquidityMath.addDelta(liquidityBefore, liquidityDelta);
			}
		}
	}
	async Initialize(timestamp: number, eventParams: InitializeEvent.OutputObject) {
		this.globalState.price = eventParams.price;
		this.globalState.tick = eventParams.tick;
		this.globalState.unlocked = true;

		this.token0 = this.dataStorageOperator.initialize(BigInt(timestamp), eventParams.tick);
	}

	async Burn(timestamp: number, eventParams: BurnEvent.OutputObject) {
		this.updatePositionTicksAndFees(
			eventParams.owner,
			eventParams.bottomTick,
			eventParams.topTick,
			-eventParams.liquidityAmount
		);
	}

	async Mint(timestamp: number, eventParams: MintEvent.OutputObject) {
		this.updatePositionTicksAndFees(
			eventParams.owner,
			eventParams.bottomTick,
			eventParams.topTick,
			eventParams.liquidityAmount
		);
	}
}
