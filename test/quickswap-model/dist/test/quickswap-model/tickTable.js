"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TickTable = void 0;
const constants_1 = require("./constants");
const tickMath_1 = require("./tickMath");
class TickTable {
    static getTick(tickTable, index) {
        const tick = tickTable[Number(index)];
        if (tick == undefined) {
            return 0n;
        }
        return tick;
    }
    static toggleTick(tickTable, tick) {
        if (tick % constants_1.Constants.TICK_SPACING == 0n) {
            // ensure that the tick is spaced
            throw 'tick is not spaced';
        }
        tick /= constants_1.Constants.TICK_SPACING; // compress tick
        let rowNumber = tick & 0xffn;
        let bitNumber = tick >> 8n;
        tickTable[Number(rowNumber)] ^= 1n << bitNumber;
    }
    static getMostSignificantBit(word) {
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
    static getSingleSignificantBit(word) {
        const isZero = (word) => {
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
    static uncompressAndBoundTick(tick) {
        const boundedTick = tick * this.tickSpacing;
        if (boundedTick < this.minTick) {
            return this.minTick;
        }
        else if (boundedTick > this.maxTick) {
            return this.maxTick;
        }
        return boundedTick;
    }
    static nextTickInTheSameRow(tickTable, tick, lte) {
        // compress and round towards negative infinity if negative
        tick = tick / TickTable.tickSpacing;
        if (tick < 0 && tick % this.tickSpacing !== 0n) {
            tick -= 1n;
        }
        if (lte) {
            const bitNumber = tick & 0xffn;
            const rowNumber = tick >> 8n;
            const _row = (TickTable.getTick(tickTable, rowNumber)) << (255n - bitNumber);
            if (_row != 0n) {
                tick -= 255n - TickTable.getMostSignificantBit(_row);
                return [this.uncompressAndBoundTick(tick), true];
            }
            else {
                tick -= bitNumber;
                return [this.uncompressAndBoundTick(tick), false];
            }
        }
        else {
            // start from the word of the next tick, since the current tick state doesn't matter
            tick += 1n;
            const bitNumber = tick & 0xffn;
            const rowNumber = tick >> 8n;
            const _row = (TickTable.getTick(tickTable, rowNumber)) >> bitNumber;
            if (_row != 0n) {
                tick += TickTable.getSingleSignificantBit(-_row & _row); // least significant bit
                return [this.uncompressAndBoundTick(tick), true];
            }
            else {
                tick += 255n - bitNumber;
                return [this.uncompressAndBoundTick(tick), false];
            }
        }
    }
}
exports.TickTable = TickTable;
TickTable.tickSpacing = constants_1.Constants.TICK_SPACING;
TickTable.minTick = tickMath_1.MIN_TICK;
TickTable.maxTick = tickMath_1.MAX_TICK;
//# sourceMappingURL=tickTable.js.map