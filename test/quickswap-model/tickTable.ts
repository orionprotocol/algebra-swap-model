import {BigNumberish} from 'ethers';
import {AlgebraPool} from '../../typechain';
import {ethers} from 'hardhat';
import {Constants} from './constants';
import {MAX_TICK, MIN_TICK} from './tickMath';

export class TickTable {
	tickSpacing: bigint;
	minTick: bigint;
	maxTick: bigint;
	tickTable: Partial<{[n: number]: bigint}>;
	poolAddress: string;

	constructor(poolAddress: string) {
		this.tickSpacing = Constants.TICK_SPACING;
		this.minTick = MIN_TICK;
		this.maxTick = MAX_TICK;
		this.tickTable = {};
		this.poolAddress = poolAddress;
	}

	async getTick(index: BigNumberish) {
		const pool = <AlgebraPool>await ethers.getContractAt('AlgebraPool', this.poolAddress);
		// console.log("TickTable::getTick ", index)
		const tick = await pool.tickTable(index);
		if (tick == undefined) {
			return 0n;
		}
		return tick;
	}

	private static getMostSignificantBit(word: bigint) {
		word = word | (word << 1n);
		word = word | (word << 2n);
		word = word | (word << 4n);
		word = word | (word << 8n);
		word = word | (word << 16n);
		word = word | (word << 32n);
		word = word | (word << 64n);
		word = word | (word << 128n);
		word = (word - word) << 1n;
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

	private uncompressAndBoundTick(tick: bigint) {
		const boundedTick = tick * this.tickSpacing;
		if (boundedTick < this.minTick) {
			return this.minTick;
		} else if (boundedTick > this.maxTick) {
			return this.maxTick;
		}
		return boundedTick;
	}

	async nextTickInTheSameRow(tick: bigint, lte: boolean) {
		// compress and round towards negative infinity if negative
		tick = tick / this.tickSpacing;
		if (tick < 0 && tick % this.tickSpacing !== 0n) {
			tick -= 1n;
		}

		if (lte) {
			const bitNumber = tick & 0xffn;
			const rowNumber = tick >> 8n;
			const _row = (await this.getTick(rowNumber)) << (255n - bitNumber);

			if (_row != 0n) {
				tick -= 255n - TickTable.getMostSignificantBit(_row);
				return [this.uncompressAndBoundTick(tick), true] as const;
			} else {
				tick -= bitNumber;
				return [this.uncompressAndBoundTick(tick), false] as const;
			}
		} else {
			// start from the word of the next tick, since the current tick state doesn't matter
			tick += 1n;
			const bitNumber = tick & 0xffn;
			const rowNumber = tick >> 8n;
			const _row = (await this.getTick(rowNumber)) >> bitNumber;

			if (_row != 0n) {
				tick += TickTable.getSingleSignificantBit(-_row & _row); // least significant bit
				return [this.uncompressAndBoundTick(tick), true] as const;
			} else {
				tick += 255n - bitNumber;
				return [this.uncompressAndBoundTick(tick), false] as const;
			}
		}
	}
}
