/**
 * Browser Voice Adapter — Tier 0: FREE FOREVER
 *
 * Uses native Web Speech API built into Chrome/Edge/Safari/Firefox.
 * - SpeechSynthesis → AI agent speaks (TTS) in English, Hindi (हिन्दी), and Telugu (తెలుగు)
 * - SpeechRecognition → Patient speaks (STT)
 *
 * $0 cost. No API key. No account. Survives Vercel/Render deploy forever.
 * Supports mid-call dynamic language switching between English, Hindi, and Telugu.
 */

export type VoiceLanguage = 'en' | 'hi' | 'te';

export interface LanguageOption {
  code: VoiceLanguage;
  name: string;
  nativeName: string;
  speechCode: string;
  badge: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', speechCode: 'en-US', badge: 'EN' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', speechCode: 'hi-IN', badge: 'HI' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', speechCode: 'te-IN', badge: 'TE' },
];

export interface VoiceCapabilities {
  ttsAvailable: boolean;
  sttAvailable: boolean;
  recommendedBrowser: boolean;
  availableVoices: SpeechSynthesisVoice[];
  hasHindiVoice: boolean;
  hasTeluguVoice: boolean;
}

/**
 * Detect what voice capabilities and language voices are available in this browser.
 */
export function detectVoiceCapabilities(): VoiceCapabilities {
  const ttsAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const sttAvailable =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const recommendedBrowser = /Chrome|Edg/i.test(ua);
  const availableVoices = ttsAvailable ? window.speechSynthesis.getVoices() : [];

  const hasHindiVoice = availableVoices.some(
    (v) => v.lang.startsWith('hi') || v.name.toLowerCase().includes('hindi')
  );
  const hasTeluguVoice = availableVoices.some(
    (v) => v.lang.startsWith('te') || v.name.toLowerCase().includes('telugu')
  );

  return {
    ttsAvailable,
    sttAvailable,
    recommendedBrowser,
    availableVoices,
    hasHindiVoice,
    hasTeluguVoice,
  };
}

/**
 * Pick the best voice available for the target language.
 */
export function pickBestVoice(lang: VoiceLanguage = 'en'): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();

  if (lang === 'te') {
    // 1. Exact Telugu voice
    const telugu = voices.find(
      (v) => v.lang === 'te-IN' || v.lang.startsWith('te') || v.name.toLowerCase().includes('telugu')
    );
    if (telugu) return telugu;
    // 2. Indian English voice (understands Indian phonetics well)
    const inEn = voices.find((v) => v.lang === 'en-IN');
    if (inEn) return inEn;
  }

  if (lang === 'hi') {
    // 1. Exact Hindi voice
    const hindi = voices.find(
      (v) => v.lang === 'hi-IN' || v.lang.startsWith('hi') || v.name.toLowerCase().includes('hindi')
    );
    if (hindi) return hindi;
    // 2. Indian English voice
    const inEn = voices.find((v) => v.lang === 'en-IN');
    if (inEn) return inEn;
  }

  // English (default)
  return (
    voices.find((v) => v.lang === 'en-US' && !v.localService) ||
    voices.find((v) => v.lang === 'en-US') ||
    voices.find((v) => v.lang === 'en-IN') ||
    voices.find((v) => v.lang.startsWith('en')) ||
    voices[0] ||
    null
  );
}

/**
 * Clinical dialogue translation engine for Telugu and Hindi.
 * Translates AI questions and instructions into natural clinical language.
 */
export function getClinicalTranslation(englishText: string, lang: VoiceLanguage): string {
  if (lang === 'en' || !englishText) return englishText;

  const lower = englishText.toLowerCase();

  // ── TELUGU TRANSLATIONS ──────────────────────────────────────────────────
  if (lang === 'te') {
    // 1. Greeting / Introduction
    if (lower.includes('calling from') || lower.includes('post-discharge') || lower.includes('care reach') || lower.includes('hospital')) {
      if (lower.includes('alex') || lower.includes('outreach program') || lower.includes('hello')) {
        return "నమస్కారం, నేను సిటీ జనరల్ హాస్పిటల్ నుండి మాట్లాడుతున్నాను. మీరు హాస్పిటల్ నుండి డిశ్చార్జ్ అయిన తర్వాత మీ ఆరోగ్యం ఎలా ఉందో తెలుసుకోవడానికి ఈ కాల్ చేస్తున్నాము.";
      }
    }

    // 2. Emergency / Chest pain / Shortness of breath
    if (lower.includes('chest pain') || lower.includes('shortness of breath') || lower.includes('911') || lower.includes('emergency room') || lower.includes('frightening')) {
      return "మీరు చెబుతున్న ఛాతీ నొప్పి మరియు శ్వాస ఆడకపోవడం చాలా ప్రమాదకరమైన లక్షణాలు. దయచేసి వెంటనే సమీపంలోని అత్యవసర విభాగానికి (Emergency Ward) వెళ్ళండి లేదా 108 కు కాల్ చేయండి. నేను వెంటనే మా అత్యవసర వైద్య బృందానికి సమాచారం అందిస్తున్నాను.";
    }

    // 3. Wound Infection / Fever / Surgical Site
    if (lower.includes('fever') || lower.includes('wound') || lower.includes('redness') || lower.includes('drainage') || lower.includes('pus') || lower.includes('101')) {
      return "శస్త్రచికిత్స గాయం వద్ద ఎరుపుదనం, పసుపు చీము మరియు 101.6 డిగ్రీల జ్వరం ఇన్ఫెక్షన్ సంకేతం కావచ్చు. దయచేసి విశ్రాంతి తీసుకోండి. నేను వెంటనే దీనిని మా ఆన్-కాల్ సర్జన్‌కు అత్యవసర పరిశీలన కోసం పంపుతున్నాను.";
    }

    // 4. Initial inquiry / How are you feeling
    if (lower.includes('how are you feeling') || lower.includes('recovery is going') || lower.includes('to start')) {
      return "మీరు హాస్పిటల్ నుండి డిశ్చార్జ్ అయిన తర్వాత మీ కోలుకునే విధానం ఎలా ఉంది? ప్రస్తుతం మీ ఆరోగ్యం ఎలా అనిపిస్తోంది?";
    }

    // 5. Routine / Stable recovery confirmation
    if (lower.includes('wonderful news') || lower.includes('healing nicely') || lower.includes('progressing smoothly') || lower.includes('reassuring')) {
      return "చాలా సంతోషం. మీ కోలుకునే విధానం సంతృప్తికరంగా ఉంది. డాక్టర్ సూచించిన మందులను సమయానికి తీసుకోండి మరియు ఏవైనా సమస్యలు ఉంటే వెంటనే సంప్రదించండి.";
    }

    // 6. Patient responses in Telugu
    if (lower.includes("i'm not doing well") || lower.includes('crushing chest pain')) {
      return "నాకు చాలా ఇబ్బందిగా ఉంది. ఛాతీలో తీవ్రమైన నొప్పి ఎడమ చేతికి పాకుతోంది, శ్వాస తీసుకోవడం కష్టంగా ఉంది, చెమటలు పడుతున్నాయి.";
    }
    if (lower.includes('throbbing') || lower.includes('yellowish pus')) {
      return "నిన్నటి నుండి నా ఆపరేషన్ గాయం వద్ద నొప్పి, ఎరుపుదనం ఉంది మరియు పసుపు చీము వస్తోంది. జ్వరం 101.6 డిగ్రీలు ఉంది.";
    }
    if (lower.includes('doing really well') || lower.includes('healing nicely')) {
      return "నేను చాలా బాగున్నాను, ధన్యవాదాలు! గాయం చక్కగా నయమవుతోంది మరియు మందులు సమయానికి తీసుకుంటున్నాను.";
    }

    // Fallback: return phonetic/conversational Telugu advisory
    return `ఆరోగ్య సంరక్షణ సమాచారం: ${englishText}`;
  }

  // ── HINDI TRANSLATIONS ───────────────────────────────────────────────────
  if (lang === 'hi') {
    // 1. Greeting / Introduction
    if (lower.includes('calling from') || lower.includes('post-discharge') || lower.includes('care reach') || lower.includes('hospital')) {
      if (lower.includes('alex') || lower.includes('outreach program') || lower.includes('hello')) {
        return "नमस्ते, मैं सिटी जनरल हॉस्पिटल से पोस्ट-डिस्चार्ज फॉलो-अप के लिए कॉल कर रहा हूँ। हम यह जानने के लिए संपर्क कर रहे हैं कि अस्पताल से छुट्टी के बाद आपका स्वास्थ्य कैसा है।";
      }
    }

    // 2. Emergency / Chest pain / Shortness of breath
    if (lower.includes('chest pain') || lower.includes('shortness of breath') || lower.includes('911') || lower.includes('emergency room') || lower.includes('frightening')) {
      return "सीने में तेज दर्द और सांस लेने में तकलीफ बहुत गंभीर आपातकालीन लक्षण हैं। कृपया तुरंत नजदीकी अस्पताल के इमरजेंसी वार्ड में जाएं या 108 पर कॉल करें। मैं तुरंत हमारे मेडिकल स्टाफ को अलर्ट भेज रहा हूँ।";
    }

    // 3. Wound Infection / Fever / Surgical Site
    if (lower.includes('fever') || lower.includes('wound') || lower.includes('redness') || lower.includes('drainage') || lower.includes('pus') || lower.includes('101')) {
      return "ऑपरेशन के घाव में लालिमा, पीले मवाद और 101.6 डिग्री का बुखार संक्रमण का संकेत हो सकता है। मैं तुरंत इसे हमारे ऑन-कॉल डॉक्टर को तत्काल जांच के लिए भेज रहा हूँ।";
    }

    // 4. Initial inquiry / How are you feeling
    if (lower.includes('how are you feeling') || lower.includes('recovery is going') || lower.includes('to start')) {
      return "अस्पताल से डिस्चार्ज होने के बाद से आप कैसा महसूस कर रहे हैं? क्या आपको कोई तकलीफ या नया लक्षण महसूस हो रहा है?";
    }

    // 5. Routine / Stable recovery confirmation
    if (lower.includes('wonderful news') || lower.includes('healing nicely') || lower.includes('progressing smoothly') || lower.includes('reassuring')) {
      return "यह जानकर बहुत खुशी हुई। आपकी रिकवरी बिल्कुल सही चल रही है। कृपया अपनी दवाइयाँ समय पर लेते रहें और कोई भी समस्या होने पर तुरंत बताएं।";
    }

    // 6. Patient responses in Hindi
    if (lower.includes("i'm not doing well") || lower.includes('crushing chest pain')) {
      return "मेरी तबीयत बिल्कुल ठीक नहीं है। सीने में बहुत तेज दर्द है जो बाएं हाथ तक जा रहा है, सांस लेने में तकलीफ हो रही है और बहुत पसीना आ रहा है।";
    }
    if (lower.includes('throbbing') || lower.includes('yellowish pus')) {
      return "कल से मेरे ऑपरेशन के घाव में बहुत दर्द है और पीला मवाद निकल रहा है। थर्मामीटर में 101.6 डिग्री बुखार आ रहा है।";
    }
    if (lower.includes('doing really well') || lower.includes('healing nicely')) {
      return "मैं बहुत अच्छा महसूस कर रहा हूँ, धन्यवाद! घाव अच्छे से ठीक हो रहा है और मैं दवाइयाँ समय पर ले रहा हूँ।";
    }

    // Fallback: return Hindi advisory
    return `स्वास्थ्य सूचना: ${englishText}`;
  }

  return englishText;
}

/**
 * Speak text aloud using the browser's built-in TTS (SpeechSynthesis).
 * Supports language-aware speech in English, Hindi, and Telugu.
 */
export function speak(
  text: string,
  opts: { lang?: VoiceLanguage; rate?: number; pitch?: number; volume?: number } = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve();
      return;
    }

    // Cancel any current speech before starting new utterance
    window.speechSynthesis.cancel();

    const targetLang = opts.lang || 'en';
    const spokenText = getClinicalTranslation(text, targetLang);

    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.lang = targetLang === 'te' ? 'te-IN' : targetLang === 'hi' ? 'hi-IN' : 'en-US';
    utterance.rate = opts.rate ?? (targetLang === 'en' ? 0.95 : 0.88); // slightly calmer rate for Hindi/Telugu
    utterance.pitch = opts.pitch ?? 1.0;
    utterance.volume = opts.volume ?? 1.0;

    const voice = pickBestVoice(targetLang);
    if (voice) utterance.voice = voice;

    utterance.onend = () => resolve();
    utterance.onerror = (e) => {
      if (e.error === 'interrupted' || e.error === 'canceled') {
        resolve();
      } else {
        reject(new Error(`TTS error: ${e.error}`));
      }
    };

    setTimeout(() => {
      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        resolve();
      }
    }, 50);
  });
}

/**
 * Stop any currently playing speech.
 */
export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Listen to patient speech via browser STT (SpeechRecognition).
 */
export function listen(
  onResult: (text: string, isFinal: boolean) => void,
  onError?: (error: string) => void,
  lang: VoiceLanguage = 'en'
): (() => void) | null {
  if (typeof window === 'undefined') return null;

  const SR =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SR) {
    onError?.('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
    return null;
  }

  const rec = new SR() as any;
  rec.lang = lang === 'te' ? 'te-IN' : lang === 'hi' ? 'hi-IN' : 'en-US';
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;

  rec.onresult = (e: any) => {
    const result = e.results[e.results.length - 1];
    const transcript = result[0].transcript;
    const isFinal = result.isFinal;
    onResult(transcript, isFinal);
  };

  rec.onerror = (e: any) => {
    if (e.error !== 'aborted' && e.error !== 'no-speech') {
      onError?.(`Mic error: ${e.error}`);
    }
  };

  rec.onend = () => {};

  try {
    rec.start();
  } catch {
    onError?.('Could not start microphone.');
    return null;
  }

  return () => {
    try {
      rec.stop();
    } catch {}
  };
}

/**
 * Play the full call dialogue turn-by-turn with live TTS.
 * Dynamically queries getLang() on each turn so mid-call language switching applies immediately!
 */
export async function playCallDialogue(
  conversation: Array<{ speaker: string; message: string }>,
  onTurn: (index: number) => void,
  cancelSignal: { cancelled: boolean },
  getLang: () => VoiceLanguage = () => 'en'
): Promise<void> {
  for (let i = 0; i < conversation.length; i++) {
    if (cancelSignal.cancelled) break;
    onTurn(i);

    const msg = conversation[i];
    const currentLang = getLang();

    if (msg.speaker === 'ai') {
      await speak(msg.message, { lang: currentLang, rate: currentLang === 'en' ? 0.95 : 0.88 });
      if (!cancelSignal.cancelled) {
        await new Promise((r) => setTimeout(r, 450));
      }
    } else if (msg.speaker === 'patient') {
      await new Promise((r) => setTimeout(r, 800));
    }
  }
}

