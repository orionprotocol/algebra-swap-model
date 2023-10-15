import 'dotenv/config';
import { HDAccountsUserConfig, HttpNetworkUserConfig, NetworksUserConfig } from 'hardhat/types';
import { env } from 'process';

export function node_url(networkName: string): string {
	if (networkName) {
		const uri = process.env['ETH_NODE_URI_' + networkName.toUpperCase()];
		if (uri && uri !== '') {
			return uri;
		}
	}

	if (networkName === 'localhost') {
		// do not use ETH_NODE_URI
		return 'http://localhost:8545';
	}

	let uri = process.env.ETH_NODE_URI;
	if (uri) {
		uri = uri.replace('{{networkName}}', networkName);
	}
	if (!uri || uri === '') {
		// throw new Error(`environment variable "ETH_NODE_URI" not configured `);
		return '';
	}
	if (uri.indexOf('{{') >= 0) {
		throw new Error(`invalid uri or network not supported by node provider : ${uri}`);
	}
	return uri;
}


export function accounts() {
	let unnamedSigners = process.env.ACCOUNTS.split(" ");
	const additionalKeys = [
		env.DEPLOYER_TESTING,
		env.DEPLOYER_STAGING,
		env.DEPLOYER_PRODUCTION,
	]
	unnamedSigners = unnamedSigners.concat(additionalKeys)
	unnamedSigners = [...new Set(unnamedSigners)].filter((value: string) => value != '' && value != undefined)
	return unnamedSigners 
}

export function addForkConfiguration(networks: NetworksUserConfig): NetworksUserConfig {
	// While waiting for hardhat PR: https://github.com/nomiclabs/hardhat/pull/1542
	if (process.env.HARDHAT_FORK) {
		process.env['HARDHAT_DEPLOY_FORK'] = process.env.HARDHAT_FORK;
	}

	for (const networkName in networks) {
		const currentUrl = (networks[networkName] as HttpNetworkUserConfig).url
		if (currentUrl === undefined && networkName !== "hardhat") {
			(networks[networkName] as HttpNetworkUserConfig).url = node_url(networkName);
		}
		(networks[networkName] as HttpNetworkUserConfig).accounts = accounts();
	}

	const currentNetworkName = process.env.HARDHAT_FORK;
	let forkURL: string | undefined = currentNetworkName && node_url(currentNetworkName);
	let hardhatAccounts: HDAccountsUserConfig | undefined;
	if (currentNetworkName && currentNetworkName !== 'hardhat') {
		const currentNetwork = networks[currentNetworkName] as HttpNetworkUserConfig;
		if (currentNetwork) {
			forkURL = currentNetwork.url;
			if (
				currentNetwork.accounts &&
				typeof currentNetwork.accounts === 'object' &&
				'mnemonic' in currentNetwork.accounts
			) {
				hardhatAccounts = currentNetwork.accounts;
			}
		}
	}
	const newNetworks = {
		...networks,
		hardhat: {
			...networks.hardhat,
			...{
				accounts: hardhatAccounts,
				forking: forkURL
					? {
						url: forkURL,
						blockNumber: process.env.HARDHAT_FORK_NUMBER
							? parseInt(process.env.HARDHAT_FORK_NUMBER)
							: undefined,
					}
					: undefined,
				mining: process.env.MINING_INTERVAL
					? {
						auto: false,
						interval: process.env.MINING_INTERVAL.split(',').map((v) => parseInt(v)) as [
							number,
							number
						],
					}
					: undefined,
			},
		},
	};
	return newNetworks;
}
