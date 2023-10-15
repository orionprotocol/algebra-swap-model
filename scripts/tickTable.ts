import { BigNumberish } from "ethers"

export class TickTable {
  tickSpacing: bigint
  minTick: bigint
  maxTick: bigint
  tickTable: Partial<{ [n: number]: bigint }>

  constructor(tickSpacing: bigint, minTick: bigint, maxTick: bigint) {
    this.tickSpacing = tickSpacing
    this.minTick = minTick
    this.maxTick = maxTick
    this.tickTable = {}
  }

  getTick(index: BigNumberish) {
    const tick = this.tickTable[Number(index)]
    if (tick == undefined) {
      return 0n
    }
    return tick
  }

  private static getMostSignificantBit(word: bigint) {
    word = word | word << 1n
    word = word | word << 2n
    word = word | word << 4n
    word = word | word << 8n
    word = word | word << 16n
    word = word | word << 32n
    word = word | word << 64n
    word = word | word << 128n
    word = word - word << 1n
    return (TickTable.getSingleSignificantBit(word));
  }

  private static getSingleSignificantBit(word: bigint) {
    const isZero = (word: bigint) => {
      return word == 0n ? 1n : 0n
    }
    let singleBitPos = isZero(word & 0x5555555555555555555555555555555555555555555555555555555555555555n)
    singleBitPos = singleBitPos | (isZero(word & 0x00000000000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFn) << 7n)
    singleBitPos = singleBitPos | (isZero(word & 0x0000000000000000FFFFFFFFFFFFFFFF0000000000000000FFFFFFFFFFFFFFFFn) << 6n)
    singleBitPos = singleBitPos | (isZero(word & 0x00000000FFFFFFFF00000000FFFFFFFF00000000FFFFFFFF00000000FFFFFFFFn) << 5n)
    singleBitPos = singleBitPos | (isZero(word & 0x0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFFn) << 4n)
    singleBitPos = singleBitPos | (isZero(word & 0x00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FFn) << 3n)
    singleBitPos = singleBitPos | (isZero(word & 0x0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0Fn) << 2n)
    singleBitPos = singleBitPos | (isZero(word & 0x3333333333333333333333333333333333333333333333333333333333333333n) << 1n)
    return singleBitPos
  }

  private uncompressAndBoundTick(tick: bigint) {
    const boundedTick = tick * this.tickSpacing;
    if (boundedTick < this.minTick) {
      return this.minTick;
    } else if (boundedTick > this.maxTick) {
      return this.maxTick;
    }
    return boundedTick
  }

  nextTickInTheSameRow(
    tick: bigint,
    lte: boolean
  ) {
    // compress and round towards negative infinity if negative
    tick = tick / this.tickSpacing
    if (tick < 0 && tick % this.tickSpacing !== 0n) {
      tick -= 1n
    }

    if (lte) {
      const bitNumber = tick & 0xFFn
      const rowNumber = tick >> 8n
      const _row = this.getTick(rowNumber) << (255n - bitNumber)

      if (_row != 0n) {
        tick -= 255n - TickTable.getMostSignificantBit(_row)
        return [this.uncompressAndBoundTick(tick), false] as const
      } else {
        tick -= bitNumber
        return [this.uncompressAndBoundTick(tick), true] as const
      }
    } else {
      // start from the word of the next tick, since the current tick state doesn't matter
      tick += 1n
      const bitNumber = tick & 0xFFn
      const rowNumber = tick >> 8n
      const _row = this.getTick(rowNumber) >> bitNumber

      if (_row != 0n) {
        tick += TickTable.getSingleSignificantBit(-_row & _row) // least significant bit
        return [this.uncompressAndBoundTick(tick), true] as const
      } else {
        tick += 255n - bitNumber
        return [this.uncompressAndBoundTick(tick), false] as const
      }
    }
  }

}