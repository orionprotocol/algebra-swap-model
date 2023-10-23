import { BigNumberish } from "ethers";

function sqrt(value: BigNumberish) {
  value = BigInt(value);
  let z = (value + 1n) / 2n;
  let y = value;
  while (z - y < 0n) {
    y = z;
    z = (value / z + z) / 2n;
  }
  return y;
}
// returns the sqrt price as a 64x96
export function encodePriceSqrt(reserve1: BigNumberish, reserve0: BigNumberish): bigint {
  return sqrt(BigInt(reserve1) * 2n ** 192n / BigInt(reserve0))
}