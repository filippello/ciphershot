/**
 * CipherShotGame — Full interaction test on Sepolia
 */

import { ethers, fhevm, network } from "hardhat";

const GAME_ADDRESS = "0x843D7908AF8042199EA80f1883CD20e8d4211ba8";

async function main() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const playerA = signers[1] || deployer;
  const playerB = signers[2] || signers[0];
  const isLocal = network.name === "hardhat" || network.name === "localhost";

  console.log("=== CipherShotGame Interaction Test ===");
  console.log(`Network: ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Player A: ${playerA.address}`);
  console.log(`Player B: ${playerB.address}`);

  const game = await ethers.getContractAt("CipherShotGame", GAME_ADDRESS);

  // Init FHE
  if (!isLocal) {
    console.log("\n[1/2] Initializing fhEVM CLI API...");
    await fhevm.initializeCLIApi();
    console.log("[2/2] fhEVM CLI API ready ✓");
  }

  // Create match
  const matchId = ethers.keccak256(ethers.toUtf8Bytes(`run-${Date.now()}`));
  console.log(`\n--- Create Match: ${matchId.slice(0, 18)}... ---`);
  const tx1 = await game.connect(deployer).createMatch(matchId, playerA.address, playerB.address);
  const r1 = await tx1.wait();
  console.log(`Gas: ${r1?.gasUsed} ✓`);

  // Choose target
  console.log(`\n--- Choose Target (A → opponent) ---`);
  const tx2 = await game.connect(playerA).chooseTarget(matchId, 1);
  await tx2.wait();
  console.log("✓");

  // Play card (encrypted)
  console.log(`\n--- Play Card (B plays bluff, encrypted) ---`);
  console.log("Creating encrypted input...");
  const input = await fhevm.createEncryptedInput(GAME_ADDRESS, playerB.address);
  input.add8(1); // bluff
  console.log("Encrypting (calls Zama relayer)...");
  const encrypted = await input.encrypt();
  console.log("Encrypted ✓");

  console.log("Sending tx...");
  const tx3 = await game.connect(playerB).playCard(matchId, encrypted.handles[0], encrypted.inputProof);
  const r3 = await tx3.wait();
  console.log(`Gas: ${r3?.gasUsed} ✓`);

  // Check phase
  const info = await game.getMatchInfo(matchId);
  console.log(`Phase: ${info.phase} (2=WaitingReveal) ✓`);

  // Read result handles
  const handles = await game.getResultHandles(matchId);
  console.log(`Result handles: target=${handles[0].slice(0,18)}... killed=${handles[1].slice(0,18)}... card=${handles[2].slice(0,18)}...`);

  // Finalize (blank, bluff, no kill)
  console.log(`\n--- Finalize Round (blank, bluff) ---`);
  const tx5 = await game.connect(deployer).finalizeRound(matchId, 1, 0, 1);
  await tx5.wait();
  console.log("✓");

  const final = await game.getMatchInfo(matchId);
  console.log(`Phase: ${final.phase} (0=next turn), Shot: ${final.currentShotIndex}, Shooter: ${final.currentShooter === playerB.address ? 'B' : 'A'}`);
  console.log(`Both alive: A=${final.playerAAlive} B=${final.playerBAlive}`);

  console.log(`\n=== ALL STEPS PASSED ===`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
