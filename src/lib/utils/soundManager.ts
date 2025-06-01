export class SoundManager {
    private sounds: Map<string, HTMLAudioElement> = new Map();
    private enabled: boolean = true;
  
    constructor() {
      // Try to load sound preference from localStorage
      const soundPref = localStorage.getItem('ergoChat_soundEnabled');
      if (soundPref !== null) {
        this.enabled = soundPref === 'true';
      }
    }
  
    /**
     * Load a sound file and store it with a key
     */
    public loadSound(key: string, url: string): void {
      const audio = new Audio(url);
      audio.preload = 'auto';
      this.sounds.set(key, audio);
    }
  
    /**
     * Play a sound by its key
     */
    public play(key: string): void {
      if (!this.enabled) return;
      
      const sound = this.sounds.get(key);
      if (sound) {
        // Create a clone to allow overlapping sounds
        const clone = sound.cloneNode() as HTMLAudioElement;
        clone.volume = 0.5; // Set volume to 50%
        clone.play().catch(err => console.warn('Error playing sound:', err));
      }
    }
  
    /**
     * Toggle sound on/off
     */
    public toggleSound(): boolean {
      this.enabled = !this.enabled;
      localStorage.setItem('ergoChat_soundEnabled', this.enabled.toString());
      return this.enabled;
    }
  
    /**
     * Check if sound is enabled
     */
    public isSoundEnabled(): boolean {
      return this.enabled;
    }
  }
  
  // Create a singleton instance
  export const soundManager = new SoundManager();