
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { OrionReferral, ORN } from '../typechain';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer, owner, verifier } = await getNamedAccounts();
  const orn = <ORN>await hre.ethers.getContract("ORN")

  await deploy('OrionReferral', {
    contract: "OrionReferral",
    skipIfAlreadyDeployed: true,
    from: deployer,
    args: [],
    proxy: {
      owner: owner,
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        init: {
          methodName: 'initialize',
          args: [orn.address, verifier]
        }
      },
    },
    log: true,
  })
  if (owner !== deployer) {
    const orionReferral = <OrionReferral>await hre.ethers.getContract("OrionReferral", deployer)
    await (await orionReferral.transferOwnership(owner)).wait()
  }
};
export default func;
func.tags = ['OrionReferral'];
func.dependencies = ['ORN']
