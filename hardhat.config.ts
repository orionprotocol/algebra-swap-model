import 'dotenv/config';
import { HardhatUserConfig } from 'hardhat/types';
import 'hardhat-deploy';
import '@nomicfoundation/hardhat-ethers';
import "@nomicfoundation/hardhat-verify";
import '@typechain/hardhat';
import 'hardhat-deploy-ethers';
import 'hardhat-gas-reporter';
import 'hardhat-deploy-tenderly';
import 'hardhat-tracer';
import 'solidity-coverage';
import 'hardhat-contract-sizer'
import { task } from 'hardhat/config';

import { addForkConfiguration } from './orion-tools/utils/network';
import { generateNamedAccounts } from './accounts.config';
import { defaultNetworks } from './networks.config';
import * as dotenv from 'dotenv'

import { env } from 'process';
dotenv.config()

import './orion-tools/extensions'

const config: HardhatUserConfig = {
	solidity: {
		compilers: [
			{
				version: '0.7.6',
				settings: {
					optimizer: {
						enabled: true,
						runs: 1
					}
				}
			},
		],
	},
	namedAccounts: generateNamedAccounts(defaultNetworks),
	networks: addForkConfiguration(defaultNetworks),
	gasReporter: {
		currency: 'USD',
		gasPrice: 100,
		enabled: process.env.REPORT_GAS ? true : false,
		coinmarketcap: process.env.COINMARKETCAP_API_KEY,
		maxMethodDiff: 10,
	},
	typechain: {
		outDir: 'typechain',
		// externalArtifacts: [
		// 	"./node_modules/@cryptoalgebra/v1-core/artifacts/**/*.json",
		// 	"./node_modules/@cryptoalgebra/v1-periphery/artifacts/**/*.json"
		// ]
	},
	mocha: {
		timeout: 0,
	},
	tracer: {
		tasks: ["deploy"],
		enableAllOpcodes: false
	},
	external: {
		contracts: [
			// {
			// 	artifacts: "./node_modules/@cryptoalgebra/v1-core/artifacts",
			// },
			// {
			// 	artifacts: "./node_modules/@cryptoalgebra/v1-periphery/artifacts",
			// }
		],
		deployments: process.env.HARDHAT_FORK ? {
			// process.env.HARDHAT_FORK will specify the network that the fork is made from.
			// these lines allow it to fetch the deployments from the network being forked from both for node and deploy task
			hardhat: ['deployments/' + process.env.HARDHAT_FORK],
			localhost: ['deployments/' + process.env.HARDHAT_FORK],
		} : undefined
	},

	tenderly: {
		project: 'orion-referral',
		username: env.TENDERLY_USERNAME as string,
	},
	etherscan: {
		apiKey: {
			mainnet: env.ETHSCAN_API_KEY!,
			ropsten: env.ETHSCAN_API_KEY!,
			bsc: env.BSCSCAN_API_KEY!,
			bscTestnet: env.BSCSCAN_API_KEY!,
			ftmTestnet: env.FTMSCAN_API_KEY!,
			opera: env.FTMSCAN_API_KEY!,
			polygon: env.POLYGONSCAN_API_KEY!,
			polygonMumbai: env.POLYGONSCAN_API_KEY!,
			okcTestnet: env.OKCSCAN_API_KEY!,
			okcMainnet: env.OKCSCAN_API_KEY!,
		},
		customChains: [
			{
				network: "okcTestnet",
				chainId: 65,
				urls: {
					apiURL: "https://www.oklink.com/api/explorer/v1/contract/verify/async/api/okctest",
					browserURL: "https://www.oklink.com/en/okc-test",
				}
			},
			{
				network: "okcMainnet",
				chainId: 66,
				urls: {
					apiURL: "https://www.oklink.com/api/explorer/v1/contract/verify/async/api",
					browserURL: "https://www.oklink.com/en/okc",
				},
			}
		]
	},
};

task("deployments", "List all deployed contract addresses")
	.setAction(async (_, hre) => {
		const deployments = await hre.deployments.all()
		for (const contractName in deployments) {
			console.log(`${contractName} \`${deployments[contractName].address}\``)
		}
	})

task("verify-etherscan", "Verify all deployments using etherscan-verify")
	.addOptionalParam("pattern", "Filter deployments to only those which name includes {{pattern}}")
	.addOptionalParam("contract", "The name of contract that should be verified")
	.setAction(async (taskArgs, hre) => {
		const deployments = await hre.deployments.all()
		for (const deploymentName in deployments) {
			if (taskArgs.pattern && !deploymentName.includes(taskArgs.pattern)) continue

			const metadataString = deployments[deploymentName].metadata
			if (metadataString === undefined) continue
			const metadata = JSON.parse(metadataString)
			const [path, contractName]: any = Object.entries(metadata.settings.compilationTarget)[0]

			if (taskArgs.contract && contractName != taskArgs.contract) continue

			console.log("\n\x1b[33m%s\x1b[0m", `Processing deployment ${deploymentName}`)
			console.log(`Verifying ${contractName} at address: ${deployments[deploymentName].address}`);
			try {
				await hre.run("verify:verify", {
					contract: `${path}:${contractName}`,
					address: deployments[deploymentName].address,
					constructorArguments: deployments[deploymentName].args,
					libs: {
					}
				});
			} catch (error) {
				console.error(error)
			} finally {
				console.log()
			}
		}
	})


export default config;
