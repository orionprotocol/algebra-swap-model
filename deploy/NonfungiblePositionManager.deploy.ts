
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ZeroAddress } from 'ethers';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { owner } = await getNamedAccounts();
  const factory = await hre.ethers.getContract("AlgebraFactory")
  const poolDeployer = await hre.ethers.getContract("AlgebraPoolDeployer")
  const weth = await hre.ethers.getContract("WETH")
  
  await deploy('NonfungiblePositionManager', {
    from: owner,
    args: [await factory.getAddress(), await weth.getAddress(), ZeroAddress, await poolDeployer.getAddress()],
    log: true,
    autoMine: true,
  });
  
};
export default func;
func.tags = ['NonfungiblePositionManager', "algebra"];
func.dependencies = ['AlgebraPoolDeployer', "AlgebraFactory", "WETH"];