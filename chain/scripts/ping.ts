import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(signer.address);
  const block = await ethers.provider.getBlockNumber();
  console.log(`Signer: ${signer.address}`);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);
  console.log(`Block: ${block}`);
  console.log("RPC OK ✓");
}
main().catch(console.error);
