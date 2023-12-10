import { Addressable, BaseContract, Signer } from 'ethers';
import { ethers } from 'hardhat';

export const DAY = 86400

export interface User extends Addressable  {
  address: string,
  signer: Signer
}

export async function setupUsers<T extends { [contractName: string]: BaseContract }>(
  addresses: string[],
  contracts: T
): Promise<(User & T)[]> {
  const users: (User & T)[] = [];
  for (const address of addresses) {
    users.push(await setupUser(address, contracts));
  }
  return users;
}

export async function setupNamedUsers<T extends { [contractName: string]: BaseContract }, L extends { [name: string]: string }>(
  namedAddresses: L,
  contracts: T
): Promise<{ [name in keyof L]: User & T }> {
  const namedUsers = {} as { [name in keyof L]: User & T };
  for (const addressName in namedAddresses) {
    namedUsers[addressName] = (await setupUser(namedAddresses[addressName], contracts));
  }
  return namedUsers;
}

export async function setupUser<T extends { [contractName: string]: BaseContract }>(
  address: string,
  contracts: T
): Promise<User & T> {
  const user: any = { address };
  for (const key of Object.keys(contracts)) {
    try {
      let signer = await ethers.getSigner(address);
      user.signer = signer
			user.getAddress = async () => user.address
    } catch (e) {
      console.error(e);
    }

    user[key] = contracts[key].connect(await ethers.getSigner(address));
  }
  return user as User & T;
}
