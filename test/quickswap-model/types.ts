export interface GlobalState {
	price: bigint;
	tick: bigint;
	fee: bigint;
	timepointIndex: bigint;
	communityFeeToken0: bigint;
	communityFeeToken1: bigint;
	unlocked: boolean;
}

export interface PriceMovementCache {
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

export interface SwapCalculationCache {
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

export interface Tick {
  liquidityTotal: bigint; // the total position liquidity that references this tick
  liquidityDelta: bigint; // amount of net liquidity added (subtracted) when tick is crossed left-right (right-left),
  // fee growth per unit of liquidity on the _other_ side of this tick (relative to the current tick)
  // only has relative meaning, not absolute — the value depends on when the tick is initialized
  outerFeeGrowth0Token: bigint;
  outerFeeGrowth1Token: bigint;
  outerTickCumulative: bigint; // the cumulative tick value on the other side of the tick
  outerSecondsPerLiquidity: bigint; // the seconds per unit of liquidity on the _other_ side of current tick, (relative meaning)
  outerSecondsSpent: bigint; // the seconds spent on the other side of the current tick, only has relative meaning
  initialized: boolean; // these 8 bits are set to prevent fresh sstores when crossing newly initialized ticks
}

export interface Timepoint {
	initialized: boolean; // whether or not the timepoint is initialized
	blockTimestamp: bigint; // the block timestamp of th: biginte
	tickCumulative: bigint; // the tick accumulator, i.e. tick * time elapsed since the pool was first initialized
	secondsPerLiquidityCumulative: bigint; // the seconds per liquidity since the pool was first initialized
	volatilityCumulative: bigint; // the volatility accumulator; overflow after ~34800 years is desired :)
	averageTick: bigint; // average tick at this blockTimestamp
	volumePerLiquidityCumulative: bigint; // the gmean(volumes)/liquidity accumulator
}

export interface FeeConfig {
	alpha1: bigint;
	alpha2: bigint;
	beta1: bigint;
	beta2: bigint;
	gamma1: bigint;
	gamma2: bigint;
	volumeBeta: bigint;
	volumeGamma: bigint;
	baseFee: bigint;
}

export interface Storage {
  token0: string;
  token1: string;
  globalState: GlobalState;
  liquidity: bigint;
  totalFeeGrowth0Token: bigint
  totalFeeGrowth1Token: bigint
	volumePerLiquidityInBlock: bigint
	liquidityCooldown: bigint,
  activeIncentive: string;
  tickSpacing: number;
  ticks: Partial<{[n: number]: Tick}>;
  tickTable: Partial<{[n: number]: bigint}>;
  timepoints: Timepoint[];
  feeConfig: FeeConfig
}

export interface InitializeEvent {
	price: bigint;
	tick: bigint;
}

export interface SwapEvent {
	sender: string;
	recipient: string;
	amount0: bigint;
	amount1: bigint;
	price: bigint;
	liquidity: bigint;
	tick: bigint;
}

export interface MintEvent {
	sender: string;
	owner: string;
	bottomTick: bigint;
	topTick: bigint;
	liquidityAmount: bigint;
	amount0: bigint;
	amount1: bigint;
}

export interface BurnEvent {
	owner: string;
	bottomTick: bigint;
	topTick: bigint;
	liquidityAmount: bigint;
	amount0: bigint;
	amount1: bigint;
}
