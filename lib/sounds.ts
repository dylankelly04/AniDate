// Sound effects utility for AniDate
export class SoundManager {
  private static instance: SoundManager;
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private enabled: boolean = true;
  private initialized: boolean = false;

  private constructor() {
    // Only initialize on client side
    if (typeof window !== 'undefined') {
      this.loadSounds();
      this.initialized = true;
    }
  }

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  private ensureInitialized() {
    if (!this.initialized && typeof window !== 'undefined') {
      this.loadSounds();
      this.initialized = true;
    }
  }

  private loadSounds() {
    // Create audio elements for different sounds
    const soundConfigs = [
      { key: 'like', src: '/sounds/ding.mp3' },
      { key: 'reject', src: '/sounds/pop.mp3' },
      { key: 'match', src: '/sounds/winner-game.mp3' },
      { key: 'message_sent', src: '/sounds/message-send.mp3' },
      { key: 'message_received', src: '/sounds/message-incoming.mp3' },
    ];

    soundConfigs.forEach(config => {
      const audio = new Audio(config.src);
      audio.preload = 'auto';
      audio.volume = 0.5; // Default volume
      this.sounds.set(config.key, audio);
    });
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public play(soundKey: string, volume: number = 0.5) {
    if (!this.enabled || typeof window === 'undefined') {
      console.log(`Sound ${soundKey} disabled or not in browser`);
      return;
    }

    this.ensureInitialized();

    const audio = this.sounds.get(soundKey);
    if (audio) {
      audio.volume = volume;
      audio.currentTime = 0; // Reset to beginning
      console.log(`Playing sound: ${soundKey}`);
      audio.play().catch(error => {
        console.warn(`Failed to play sound ${soundKey}:`, error);
      });
    } else {
      console.warn(`Sound not found: ${soundKey}`);
    }
  }

  // Specific sound methods
  public playLike() {
    this.play('like', 0.6);
  }

  public playReject() {
    this.play('reject', 0.4);
  }

  public playMatch() {
    this.play('match', 0.8);
  }

  public playMessageSent() {
    this.play('message_sent', 0.3);
  }

  public playMessageReceived() {
    this.play('message_received', 0.4);
  }
}

// Export singleton instance
export const soundManager = SoundManager.getInstance();
