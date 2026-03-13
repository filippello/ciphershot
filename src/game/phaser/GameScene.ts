import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config';

// Player positions
const P1_X = 140;
const P2_X = 820;
const PLAYER_Y = 370;

// Player display size
const P_W = 240;
const P_H = 360;

// Gun
const GUN_X = 480; // GAME_WIDTH/2
const GUN_Y = 340;

export class GameScene extends Phaser.Scene {
  // Visual elements
  private bg!: Phaser.GameObjects.Image;
  private table!: Phaser.GameObjects.Image;
  private gun!: Phaser.GameObjects.Image;
  private playerLeft!: Phaser.GameObjects.Image;
  private playerRight!: Phaser.GameObjects.Image;
  private playerLeftLabel!: Phaser.GameObjects.Text;
  private playerRightLabel!: Phaser.GameObjects.Text;
  private muzzleFlash!: Phaser.GameObjects.Ellipse;
  private shooterGlow!: Phaser.GameObjects.Ellipse;

  // Chamber display
  private chamberDots: Phaser.GameObjects.Arc[] = [];

  constructor() {
    super({ key: 'GameScene' });
  }

  preload(): void {
    this.load.image('bg_room', '/assets/backgrounds/bg_room.png');
    this.load.image('table', '/assets/table/table.png');
    this.load.image('gun', '/assets/gun/gun.png');
    this.load.image('player_left', '/assets/players/player_left_idle.png');
    this.load.image('player_right', '/assets/players/player_right_idle.png');
  }

  create(): void {
    this.createRoom();
    this.createTable();
    this.createPlayers();
    this.createGun();
    this.createMuzzleFlash();

    // Emit ready event
    this.events.emit('scene-ready');
  }

  private createRoom(): void {
    this.bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'bg_room');
    this.bg.setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.bg.setDepth(0);
  }

  private createTable(): void {
    this.table = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT - 100, 'table');
    this.table.setDisplaySize(500, 280);
    this.table.setDepth(1);
  }

  private createPlayers(): void {
    // Player 1 (left) — flipped to face right
    this.playerLeft = this.add.image(P1_X, PLAYER_Y, 'player_left');
    this.playerLeft.setDisplaySize(P_W, P_H);
    this.playerLeft.setFlipX(true);
    this.playerLeft.setDepth(2);

    this.playerLeftLabel = this.add.text(P1_X, PLAYER_Y - P_H / 2 - 12, 'P1', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffcc44',
    }).setOrigin(0.5).setDepth(3);

    // Player 2 (right)
    this.playerRight = this.add.image(P2_X, PLAYER_Y, 'player_right');
    this.playerRight.setDisplaySize(P_W, P_H);
    this.playerRight.setDepth(2);

    this.playerRightLabel = this.add.text(P2_X, PLAYER_Y - P_H / 2 - 12, 'P2', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffcc44',
    }).setOrigin(0.5).setDepth(3);

    // Shooter glow indicator (behind active player)
    this.shooterGlow = this.add.ellipse(P1_X, PLAYER_Y, 160, 220, 0xff4444, 0);
    this.shooterGlow.setDepth(1);
  }

  private createGun(): void {
    this.gun = this.add.image(GUN_X, GUN_Y, 'gun');
    this.gun.setDisplaySize(100, 100);
    this.gun.setDepth(3);
  }

  private createMuzzleFlash(): void {
    this.muzzleFlash = this.add.ellipse(GUN_X, GUN_Y, 50, 50, 0xffff00, 0);
    this.muzzleFlash.setDepth(4);
  }

  // --- PUBLIC ANIMATION METHODS (called from React/store) ---

  public highlightShooter(player: 'player1' | 'player2'): void {
    const x = player === 'player1' ? P1_X : P2_X;
    this.shooterGlow.setPosition(x, PLAYER_Y);
    this.shooterGlow.setAlpha(0.15);

    // Subtle tint on active player
    const active = player === 'player1' ? this.playerLeft : this.playerRight;
    const inactive = player === 'player1' ? this.playerRight : this.playerLeft;
    active.setTint(0xffffff);
    inactive.setTint(0x888888);
  }

  public animateAim(shooter: 'player1' | 'player2', target: 'self' | 'opponent'): void {
    const isLeft = shooter === 'player1';

    // Gun moves to the shooter's side (they pick it up)
    const shooterX = isLeft ? P1_X + 60 : P2_X - 60;

    // If shooting self, gun points inward (toward shooter)
    // If shooting opponent, gun points outward (toward opponent)
    const pointsRight = target === 'self'
      ? (isLeft ? false : true)   // self: P1 points left at self, P2 points right at self
      : (isLeft ? true : false);  // opponent: P1 points right at P2, P2 points left at P1

    const flipX = pointsRight ? 1 : -1;

    this.tweens.add({
      targets: this.gun,
      x: shooterX,
      scaleX: Math.abs(this.gun.scaleX) * flipX,
      duration: 400,
      ease: 'Power2',
    });
  }

  public animateShot(isLive: boolean, onComplete: () => void): void {
    if (isLive) {
      // Flash at gun tip
      this.muzzleFlash.setPosition(this.gun.x, this.gun.y - 10);
      this.muzzleFlash.setAlpha(1);
      this.muzzleFlash.setScale(1);

      // Camera shake
      this.cameras.main.shake(300, 0.015);

      // Gun recoil
      this.tweens.add({
        targets: this.gun,
        x: this.gun.x + (this.gun.scaleX < 0 ? -20 : 20),
        duration: 50,
        yoyo: true,
        ease: 'Power4',
      });

      // Flash fade + expand
      this.tweens.add({
        targets: this.muzzleFlash,
        alpha: 0,
        scaleX: 4,
        scaleY: 4,
        duration: 300,
        onComplete: () => {
          this.muzzleFlash.setScale(1);
          onComplete();
        },
      });
    } else {
      // Blank — small shake only
      this.cameras.main.shake(100, 0.003);
      this.time.delayedCall(400, onComplete);
    }
  }

  public resetGunPosition(): void {
    this.tweens.add({
      targets: this.gun,
      x: GUN_X,
      duration: 300,
      ease: 'Power2',
    });
  }

  public showKill(player: 'player1' | 'player2'): void {
    const target = player === 'player1' ? this.playerLeft : this.playerRight;

    this.tweens.add({
      targets: target,
      alpha: 0.2,
      y: target.y + 40,
      duration: 600,
      ease: 'Power2',
    });

    // Red flash overlay
    const flash = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xff0000, 0.35);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 800,
      onComplete: () => flash.destroy(),
    });
  }

  public resetVisuals(): void {
    // Reset players
    this.playerLeft.setPosition(P1_X, PLAYER_Y);
    this.playerLeft.setAlpha(1);
    this.playerLeft.setDisplaySize(P_W, P_H);
    this.playerLeft.setTint(0xffffff);

    this.playerRight.setPosition(P2_X, PLAYER_Y);
    this.playerRight.setAlpha(1);
    this.playerRight.setDisplaySize(P_W, P_H);
    this.playerRight.setTint(0xffffff);

    // Reset gun
    this.gun.setPosition(GUN_X, GUN_Y);
    this.gun.setDisplaySize(100, 100);

    // Reset effects
    this.muzzleFlash.setAlpha(0);
    this.muzzleFlash.setScale(1);
    this.shooterGlow.setAlpha(0);
  }

  // Display chamber status (dots at top)
  public updateChamberDisplay(total: number, currentIndex: number): void {
    this.chamberDots.forEach(d => d.destroy());
    this.chamberDots = [];

    const startX = GAME_WIDTH / 2 - (total * 18) / 2;
    for (let i = 0; i < total; i++) {
      const color = i < currentIndex ? 0x444455 : (i === currentIndex ? 0xffcc44 : 0x666677);
      const radius = i === currentIndex ? 5 : 4;
      const dot = this.add.circle(startX + i * 18, 22, radius, color);
      this.chamberDots.push(dot);
    }
  }
}
