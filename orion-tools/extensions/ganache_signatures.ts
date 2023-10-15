
import { HardhatRuntimeEnvironment } from 'hardhat/types'

export class SignPlagin {
  hre: HardhatRuntimeEnvironment

  constructor(hre: HardhatRuntimeEnvironment) {
    this.hre = hre
  }

  async eth_signTypedData_v4(userAddress: string, signatureData: string) {
    return this.hre.network.provider.send("eth_signTypedData_v4", [userAddress, signatureData])
  };

  // export const eth_signTypedData_v4 = (userAddress: string, signatureData: string) => {
  //   return new Promise(function (resolve, reject) {
  //     web3.currentProvider.send(
  //       {
  //         method: "eth_signTypedData_v4",
  //         params: [userAddress, signatureData],
  //         from: userAddress,
  //       },
  //       function (err: Error, result: any) {
  //         if (err) {
  //           reject(err);
  //         } else if (result.error) {
  //           reject(result.error);
  //         } else {
  //           resolve(result.result);
  //         }
  //       }
  //     );
  //   });
};
