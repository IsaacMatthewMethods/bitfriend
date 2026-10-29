// Audio synthesizer and voice receipts in Hausa and English

class SoundController {
  private audioCtx: AudioContext | null = null;
  public enabled: boolean = true;

  private initCtx() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // Play satisfying Bitcoin payment chime (dual frequency arpeggio)
  playPaymentChime() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      // Chime notes: F5 -> A5 -> C6 (Joyful major chord)
      osc1.frequency.setValueAtTime(698.46, now); // F5
      osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.1); // A5
      osc1.frequency.exponentialRampToValueAtTime(1046.50, now + 0.22); // C6

      osc2.frequency.setValueAtTime(349.23, now); // F4 sub-tone
      osc2.frequency.exponentialRampToValueAtTime(523.25, now + 0.22); // C5

      gainNode.gain.setValueAtTime(0.01, now);
      gainNode.gain.linearRampToValueAtTime(0.35, now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.7);
      osc2.stop(now + 0.7);
    } catch (e) {
      console.warn('Audio chime error:', e);
    }
  }

  // Play subtle click / button feedback
  playClick() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.audioCtx) return;
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {
      console.warn(e);
    }
  }

  // Speak aloud the payment receipt in Hausa or English
  speakReceipt(amountSats: number, language: 'en' | 'ha') {
    if (!this.enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    try {
      window.speechSynthesis.cancel(); // Stop any pending speech

      let textToSpeak = '';
      let langCode = 'en-US';

      if (language === 'ha') {
        // Phonetically optimized Hausa for speech synthesis engines
        textToSpeak = `An karɓi satoshi ${amountSats} cikin nasara!`;
        langCode = 'ha-NG';
      } else {
        textToSpeak = `Payment of ${amountSats} satoshis received successfully!`;
        langCode = 'en-US';
      }

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 1.0;
      utterance.pitch = 1.05;
      utterance.lang = langCode;

      // Small delay after chime
      setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 450);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }
}

export const soundController = new SoundController();
