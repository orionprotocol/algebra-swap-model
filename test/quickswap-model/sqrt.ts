
export class Sqrt {
  /// @notice Gets the square root of the absolute value of the parameter
  static sqrtAbs(_x: bigint) {
    // get abs value
		let result: bigint;
    const mask = _x >> (256n - 1n);
    const x = (_x ^ mask) - mask;
    if (x == 0n) result = 0n;
    else {
      let xx = x;
      let r = 1n;
      if (xx >= 0x100000000000000000000000000000000n) {
        xx >>= 128n;
        r <<= 64n;
      }
      if (xx >= 0x10000000000000000n) {
        xx >>= 64n;
        r <<= 32n;
      }
      if (xx >= 0x100000000n) {
        xx >>= 32n;
        r <<= 16n;
      }
      if (xx >= 0x10000n) {
        xx >>= 16n;
        r <<= 8n;
      }
      if (xx >= 0x100n) {
        xx >>= 8n;
        r <<= 4n;
      }
      if (xx >= 0x10n) {
        xx >>= 4n;
        r <<= 2n;
      }
      if (xx >= 0x8n) {
        r <<= 1n;
      }
      r = (r + x / r) >> 1n;
      r = (r + x / r) >> 1n;
      r = (r + x / r) >> 1n;
      r = (r + x / r) >> 1n;
      r = (r + x / r) >> 1n;
      r = (r + x / r) >> 1n;
      r = (r + x / r) >> 1n; // @dev Seven iterations should be enough.
      const r1 = x / r;
      result = r < r1 ? r : r1;
    }
		return result
  }
}
