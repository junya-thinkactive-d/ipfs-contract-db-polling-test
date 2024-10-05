// contracts/MyNFT.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyNFT is ERC1155, Ownable {
    uint256 public currentTokenID = 0;

    constructor(address initialOwner) ERC1155("") Ownable(initialOwner) {}

    function mint(
        address to,
        uint256 amount,
        string memory metadataUri
    ) public onlyOwner {
        _mint(to, currentTokenID, amount, "");
        _setURI(metadataUri);
        currentTokenID++;
    }

    function setURI(string memory newuri) public onlyOwner {
        _setURI(newuri);
    }
}
