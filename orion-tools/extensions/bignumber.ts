// import { BigNumber } from 'ethers'

// declare module 'ethers' {
//   interface BigNumber {
//     formatString(decimals?: number, precision?: number): string
//     formatNumber(decimals?: number, precision?: number): number
//     almostEqual(other: BigNumber, base?: number, acc?: number): boolean
//   }
// }

// BigNumber.prototype.almostEqual = function (other: BigNumber, base = 18, precision = 5): boolean {
//   const eps = BigNumber.from(10).pow(base - precision)

//   if (other.eq(0))
//     return this.abs().lt(eps);

//   const bnBase = BigNumber.from(10).pow(base);
//   const res = this.mul(bnBase).div(other).sub(bnBase).abs();
//   return (res.lt(eps));
// }

// BigNumber.prototype.formatString = function (
//   decimals = 18,
//   precision = decimals,
//   delimiter = '.'
// ) {
//   let str = this.toString()
//   str = str.padStart(decimals + 1, '0')

//   const intPart = str.slice(0, -decimals).replace(/^0+/, '')
//   const fracPart = str.slice(-decimals).padEnd(precision, '0').slice(0, precision)

//   if (precision === 0) return intPart
//   return (intPart ? intPart : '0') + (fracPart.length > 0 ? delimiter + fracPart : '')
// }

// BigNumber.prototype.formatNumber = function (decimals = 18, precision = decimals) {
//   const str = this.formatString(decimals, precision)
//   return Number(str)
// }
