pragma solidity 0.7.6;

import "@openzeppelin/contracts-solc-0.7-2/token/ERC20/ERC20.sol";

import './Mintable.sol';

contract GenericToken is Mintable{
    constructor(string memory longName, string memory ticker, uint8 decimal)
        ERC20(longName, ticker)
        Mintable(decimal)
        {}
}