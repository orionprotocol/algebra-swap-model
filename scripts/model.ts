import { ethers } from "hardhat";
import { AlgebraPool, PoolState } from "../typechain";
import { TickTable } from "./tickTable";
import { TickMath } from "./tickMath";
import { PriceMovementMath } from "./priceMovementMath";
import { Constants } from "./constants";
import { FullMath } from "./FullMath";
import { TickManager } from "./tickManager";
import { ZeroAddress } from "ethers";
import { LiquidityMath } from "./liquidityMath";
import { DataStorageOperator } from "./dataStorageOperator";

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
  NOT_STARTED
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

class Pool {
  tickTable: TickTable
  ticks: TickManager
  dataStorageOperator: DataStorageOperator

  constructor(tickSpacing: bigint, minTick: bigint, maxTick: bigint) {
    this.tickTable = new TickTable(tickSpacing, minTick, maxTick)
    this.ticks = new TickManager()
    this.dataStorageOperator = new DataStorageOperator()
  }

  async getGlobalState(): Promise<GlobalState> {
    const pool = <AlgebraPool>await ethers.getContract("AlgebraPool")
    return pool.globalState()
  }

  async getCurrentLiquidity() {
    const pool = <AlgebraPool>await ethers.getContract("AlgebraPool")
    return pool.liquidity()
  }

  async getActiveIncentive() {
    const pool = <AlgebraPool>await ethers.getContract("AlgebraPool")
    return pool.activeIncentive()
  }

  async getTotalFeeGrowth0Token() {
    const pool = <AlgebraPool>await ethers.getContract("AlgebraPool")
    return pool.totalFeeGrowth0Token()
  }

  async getTotalFeeGrowth1Token() {
    const pool = <AlgebraPool>await ethers.getContract("AlgebraPool")
    return pool.totalFeeGrowth1Token()
  }

  // field isn't public change later to get slot
  async getVolumePerLiquidityInBlock() {
    const pool = <AlgebraPool>await ethers.getContract("AlgebraPool")
    return pool.volumePerLiquidityInBlock()
  }

  async calculateSwap(
    zeroToOne: boolean,
    amountRequired: bigint,
    limitSqrtPrice: bigint
  ) {
    let result = {
      amount0: 0n,
      amount1: 0n,
      currentPrice: 0n,
      currentTick: 0n,
      currentLiquidity: 0n,
      communityFeeAmount: 0n
    }
    const globalState = await this.getGlobalState()
    let cache = {} as SwapCalculationCache
    result.currentLiquidity = await this.getCurrentLiquidity();

    cache.fee = globalState.fee
    cache.timepointIndex = globalState.timepointIndex
    cache.volumePerLiquidityInBlock = await this.getVolumePerLiquidityInBlock();
    cache.amountRequiredInitial = amountRequired
    cache.exactInput = amountRequired > 0n

    if (zeroToOne) {
      cache.totalFeeGrowth = await this.getTotalFeeGrowth0Token()
      cache.communityFee = globalState.communityFeeToken0
    } else {
      cache.totalFeeGrowth = await this.getTotalFeeGrowth1Token()
      cache.communityFee = globalState.communityFeeToken1
    }
    let currentPrice = globalState.price;
    let currentTick = globalState.tick;
    cache.startTick = currentTick

    //TODO add blockTimestamp if needed
    const blockTimestamp = 0n
    let activeIncentive = await this.getActiveIncentive()

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

    const newTimepointIndex = await this.dataStorageOperator.write(
      cache.timepointIndex,
      blockTimestamp,
      cache.startTick,
      result.currentLiquidity,
      cache.volumePerLiquidityInBlock
    );

    // new timepoint appears only for first swap in block
    if (newTimepointIndex != cache.timepointIndex) {
      cache.timepointIndex = newTimepointIndex;
      cache.volumePerLiquidityInBlock = 0n;
      cache.fee = await this.dataStorageOperator.getFee(blockTimestamp, currentTick, newTimepointIndex, result.currentLiquidity);
    }

    let step = {} as PriceMovementCache
    while (true) {
      step.stepSqrtPrice = globalState.price;
      [step.nextTick, step.initialized] = this.tickTable.nextTickInTheSameRow(currentTick, zeroToOne)

      step.nextTickPrice = TickMath.getSqrtRatioAtTick(step.nextTick);

      ({
        resultPrice: currentPrice,
        input: step.input,
        output: step.output,
        feeAmount: step.feeAmount
      } = PriceMovementMath.movePriceTowardsTarget(
        zeroToOne,
        globalState.price,
        (zeroToOne == (step.nextTickPrice < limitSqrtPrice)) // move the price to the target or to the limit
          ? limitSqrtPrice
          : step.nextTickPrice,
        result.currentLiquidity,
        amountRequired,
        cache.fee
      ))

      if (cache.exactInput) {
        amountRequired -= (step.input + step.feeAmount); // decrease remaining input amount
        cache.amountCalculated = -step.output; // decrease calculated output amount
      } else {
        amountRequired += step.output; // increase remaining output amount (since its negative)
        cache.amountCalculated = step.input + step.feeAmount; // increase calculated input amount
      }

      if (cache.communityFee > 0) {
        const delta = step.feeAmount * cache.communityFee / Constants.COMMUNITY_FEE_DENOMINATOR;
        step.feeAmount -= delta;
        result.communityFeeAmount += delta;
      }
      if (result.currentLiquidity > 0) cache.totalFeeGrowth += FullMath.mulDiv(step.feeAmount, Constants.Q128, result.currentLiquidity);

      if (currentPrice == step.nextTickPrice) {
        // if the reached tick is initialized then we need to cross it
        if (step.initialized) {
          // once at a swap we have to get the last timepoint of the observation
          if (!cache.computedLatestTimepoint) {
            ({tickCumulative: cache.tickCumulative, secondsPerLiquidityCumulative: cache.secondsPerLiquidityCumulative} = await this.dataStorageOperator.getSingleTimepoint(
              blockTimestamp,
              0n,
              cache.startTick,
              cache.timepointIndex,
              result.currentLiquidity // currentLiquidity can be changed only after computedLatestTimepoint
            ));
            cache.computedLatestTimepoint = true;
            cache.totalFeeGrowthB = zeroToOne ? await this.getTotalFeeGrowth1Token() : await this.getTotalFeeGrowth0Token();
          }
          // every tick cross is needed to be duplicated in a virtual pool
          // if (cache.incentiveStatus != Status.NOT_EXIST) {
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
              blockTimestamp
            );
          } else {
            liquidityDelta = this.ticks.cross(
              step.nextTick,
              cache.totalFeeGrowthB, // B == 0
              cache.totalFeeGrowth, // A == 1
              cache.secondsPerLiquidityCumulative,
              cache.tickCumulative,
              blockTimestamp
            );
          }

          result.currentLiquidity = LiquidityMath.addDelta(result.currentLiquidity, liquidityDelta);
        }

        currentTick = zeroToOne ? step.nextTick - 1n : step.nextTick;
      } else if (currentPrice != step.stepSqrtPrice) {
        // if the price has changed but hasn't reached the target
        currentTick = TickMath.getTickAtSqrtRatio(currentPrice);
        break; // since the price hasn't reached the target, amountRequired should be 0
      }

      // check stop condition
      if (amountRequired == 0n || currentPrice == limitSqrtPrice) {
        break;
      }
    }

    [result.amount0, result.amount1] = zeroToOne == cache.exactInput // the amount to provide could be less then initially specified (e.g. reached limit)
      ? [cache.amountRequiredInitial - amountRequired, cache.amountCalculated] // the amount to get could be less then initially specified (e.g. reached limit)
      : [cache.amountCalculated, cache.amountRequiredInitial - amountRequired];

    [globalState.price, globalState.tick, globalState.fee, globalState.timepointIndex] = [currentPrice, currentTick, cache.fee, cache.timepointIndex];

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
}