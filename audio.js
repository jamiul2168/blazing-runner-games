// audio.js
const ASSET_PATH = 'assets/';

export class SoundManager {
    constructor() {
        this.jumpSound = this.loadSound('jump.mp3'); 
        this.gameOverSound = this.loadSound('game_over.mp3'); 
        // boost.mp3 ফাইলটি বাদ দেওয়া হয়েছে, কিন্তু কোড আর্কিটেকচার ঠিক রাখার জন্য একটি ডামি ফাংশন রাখা হয়েছে
        this.boostSound = { play: () => console.warn("Boost sound not available.") };
    }

    loadSound(filename) {
        try {
            const audio = new Audio(ASSET_PATH + filename);
            audio.preload = 'auto'; 
            return audio;
        } catch (e) {
            console.error(`Failed to load audio: ${filename}`, e);
            return { play: () => console.warn(`Sound file not available: ${filename}`) };
        }
    }

    playSound(audioElement) {
        if (audioElement && audioElement.src) {
            audioElement.currentTime = 0; 
            audioElement.play().catch(e => {
                console.warn("Sound playback blocked by browser policy. Try interacting first.", e);
            });
        }
    }

    playJump() { this.playSound(this.jumpSound); }
    playGameOver() { this.playSound(this.gameOverSound); }
    playBoost() { this.boostSound.play(); } // ডামি ফাংশন কল করা হলো
}
