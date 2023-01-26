import { ethers } from "hardhat";

async function main() {
  const TestContract = await ethers.getContractFactory("TestContract");
  const testContract = await TestContract.deploy();

  await testContract.deployed();

  console.log(`Deployed to ${testContract.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
