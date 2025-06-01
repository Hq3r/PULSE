// ProfanityFilter.js - A simple utility to filter profanity in chat messages

// Common profanity list - can be expanded as needed
const DEFAULT_PROFANITY_LIST = [
    'fuck', 'shit', 'ass', 'bitch', 'cunt', 'dick', 'piss', 
    'bastard', 'damn', 'crap', 'cock', 'pussy', 'asshole',
    'whore', 'slut', 'retard', 'faggot', 'nigger', 'twat'
  ];
  
  // Patterns to detect obfuscated profanity (like f*ck, sh!t, etc.)
  const OBFUSCATION_PATTERNS = [
    { word: 'fuck', pattern: /f+[\*\$\@\!\#\_\-]+c+[\*\$\@\!\#\_\-]*k+/i },
    { word: 'shit', pattern: /s+[\*\$\@\!\#\_\-]+h+[\*\$\@\!\#\_\-]*i+[\*\$\@\!\#\_\-]*t+/i },
    { word: 'ass', pattern: /a+[\*\$\@\!\#\_\-]+s+[\*\$\@\!\#\_\-]*s+/i },
    { word: 'bitch', pattern: /b+[\*\$\@\!\#\_\-]+i+[\*\$\@\!\#\_\-]*t+[\*\$\@\!\#\_\-]*c+[\*\$\@\!\#\_\-]*h+/i }
  ];
  
  /**
   * ProfanityFilter class to detect and mask bad words
   */
  export class ProfanityFilter {
    /**
     * Create a new profanity filter
     * @param {string[]} customList - Optional custom list of profanity to use
     * @param {string} replacement - Replacement character(s) for filtered words
     */
    constructor(customList = null, replacement = '***') {
      this.profanityList = customList || DEFAULT_PROFANITY_LIST;
      this.replacement = replacement;
      this.enabled = true;
      
      // Create regex with word boundaries to match whole words only
      this.updateRegex();
    }
    
    /**
     * Update the regex patterns used for filtering
     */
    updateRegex() {
      // Create a regex that matches full words only
      const wordsPattern = this.profanityList
        .map(word => `\\b${word}\\b`)
        .join('|');
        
      this.regex = new RegExp(wordsPattern, 'gi');
    }
    
    /**
     * Set custom profanity list
     * @param {string[]} list - Array of words to filter
     */
    setProfanityList(list) {
      if (Array.isArray(list)) {
        this.profanityList = list;
        this.updateRegex();
      }
    }
    
    /**
     * Add words to the profanity list
     * @param {string|string[]} words - Word or array of words to add
     */
    addWords(words) {
      if (typeof words === 'string') {
        if (!this.profanityList.includes(words)) {
          this.profanityList.push(words);
        }
      } else if (Array.isArray(words)) {
        for (const word of words) {
          if (typeof word === 'string' && !this.profanityList.includes(word)) {
            this.profanityList.push(word);
          }
        }
      }
      this.updateRegex();
    }
    
    /**
     * Remove words from the profanity list
     * @param {string|string[]} words - Word or array of words to remove
     */
    removeWords(words) {
      if (typeof words === 'string') {
        this.profanityList = this.profanityList.filter(w => w !== words);
      } else if (Array.isArray(words)) {
        this.profanityList = this.profanityList.filter(w => !words.includes(w));
      }
      this.updateRegex();
    }
    
    /**
     * Enable or disable the filter
     * @param {boolean} enabled - Whether the filter is enabled
     */
    setEnabled(enabled) {
      this.enabled = !!enabled;
    }
    
    /**
     * Set the replacement string for censored words
     * @param {string} replacement - String to replace profanity with
     */
    setReplacement(replacement) {
      this.replacement = replacement;
    }
    
    /**
     * Filter profanity in a string
     * @param {string} text - Text to filter
     * @returns {string} - Filtered text
     */
    filter(text) {
      if (!this.enabled || !text) {
        return text;
      }
      
      // First, filter using regular word list
      let filteredText = text.replace(this.regex, this.replacement);
      
      // Then check for obfuscated patterns
      for (const {word, pattern} of OBFUSCATION_PATTERNS) {
        filteredText = filteredText.replace(pattern, this.replacement);
      }
      
      return filteredText;
    }
    
    /**
     * Check if text contains profanity
     * @param {string} text - Text to check
     * @returns {boolean} - True if profanity is found
     */
    containsProfanity(text) {
      if (!text) return false;
      return this.regex.test(text) || OBFUSCATION_PATTERNS.some(({pattern}) => pattern.test(text));
    }
  }
  
  // Create and export a singleton instance
  export const profanityFilter = new ProfanityFilter();
  
  // Export default for convenience
  export default profanityFilter;