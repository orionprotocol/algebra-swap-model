
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { AlgebraPoolDeployer } from '../typechain';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { owner } = await getNamedAccounts();

  await deploy('AlgebraPoolDeployer', {
    from: owner,
    args: [],
    log: true,
    autoMine: true,
  });

}
export default func
func.tags = ["AlgebraPoolDeployer"]
func.skip = async (hre: HardhatRuntimeEnvironment) => !hre.network.tags.local