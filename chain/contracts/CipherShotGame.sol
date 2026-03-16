// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint8, externalEuint8, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title CipherShotGame — Encrypted Duel on Zama fhEVM
/// @notice Two-player shotgun duel where the chamber AND card played are encrypted.
///         Nobody sees the chamber order. Nobody sees what card the responder played
///         until the shot resolves. Real bluffing. Real suspense.
///
/// @dev Game flow:
///   1. createMatch()           — encrypted chamber shuffle + card inventories
///   2. chooseTarget()          — shooter picks self/opponent (plaintext, public)
///   3. playCard()              — responder submits encrypted card (0=pass, 1=bluff, 2=redirect)
///                                → FHE resolution computed, results made publicly decryptable
///   4. finalizeRound()         — server decrypts results, passes them back to update state
///   5. Repeat until someone dies or chamber exhausted
contract CipherShotGame is ZamaEthereumConfig, Ownable2Step {

    // ================================================================
    // Types
    // ================================================================

    enum Phase { ChoosingTarget, RespondingCard, WaitingReveal, GameOver }

    struct Match {
        address playerA;
        address playerB;
        Phase phase;
        address currentShooter;
        uint8 currentShotIndex;

        // === FHE ENCRYPTED ===
        euint8[7] chamber;            // 1=live, 0=blank (Fisher-Yates shuffled)
        euint8 pendingCard;           // card played by responder (0=pass, 1=bluff, 2=redirect)
        euint8 playerABluffs;         // remaining bluff count (starts at 3)
        euint8 playerARedirects;      // remaining redirect count (starts at 2)
        euint8 playerBBluffs;
        euint8 playerBRedirects;

        // Resolution handles (publicly decryptable after _resolveShot)
        euint8 resultFinalTarget;     // 0=shooter, 1=opponent
        euint8 resultKilled;          // 0=no, 1=yes
        euint8 resultCard;            // 0=pass, 1=bluff, 2=redirect

        // === PLAINTEXT ===
        uint8 selectedTarget;         // 0=self, 1=opponent
        bool playerAAlive;
        bool playerBAlive;
        address winner;
    }

    // ================================================================
    // State
    // ================================================================

    mapping(bytes32 => Match) private matches;

    // ================================================================
    // Events
    // ================================================================

    event MatchCreated(bytes32 indexed matchId, address playerA, address playerB);
    event TargetChosen(bytes32 indexed matchId, address shooter, uint8 target);
    event CardSubmitted(bytes32 indexed matchId, address responder);
    event ShotResolving(
        bytes32 indexed matchId,
        uint8 shotIndex,
        euint8 resultFinalTarget,
        euint8 resultKilled,
        euint8 resultCard
    );
    event RoundFinalized(
        bytes32 indexed matchId,
        address shooter,
        address finalTarget,
        bool killed,
        uint8 cardPlayed,
        uint8 shotIndex
    );
    event GameOver(bytes32 indexed matchId, address winner);

    // ================================================================
    // Errors
    // ================================================================

    error MatchExists();
    error NotYourTurn();
    error WrongPhase();
    error InvalidTarget();
    error NotResponder();
    error NotInMatch();

    // ================================================================
    // Constructor
    // ================================================================

    constructor() Ownable(msg.sender) {}

    // ================================================================
    // Match Lifecycle
    // ================================================================

    /// @notice Create a new match with encrypted chamber and card inventories
    function createMatch(
        bytes32 matchId,
        address playerA,
        address playerB
    ) external {
        Match storage m = matches[matchId];
        if (m.playerA != address(0)) revert MatchExists();

        m.playerA = playerA;
        m.playerB = playerB;
        m.phase = Phase.ChoosingTarget;
        m.currentShooter = playerA;
        m.playerAAlive = true;
        m.playerBAlive = true;

        // Encrypted card inventories: 3 bluffs, 2 redirects each
        m.playerABluffs = FHE.asEuint8(3);
        m.playerARedirects = FHE.asEuint8(2);
        m.playerBBluffs = FHE.asEuint8(3);
        m.playerBRedirects = FHE.asEuint8(2);

        FHE.allowThis(m.playerABluffs);
        FHE.allowThis(m.playerARedirects);
        FHE.allowThis(m.playerBBluffs);
        FHE.allowThis(m.playerBRedirects);

        // Each player can only read their own card counts
        FHE.allow(m.playerABluffs, playerA);
        FHE.allow(m.playerARedirects, playerA);
        FHE.allow(m.playerBBluffs, playerB);
        FHE.allow(m.playerBRedirects, playerB);

        // Encrypted shuffled chamber (3 live, 4 blank)
        _generateEncryptedChamber(m);

        emit MatchCreated(matchId, playerA, playerB);
    }

    /// @notice Shooter chooses a target (public — the strategy is in the card response)
    function chooseTarget(bytes32 matchId, uint8 target) external {
        Match storage m = matches[matchId];
        if (msg.sender != m.currentShooter) revert NotYourTurn();
        if (m.phase != Phase.ChoosingTarget) revert WrongPhase();
        if (target > 1) revert InvalidTarget();

        m.selectedTarget = target; // 0=self, 1=opponent
        m.phase = Phase.RespondingCard;

        emit TargetChosen(matchId, msg.sender, target);
    }

    /// @notice Responder submits an encrypted card choice
    /// @param encCard Encrypted card type (0=pass, 1=bluff, 2=redirect)
    /// @param inputProof The EIP-712 proof from fhevmjs
    function playCard(
        bytes32 matchId,
        externalEuint8 encCard,
        bytes calldata inputProof
    ) external {
        Match storage m = matches[matchId];
        address responder = _getResponder(m);
        if (msg.sender != responder) revert NotResponder();
        if (m.phase != Phase.RespondingCard) revert WrongPhase();

        // Convert encrypted input to euint8
        euint8 cardType = FHE.fromExternal(encCard, inputProof);

        // Validate card availability and decrement (all in encrypted domain)
        _validateAndConsumeCard(m, responder, cardType);

        // Store encrypted card for resolution
        m.pendingCard = cardType;
        FHE.allowThis(m.pendingCard);

        // NOTE: event does NOT reveal which card was played
        emit CardSubmitted(matchId, msg.sender);

        // Resolve shot (all FHE computation, then make results publicly decryptable)
        _resolveShot(matchId, m);
    }

    /// @notice Called by server after decrypting the publicly-decryptable result handles.
    ///         Updates game state (kill player, advance round, swap shooter).
    function finalizeRound(
        bytes32 matchId,
        uint8 decFinalTarget,   // 0=shooter hit, 1=opponent hit
        uint8 decKilled,        // 0=no, 1=yes
        uint8 decCardPlayed     // 0=pass, 1=bluff, 2=redirect
    ) external {
        Match storage m = matches[matchId];
        if (m.phase != Phase.WaitingReveal) revert WrongPhase();

        bool killed = decKilled == 1;
        address responder = _getResponder(m);

        // Map target to actual address
        address targetPlayer = decFinalTarget == 0
            ? m.currentShooter  // shot self
            : responder;        // shot opponent

        if (killed) {
            if (targetPlayer == m.playerA) m.playerAAlive = false;
            else m.playerBAlive = false;
        }

        uint8 shotIndex = m.currentShotIndex;
        m.currentShotIndex++;

        emit RoundFinalized(
            matchId,
            m.currentShooter,
            targetPlayer,
            killed,
            decCardPlayed,
            shotIndex
        );

        if (killed) {
            m.winner = m.playerAAlive ? m.playerA : m.playerB;
            m.phase = Phase.GameOver;
            emit GameOver(matchId, m.winner);
        } else if (m.currentShotIndex >= 7) {
            // Chamber exhausted — draw
            m.phase = Phase.GameOver;
            emit GameOver(matchId, address(0));
        } else {
            // Next turn — swap shooter
            m.currentShooter = m.currentShooter == m.playerA
                ? m.playerB
                : m.playerA;
            m.phase = Phase.ChoosingTarget;
        }
    }

    // ================================================================
    // FHE Resolution (internal)
    // ================================================================

    /// @dev Compute final target and liveness entirely in FHE, then make results
    ///      publicly decryptable so the server can read and relay them.
    function _resolveShot(bytes32 matchId, Match storage m) internal {
        euint8 chamberRound = m.chamber[m.currentShotIndex];
        euint8 cardPlayed = m.pendingCard;

        // Is the card a redirect? (cardType == 2)
        ebool isRedirect = FHE.eq(cardPlayed, FHE.asEuint8(2));

        // Original target: 0=self, 1=opponent
        euint8 originalTarget = FHE.asEuint8(m.selectedTarget);

        // Flipped target: self(0)→opponent(1), opponent(1)→self(0)
        euint8 flippedTarget = FHE.sub(FHE.asEuint8(1), originalTarget);

        // Final target: redirect ? flipped : original
        euint8 finalTarget = FHE.select(isRedirect, flippedTarget, originalTarget);

        // Killed = chamber round is live (value == 1)
        ebool killedBool = FHE.eq(chamberRound, FHE.asEuint8(1));
        euint8 killed = FHE.select(killedBool, FHE.asEuint8(1), FHE.asEuint8(0));

        // Store result handles
        m.resultFinalTarget = finalTarget;
        m.resultKilled = killed;
        m.resultCard = cardPlayed;

        // Allow this contract + make publicly decryptable
        FHE.allowThis(finalTarget);
        FHE.allowThis(killed);
        FHE.allowThis(cardPlayed);

        FHE.makePubliclyDecryptable(finalTarget);
        FHE.makePubliclyDecryptable(killed);
        FHE.makePubliclyDecryptable(cardPlayed);

        m.phase = Phase.WaitingReveal;

        // Emit handles so server knows which values to decrypt
        emit ShotResolving(matchId, m.currentShotIndex, finalTarget, killed, cardPlayed);
    }

    // ================================================================
    // FHE Card Validation (internal)
    // ================================================================

    /// @dev Validate player has the card and decrement count — all encrypted.
    ///      Uses conditional decrement (no revert on invalid — client is trusted for hackathon).
    function _validateAndConsumeCard(
        Match storage m,
        address player,
        euint8 cardType
    ) internal {
        bool isPlayerA = player == m.playerA;

        euint8 bluffs = isPlayerA ? m.playerABluffs : m.playerBBluffs;
        euint8 redirects = isPlayerA ? m.playerARedirects : m.playerBRedirects;

        ebool isBluff = FHE.eq(cardType, FHE.asEuint8(1));
        ebool isRedirect = FHE.eq(cardType, FHE.asEuint8(2));

        // Conditional decrement: only subtract 1 if playing that card type AND count > 0
        ebool canBluff = FHE.and(isBluff, FHE.gt(bluffs, FHE.asEuint8(0)));
        ebool canRedirect = FHE.and(isRedirect, FHE.gt(redirects, FHE.asEuint8(0)));

        euint8 bluffDec = FHE.select(canBluff, FHE.asEuint8(1), FHE.asEuint8(0));
        euint8 redirectDec = FHE.select(canRedirect, FHE.asEuint8(1), FHE.asEuint8(0));

        euint8 newBluffs = FHE.sub(bluffs, bluffDec);
        euint8 newRedirects = FHE.sub(redirects, redirectDec);

        if (isPlayerA) {
            m.playerABluffs = newBluffs;
            m.playerARedirects = newRedirects;
        } else {
            m.playerBBluffs = newBluffs;
            m.playerBRedirects = newRedirects;
        }

        FHE.allowThis(newBluffs);
        FHE.allowThis(newRedirects);
        FHE.allow(newBluffs, player);
        FHE.allow(newRedirects, player);
    }

    // ================================================================
    // FHE Chamber Generation (internal)
    // ================================================================

    /// @dev Generate 7 encrypted rounds (3 live, 4 blank) with on-chain FHE shuffle.
    ///      Uses Fisher-Yates with encrypted random indices — nobody knows the order.
    function _generateEncryptedChamber(Match storage m) internal {
        // Init: [1, 1, 1, 0, 0, 0, 0]
        for (uint8 i = 0; i < 7; i++) {
            m.chamber[i] = FHE.asEuint8(i < 3 ? 1 : 0);
            FHE.allowThis(m.chamber[i]);
        }

        // Fisher-Yates shuffle using FHE random
        for (uint8 i = 6; i > 0; i--) {
            euint8 rand = FHE.randEuint8();
            // j = rand % (i + 1) — plaintext modulus
            euint8 j = FHE.rem(rand, uint8(i + 1));
            _encryptedSwap(m.chamber, i, j);
        }

        // Re-allow after swaps
        for (uint8 i = 0; i < 7; i++) {
            FHE.allowThis(m.chamber[i]);
        }
    }

    /// @dev Oblivious swap: swap arr[indexI] with arr[encJ] without revealing j.
    ///      Iterates all positions up to indexI and conditionally swaps.
    function _encryptedSwap(
        euint8[7] storage arr,
        uint8 indexI,
        euint8 encJ
    ) internal {
        euint8 valI = arr[indexI];
        euint8 newValI = valI;

        for (uint8 k = 0; k <= indexI; k++) {
            ebool isTarget = FHE.eq(encJ, FHE.asEuint8(k));
            euint8 valK = arr[k];
            // If k == j: arr[k] = valI (swap in), else arr[k] stays
            arr[k] = FHE.select(isTarget, valI, valK);
            // If k == j: newValI = valK (swap out), else keep current newValI
            newValI = FHE.select(isTarget, valK, newValI);
        }

        arr[indexI] = newValI;
    }

    // ================================================================
    // View Functions
    // ================================================================

    /// @notice Get match info (plaintext fields only)
    function getMatchInfo(bytes32 matchId) external view returns (
        address playerA,
        address playerB,
        Phase phase,
        address currentShooter,
        uint8 currentShotIndex,
        uint8 selectedTarget,
        bool playerAAlive,
        bool playerBAlive,
        address winner
    ) {
        Match storage m = matches[matchId];
        return (
            m.playerA, m.playerB, m.phase, m.currentShooter,
            m.currentShotIndex, m.selectedTarget,
            m.playerAAlive, m.playerBAlive, m.winner
        );
    }

    /// @notice Get result handles for decryption (publicly decryptable after ShotResolving)
    function getResultHandles(bytes32 matchId) external view returns (
        euint8 finalTarget,
        euint8 killed,
        euint8 card
    ) {
        Match storage m = matches[matchId];
        return (m.resultFinalTarget, m.resultKilled, m.resultCard);
    }

    /// @notice Get caller's remaining bluff count (encrypted, only caller can decrypt)
    function getMyBluffs(bytes32 matchId) external view returns (euint8) {
        Match storage m = matches[matchId];
        if (msg.sender == m.playerA) return m.playerABluffs;
        if (msg.sender == m.playerB) return m.playerBBluffs;
        revert NotInMatch();
    }

    /// @notice Get caller's remaining redirect count (encrypted, only caller can decrypt)
    function getMyRedirects(bytes32 matchId) external view returns (euint8) {
        Match storage m = matches[matchId];
        if (msg.sender == m.playerA) return m.playerARedirects;
        if (msg.sender == m.playerB) return m.playerBRedirects;
        revert NotInMatch();
    }

    // ================================================================
    // Helpers
    // ================================================================

    function _getResponder(Match storage m) internal view returns (address) {
        return m.currentShooter == m.playerA ? m.playerB : m.playerA;
    }
}
