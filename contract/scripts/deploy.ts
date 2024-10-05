import { ethers, run } from "hardhat";

const DELAY_TIME_MS = 15000;

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function deployAndVerify(contractName: string, args: any[]) {
  const Contract = await ethers.getContractFactory(contractName);
  const contract = await Contract.deploy(...args);

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  console.log(`${contractName} deployed to:`, contractAddress);

  await delay(DELAY_TIME_MS);

  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: args,
    });
  } catch (error) {
    console.log("Verification error:", error);
  }

  return contractAddress;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const initialOwner = deployer.address; // You can change this if needed

  await deployAndVerify("MyNFT", [initialOwner]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
