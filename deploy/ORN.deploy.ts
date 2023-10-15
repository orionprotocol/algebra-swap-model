
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { owner } = await getNamedAccounts();

  await deploy('ORN', {
    from: owner,
    args: ["Orion", "ORN", "8", owner],
    log: true,
    autoMine: true,
  });

}
export default func
func.tags = ["ORN"]
func.skip = async (hre: HardhatRuntimeEnvironment) => !hre.network.tags.local