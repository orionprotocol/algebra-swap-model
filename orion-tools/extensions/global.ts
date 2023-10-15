// import { BigNumber, Contract } from 'ethers';

// declare global {
//   interface String {
//     toBigNumber(decimals?: number, delimiter?: string): BigNumber;
//     cutZeros(): string;
//   }
//   function toBigNumber(num: string | number, decimals?: number, delimiter?: string): BigNumber;
//   function pick<T extends {}, K extends keyof T>(obj: T, ...keys: K[]): Pick<T, K>;
//   function convertToDecimal(num: string | number, token: Contract): Promise<BigNumber>;
//   function convert(num: string | number, decimals: number): BigNumber;
// }

// global.toBigNumber = function toBigNumber(num: string | number, decimals = 18, delimiter = '.'): BigNumber {
//   num = num.toString();
//   if (num.split(delimiter).length === 1)
//     return BigNumber.from(num.padEnd(decimals + num.split(delimiter)[0].length, '0'));
//   const intPart = num.split(delimiter)[0];
//   const fracPart = num.split(delimiter)[1].padEnd(decimals, '0').slice(0, decimals);
//   return BigNumber.from(intPart + fracPart);
// };

// global.convertToDecimal = async function (num: string | number, token: Contract): Promise<BigNumber> {
//   return toBigNumber(num, await token.decimals())
// }

// global.convert = function (num: string | number, decimals: number): BigNumber {
//   return toBigNumber(num, decimals)
// }


// String.prototype.toBigNumber = function (decimals = 18, delimiter = '.') {
//   return toBigNumber(String(this), decimals, delimiter);
// };

// String.prototype.cutZeros = function () {
//   return String(this).replace(/\.?0+$/, '');
// };

// global.pick = function <T extends {}, K extends keyof T>(obj: T, ...keys: K[]): Pick<T, K> {
//   return Object.fromEntries(
//     keys
//       .filter(key => key in obj)
//       .map(key => [key, obj[key]])
//   ) as Pick<T, K>
// }