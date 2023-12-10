
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ZeroAddress } from 'ethers';
import { AlgebraPoolDeployer } from '../typechain';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { owner } = await getNamedAccounts();

	// await hre.ethers.provider.send("evm_setIntervalMining", [5000]);
  const poolDeployer = <AlgebraPoolDeployer>await hre.ethers.getContract("AlgebraPoolDeployer", owner)

  const res = await deploy('AlgebraFactory', {
    from: owner,
    args: [await poolDeployer.getAddress(), ZeroAddress],
    log: true,
    autoMine: true,
  });

  await (await poolDeployer.setFactory(res.address)).wait()
}
export default func
func.tags = ["AlgebraFactory"]
func.dependencies = ["AlgebraPoolDeployer"]
func.skip = async (hre: HardhatRuntimeEnvironment) => !hre.network.tags.local
