// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract MyNFT is ERC1155, AccessControl {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    uint256 private _nftTokenIds;
    mapping(uint256 => string) private _tokenURIs;
    mapping(address => uint256) private _nonces;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    event TokenRegistered(
        address indexed registrar,
        uint256 indexed tokenId,
        string tokenURI,
        address signer
    );

    event NFTMint(
        address indexed to,
        uint256 indexed tokenId,
        uint256 amount,
        address signer
    );

    constructor(address defaultAdmin) ERC1155("") {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(ADMIN_ROLE, defaultAdmin);
        _nftTokenIds = 1;
    }

    function registerNFT(
        string memory tokenURI,
        uint256 nonce,
        bytes memory signature
    ) external returns (uint256) {
        address signer = verifyRoleSignature(
            abi.encodePacked(tokenURI, nonce),
            signature,
            ADMIN_ROLE
        );
        require(bytes(tokenURI).length > 0, "Token URI cannot be empty");
        require(nonce == _nonces[msg.sender], "Invalid nonce");

        uint256 newTokenId = _nftTokenIds++;
        _tokenURIs[newTokenId] = tokenURI;

        _nonces[msg.sender]++;
        emit TokenRegistered(msg.sender, newTokenId, tokenURI, signer);

        return newTokenId;
    }

    function mintNFT(
        address to,
        uint256 tokenId,
        uint256 nonce,
        bytes memory signature
    ) external returns (uint256) {
        address signer = verifyRoleSignature(
            abi.encodePacked(to, tokenId, nonce),
            signature,
            ADMIN_ROLE
        );
        require(bytes(_tokenURIs[tokenId]).length > 0, "Token not registered");
        require(nonce == _nonces[msg.sender], "Invalid nonce");

        _mint(to, tokenId, 1, "");

        _nonces[msg.sender]++;
        emit NFTMint(to, tokenId, 1, signer);
        return tokenId;
    }

    function verifyRoleSignature(
        bytes memory data,
        bytes memory signature,
        bytes32 role
    ) internal view returns (address) {
        bytes32 messageHash = keccak256(abi.encodePacked(data, address(this)));
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedMessageHash.recover(signature);

        require(
            hasRole(role, signer),
            "Invalid signature: signer must have the specified role"
        );

        return signer;
    }

    function getNonce(address account) external view returns (uint256) {
        return _nonces[account];
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        string memory tokenURI = _tokenURIs[tokenId];
        return bytes(tokenURI).length > 0 ? tokenURI : super.uri(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
