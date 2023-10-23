import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;

    const { owner } = await getNamedAccounts();

    const decimals = 18

    await deploy('GenericTokenWithFee', {
        contract: 'GenericTokenWithFee',
        from: owner,
        args: ["Token with persent fee", "TPF", decimals],
        log: true
    });
};
export default func;
func.tags = ['GenericTokenWithPersentFee', "tokens"]
func.skip = async (hre) => {
    return !hre.network.tags["local"]
};