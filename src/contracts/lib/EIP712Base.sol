//SPDX-License-Identifier: No license
pragma solidity ^0.8.0;

contract EIP712Base {
  struct EIP712Domain {
    string name;
    string version;
    address verifyingContract;
    bytes32 salt;
  }

  bytes32 internal constant EIP712_DOMAIN_TYPEHASH =
    keccak256(
      bytes("EIP712Domain(string name,string version,address verifyingContract,bytes32 salt)")
    );

  bytes32 internal immutable domainSeparator;

  constructor(string memory name, string memory version) {
    domainSeparator = keccak256(
      abi.encode(
        EIP712_DOMAIN_TYPEHASH,
        keccak256(bytes(name)),
        keccak256(bytes(version)),
        address(this),
        bytes32(getChainID())
      )
    );
  }

  function getChainID() internal view returns (uint256 id) {
    assembly {
      id := chainid()
    }
  }

  function getDomainSeparator() private view returns (bytes32) {
    return domainSeparator;
  }

  function toTypedMessageHash(bytes32 messageHash) internal view returns (bytes32) {
    return keccak256(abi.encodePacked("\x19\x01", getDomainSeparator(), messageHash));
  }
}
