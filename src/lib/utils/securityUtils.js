// src/lib/utils/securityUtils.js - Dedicated security utilities

/**
 * Sanitize message content before sending to prevent XSS attacks
 * @param {string} content - Raw message content from user input
 * @returns {string} - Sanitized content safe for blockchain storage
 */
export function sanitizeBeforeSend(content) {
  if (!content || typeof content !== 'string') return '';
  
  return content
    // Remove script tags and content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove iframe tags and content
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    // Remove object/embed tags
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    // Remove link tags that could load external resources
    .replace(/<link\b[^<]*(?:(?!<\/link>)<[^<]*)*<\/link>/gi, '')
    // Remove dangerous protocols
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/file:/gi, '')
    // Remove event handlers (onclick, onload, etc.)
    .replace(/on\w+\s*=/gi, '')
    // Remove style attributes that could contain CSS expressions
    .replace(/style\s*=\s*["'][^"']*["']/gi, '')
    // Remove form-related tags
    .replace(/<\/?form\b[^>]*>/gi, '')
    .replace(/<\/?input\b[^>]*>/gi, '')
    .replace(/<\/?textarea\b[^>]*>/gi, '')
    .replace(/<\/?select\b[^>]*>/gi, '')
    .replace(/<\/?option\b[^>]*>/gi, '')
    // Remove meta and base tags
    .replace(/<\/?meta\b[^>]*>/gi, '')
    .replace(/<\/?base\b[^>]*>/gi, '')
    // Remove dangerous HTML tags, keep only safe formatting
    .replace(/<(?!\/?(b|i|em|strong|u|br|p|div|span)\b)[^>]*>/gi, '')
    // Remove any remaining HTML comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Trim whitespace
    .trim();
}

/**
 * Sanitize content for display (after receiving from blockchain)
 * This is more permissive than sanitizeBeforeSend as it allows safe HTML formatting
 * @param {string} content - Content received from blockchain
 * @returns {string} - Sanitized content safe for display
 */
export function sanitizeForDisplay(content) {
  if (!content || typeof content !== 'string') return '';
  
  // For extra security, you might want to use DOMPurify here
  // import DOMPurify from 'dompurify';
  // return DOMPurify.sanitize(content, { ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'br'] });
  
  return content
    // Remove dangerous scripts
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    // Remove dangerous protocols
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    // Remove event handlers
    .replace(/on\w+\s*=/gi, '')
    // Allow only basic formatting tags
    .replace(/<(?!\/?(b|i|em|strong|u|br|p|a)\b)[^>]*>/gi, '');
}

/**
 * Validate and sanitize URLs for safe linking
 * @param {string} url - URL to validate
 * @returns {string|null} - Safe URL or null if invalid
 */
export function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return null;
  
  try {
    const urlObj = new URL(url);
    
    // Only allow HTTP and HTTPS protocols
    if (urlObj.protocol === 'https:' || urlObj.protocol === 'http:') {
      return urlObj.href;
    }
  } catch (e) {
    // Invalid URL
  }
  
  return null;
}

/**
 * Check if content contains potentially dangerous patterns
 * @param {string} content - Content to check
 * @returns {boolean} - True if content appears safe
 */
export function isContentSafe(content) {
  if (!content || typeof content !== 'string') return true;
  
  const dangerousPatterns = [
    /<script\b/i,
    /<iframe\b/i,
    /javascript:/i,
    /vbscript:/i,
    /data:/i,
    /on\w+\s*=/i,
    /<object\b/i,
    /<embed\b/i,
    /<form\b/i
  ];
  
  return !dangerousPatterns.some(pattern => pattern.test(content));
}

/**
 * Generate Content Security Policy for the application
 * @returns {string} - CSP header value
 */
export function generateCSP() {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.ergoplatform.com https://ergochats.vercel.app",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'"
  ].join('; ');
}