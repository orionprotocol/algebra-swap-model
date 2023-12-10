import {BigNumberish, MaxUint256} from 'ethers';
import {Constants} from './constants';
import {MAX_TICK, MIN_TICK} from './tickMath';

export class TickTable {
	static tickSpacing: bigint = Constants.TICK_SPACING;
	static minTick: bigint = MIN_TICK;
	static maxTick: bigint = MAX_TICK;

	static getTick(tickTable: Partial<{[n: number]: bigint}>, index: BigNumberish) {
		const tick = tickTable[Number(index)]
		if (tick == undefined) {
			return 0n;
		}
		return tick;
	}

	static toggleTick(tickTable: Partial<{[n: number]: bigint}>, tick: bigint) {
		if (tick % Constants.TICK_SPACING != 0n) {
			// ensure that the tick is spaced
			throw 'tick is not spaced';
		}
		tick /= Constants.TICK_SPACING; // compress tick
		let bitNumber = tick & 0xffn;
		let rowNumber = tick >> 8n;
		tickTable[Number(rowNumber)] = TickTable.getTick(tickTable, rowNumber);
		tickTable[Number(rowNumber)] ^= 1n << bitNumber;
		//console.log("=============================================");
		//console.log("toggleTick");
		//console.log("tick");
		//console.log(tick);
		//console.log("bitNumber");
		//console.log(bitNumber);
		//console.log("rowNumber");
		//console.log(rowNumber);
		//console.log("tickTable[Number(rowNumber)]");
		//console.log(tickTable[Number(rowNumber)]);
		//console.log("=============================================");
	}

	private static getMostSignificantBit(word: bigint) {
		word = word | (word >> 1n);
		word = word | (word >> 2n);
		word = word | (word >> 4n);
		word = word | (word >> 8n);
		word = word | (word >> 16n);
		word = word | (word >> 32n);
		word = word | (word >> 64n);
		word = word | (word >> 128n);
		word = word - (word >> 1n);
		return TickTable.getSingleSignificantBit(word);
	}

	private static getSingleSignificantBit(word: bigint) {
		const isZero = (word: bigint) => {
			return word == 0n ? 1n : 0n;
		};
		let singleBitPos = isZero(word & 0x5555555555555555555555555555555555555555555555555555555555555555n);
		singleBitPos =
			singleBitPos | (isZero(word & 0x00000000000000000000000000000000ffffffffffffffffffffffffffffffffn) << 7n);
		singleBitPos =
			singleBitPos | (isZero(word & 0x0000000000000000ffffffffffffffff0000000000000000ffffffffffffffffn) << 6n);
		singleBitPos =
			singleBitPos | (isZero(word & 0x00000000ffffffff00000000ffffffff00000000ffffffff00000000ffffffffn) << 5n);
		singleBitPos =
			singleBitPos | (isZero(word & 0x0000ffff0000ffff0000ffff0000ffff0000ffff0000ffff0000ffff0000ffffn) << 4n);
		singleBitPos =
			singleBitPos | (isZero(word & 0x00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ffn) << 3n);
		singleBitPos =
			singleBitPos | (isZero(word & 0x0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0fn) << 2n);
		singleBitPos =
			singleBitPos | (isZero(word & 0x3333333333333333333333333333333333333333333333333333333333333333n) << 1n);
		return singleBitPos;
	}

	private static uncompressAndBoundTick(tick: bigint) {
		const boundedTick = tick * this.tickSpacing;
		if (boundedTick < this.minTick) {
			return this.minTick;
		} else if (boundedTick > this.maxTick) {
			return this.maxTick;
		}
		return boundedTick;
	}

	static nextTickInTheSameRow(tickTable: Partial<{[n: number]: bigint}>, tick: bigint, lte: boolean) {
		// compress and round towards negative infinity if negative
		if (tick < 0 && tick % this.tickSpacing !== 0n) {
			tick = tick / TickTable.tickSpacing - 1n;
		} else {
			tick = tick / TickTable.tickSpacing;
		}
		if (lte) {
			const bitNumber = tick & 0xffn;
			const rowNumber = tick >> 8n;
			const _row = ((TickTable.getTick(tickTable, rowNumber)) << (255n - bitNumber)) % (MaxUint256 + 1n);
			//console.log("==========================================");
			//console.log("nextTickInTheSameRow");
			//console.log("lte");
			//console.log(lte);
			//console.log("bitNumber");
			//console.log(bitNumber);
			//console.log("rowNumber");
			//console.log(rowNumber);
			//console.log("tick at row number");
			//console.log(TickTable.getTick(tickTable, rowNumber));
			//console.log("_row");
			//console.log(_row);
			//console.log("tick in params");
			//console.log(tick);
			if (_row != 0n) {
				tick -= 255n - TickTable.getMostSignificantBit(_row);
				//console.log("prereturn tick")
				//console.log(tick)
				//console.log("uncompressAndBoundTick")
				//console.log(this.uncompressAndBoundTick(tick))
				//console.log("==========================================");
				return [this.uncompressAndBoundTick(tick), true] as const;
			} else {
				tick -= bitNumber;
				//console.log("prereturn tick")
				//console.log(tick)
				//console.log("uncompressAndBoundTick")
				//console.log(this.uncompressAndBoundTick(tick))
				//console.log("==========================================");
				return [this.uncompressAndBoundTick(tick), false] as const;
			}
		} else {
			// start from the word of the next tick, since the current tick state doesn't matter
			tick += 1n;
			const bitNumber = tick & 0xffn;
			const rowNumber = tick >> 8n;
			const _row = (TickTable.getTick(tickTable, rowNumber)) >> bitNumber;
			//console.log("==========================================");
			//console.log("nextTickInTheSameRow");
			//console.log("lte");
			//console.log(lte);
			//console.log("bitNumber");
			//console.log(bitNumber);
			//console.log("rowNumber");
			//console.log(rowNumber);
			//console.log("tick at row number");
			//console.log(TickTable.getTick(tickTable, rowNumber));
			//console.log("_row");
			//console.log(_row);
			//console.log("tick in params");
			//console.log(tick);
			if (_row != 0n) {
				tick += TickTable.getSingleSignificantBit((-_row) & _row); // least significant bit
				//console.log("prereturn tick")
				//console.log(tick)
				//console.log("uncompressAndBoundTick")
				//console.log(this.uncompressAndBoundTick(tick))
				//console.log("==========================================");
				return [this.uncompressAndBoundTick(tick), true] as const;
			} else {
				tick += 255n - bitNumber;
				//console.log("prereturn tick")
				//console.log(tick)
				//console.log("uncompressAndBoundTick")
				//console.log(this.uncompressAndBoundTick(tick))
				//console.log("==========================================");
				return [this.uncompressAndBoundTick(tick), false] as const;
			}
		}
	}
}
