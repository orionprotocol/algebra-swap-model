import { BigNumberish } from "ethers";

interface Tick {
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

export class TickManager {
  ticks: Partial<{ [n: number]: Tick }>

  constructor() {
    this.ticks = {}
  }

  getTick(index: BigNumberish) {
    const tick = this.ticks[Number(index)]
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
      }

    }
    return tick
  }

  cross(
    tick: bigint,
    totalFeeGrowth0Token: bigint,
    totalFeeGrowth1Token: bigint,
    secondsPerLiquidityCumulative: bigint,
    tickCumulative: bigint,
    time: bigint
  ) {
    const data = this.getTick(tick)

    data.outerSecondsSpent = time - data.outerSecondsSpent;
    data.outerSecondsPerLiquidity = secondsPerLiquidityCumulative - data.outerSecondsPerLiquidity;
    data.outerTickCumulative = tickCumulative - data.outerTickCumulative;

    data.outerFeeGrowth1Token = totalFeeGrowth1Token - data.outerFeeGrowth1Token;
    data.outerFeeGrowth0Token = totalFeeGrowth0Token - data.outerFeeGrowth0Token;

    return data.liquidityDelta;
  }
}