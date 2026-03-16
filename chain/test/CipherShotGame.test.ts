import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";

type Signers = {
  deployer: HardhatEthersSigner;
  playerA: HardhatEthersSigner;
  playerB: HardhatEthersSigner;
  server: HardhatEthersSigner;
};

describe("CipherShotGame", function () {
  let signers: Signers;
  let game: any;
  let gameAddress: string;
  const matchId = ethers.keccak256(ethers.toUtf8Bytes("test-match-1"));

  before(async function () {
    if (!fhevm.isMock) {
      console.warn("This test suite requires mock FHE environment");
      this.skip();
    }

    const ethSigners = await ethers.getSigners();
    signers = {
      deployer: ethSigners[0],
      playerA: ethSigners[1],
      playerB: ethSigners[2],
      server: ethSigners[3],
    };
  });

  beforeEach(async function () {
    const Factory = await ethers.getContractFactory("CipherShotGame");
    game = await Factory.deploy();
    gameAddress = await game.getAddress();
  });

  describe("Match Creation", function () {
    it("should create a match with correct initial state", async function () {
      const tx = await game.createMatch(matchId, signers.playerA.address, signers.playerB.address);
      await tx.wait();

      const info = await game.getMatchInfo(matchId);
      expect(info.playerA).to.equal(signers.playerA.address);
      expect(info.playerB).to.equal(signers.playerB.address);
      expect(info.phase).to.equal(0); // ChoosingTarget
      expect(info.currentShooter).to.equal(signers.playerA.address);
      expect(info.currentShotIndex).to.equal(0);
      expect(info.playerAAlive).to.be.true;
      expect(info.playerBAlive).to.be.true;
      expect(info.winner).to.equal(ethers.ZeroAddress);
    });

    it("should reject duplicate match ID", async function () {
      await game.createMatch(matchId, signers.playerA.address, signers.playerB.address);

      await expect(
        game.createMatch(matchId, signers.playerA.address, signers.playerB.address)
      ).to.be.revertedWithCustomError(game, "MatchExists");
    });
  });

  describe("Choose Target", function () {
    beforeEach(async function () {
      await (await game.createMatch(matchId, signers.playerA.address, signers.playerB.address)).wait();
    });

    it("should allow shooter to choose target", async function () {
      const tx = await game.connect(signers.playerA).chooseTarget(matchId, 1); // shoot opponent
      await tx.wait();

      const info = await game.getMatchInfo(matchId);
      expect(info.phase).to.equal(1); // RespondingCard
      expect(info.selectedTarget).to.equal(1);
    });

    it("should reject non-shooter", async function () {
      await expect(
        game.connect(signers.playerB).chooseTarget(matchId, 1)
      ).to.be.revertedWithCustomError(game, "NotYourTurn");
    });

    it("should reject invalid target", async function () {
      await expect(
        game.connect(signers.playerA).chooseTarget(matchId, 2)
      ).to.be.revertedWithCustomError(game, "InvalidTarget");
    });
  });

  describe("Play Card (Encrypted)", function () {
    beforeEach(async function () {
      await (await game.createMatch(matchId, signers.playerA.address, signers.playerB.address)).wait();
      await (await game.connect(signers.playerA).chooseTarget(matchId, 1)).wait();
    });

    it("should accept encrypted card from responder", async function () {
      // Encrypt card type: 1 = bluff
      const encrypted = await fhevm
        .createEncryptedInput(gameAddress, signers.playerB.address)
        .add8(1) // bluff
        .encrypt();

      const tx = await game
        .connect(signers.playerB)
        .playCard(matchId, encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      const info = await game.getMatchInfo(matchId);
      expect(info.phase).to.equal(2); // WaitingReveal
    });

    it("should reject non-responder", async function () {
      const encrypted = await fhevm
        .createEncryptedInput(gameAddress, signers.playerA.address)
        .add8(1)
        .encrypt();

      await expect(
        game.connect(signers.playerA).playCard(matchId, encrypted.handles[0], encrypted.inputProof)
      ).to.be.revertedWithCustomError(game, "NotResponder");
    });
  });

  describe("Finalize Round", function () {
    beforeEach(async function () {
      await (await game.createMatch(matchId, signers.playerA.address, signers.playerB.address)).wait();
      await (await game.connect(signers.playerA).chooseTarget(matchId, 1)).wait();

      // Play a bluff card (encrypted)
      const encrypted = await fhevm
        .createEncryptedInput(gameAddress, signers.playerB.address)
        .add8(1) // bluff
        .encrypt();

      await (await game.connect(signers.playerB).playCard(matchId, encrypted.handles[0], encrypted.inputProof)).wait();
    });

    it("should finalize with blank round (no kill)", async function () {
      // Finalize: target=opponent(1), not killed(0), bluff card(1)
      const tx = await game.finalizeRound(matchId, 1, 0, 1);
      await tx.wait();

      const info = await game.getMatchInfo(matchId);
      expect(info.phase).to.equal(0); // ChoosingTarget (next turn)
      expect(info.currentShotIndex).to.equal(1);
      // Shooter should swap to playerB
      expect(info.currentShooter).to.equal(signers.playerB.address);
      expect(info.playerAAlive).to.be.true;
      expect(info.playerBAlive).to.be.true;
    });

    it("should finalize with live round (kill)", async function () {
      // Finalize: target=opponent(1), killed(1), bluff card(1)
      const tx = await game.finalizeRound(matchId, 1, 1, 1);
      await tx.wait();

      const info = await game.getMatchInfo(matchId);
      expect(info.phase).to.equal(3); // GameOver
      expect(info.playerBAlive).to.be.false;
      expect(info.winner).to.equal(signers.playerA.address);
    });

    it("should reject finalize in wrong phase", async function () {
      await (await game.finalizeRound(matchId, 1, 0, 1)).wait();

      // Try to finalize again — should fail (phase is ChoosingTarget now)
      await expect(
        game.finalizeRound(matchId, 1, 0, 1)
      ).to.be.revertedWithCustomError(game, "WrongPhase");
    });
  });

  describe("Full Game Flow", function () {
    it("should play a complete game with kill", async function () {
      await (await game.createMatch(matchId, signers.playerA.address, signers.playerB.address)).wait();

      // Round 1: A shoots B, B plays bluff, blank round
      await (await game.connect(signers.playerA).chooseTarget(matchId, 1)).wait();
      let enc = await fhevm.createEncryptedInput(gameAddress, signers.playerB.address).add8(1).encrypt();
      await (await game.connect(signers.playerB).playCard(matchId, enc.handles[0], enc.inputProof)).wait();
      await (await game.finalizeRound(matchId, 1, 0, 1)).wait();

      let info = await game.getMatchInfo(matchId);
      expect(info.currentShooter).to.equal(signers.playerB.address);
      expect(info.currentShotIndex).to.equal(1);

      // Round 2: B shoots A, A plays redirect, live round — B dies (redirected)
      await (await game.connect(signers.playerB).chooseTarget(matchId, 1)).wait();
      enc = await fhevm.createEncryptedInput(gameAddress, signers.playerA.address).add8(2).encrypt();
      await (await game.connect(signers.playerA).playCard(matchId, enc.handles[0], enc.inputProof)).wait();
      // Redirect: target flipped from opponent(1) to self(0) = shooter(B) gets hit
      await (await game.finalizeRound(matchId, 0, 1, 2)).wait();

      info = await game.getMatchInfo(matchId);
      expect(info.phase).to.equal(3); // GameOver
      expect(info.playerBAlive).to.be.false;
      expect(info.winner).to.equal(signers.playerA.address);
    });
  });
});
