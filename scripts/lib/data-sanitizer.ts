import { createHash } from 'crypto';

export interface SanitizationOptions {
  preserveStructure: boolean;
  preserveInternalIds: boolean;
  outputSuffix?: string;
}

export class DataSanitizer {
  private nameCounter = 0;
  private addressCounter = 0;
  private phoneCounter = 0;
  private emailCounter = 0;
  private policyCounter = 0;
  private ssnCounter = 0;
  private dobCounter = 0;
  
  // Consistent fake data pools
  private firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa', 'James', 'Mary', 'William', 'Jennifer', 'Thomas', 'Linda', 'Charles', 'Patricia'];
  private lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Anderson', 'Taylor', 'Wilson', 'Moore', 'Jackson', 'Lee'];
  private streets = ['Main St', 'Oak Ave', 'Elm St', 'Maple Dr', 'Pine Rd', 'Cedar Ln', 'Washington Blvd', 'Park Ave', 'First St', 'Second Ave'];
  private cities = ['Springfield', 'Riverside', 'Greenville', 'Madison', 'Franklin', 'Clinton', 'Georgetown', 'Salem', 'Fairview', 'Chester'];
  private states = ['CA', 'TX', 'NY', 'FL', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI'];
  
  // Patterns for sensitive data detection
  private patterns = {
    ssn: /\b\d{3}-?\d{2}-?\d{4}\b/g,
    phone: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    dob: /\b(?:0[1-9]|1[0-2])[-\/](?:0[1-9]|[12]\d|3[01])[-\/](?:19|20)\d{2}\b/g,
    creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    policyId: /\b(?:POL|POLICY|PLY|P)[-\s]?\d{6,12}\b/gi,
    memberId: /\b(?:MEM|MEMBER|MBR|M)[-\s]?\d{6,12}\b/gi,
    claimId: /\b(?:CLM|CLAIM|CL)[-\s]?\d{6,12}\b/gi,
    accountNumber: /\b(?:ACCT|ACCOUNT|ACC)[-\s]?\d{6,12}\b/gi,
    // Address pattern - simplified to catch street addresses
    address: /\b\d{1,5}\s+(?:[A-Za-z]+\s+){1,4}(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Blvd|Boulevard|Way|Pl|Place|Ct|Court)\b/gi,
  };

  // Map to maintain consistency for the same original value
  private replacementCache = new Map<string, string>();

  constructor(private options: SanitizationOptions = { preserveStructure: true, preserveInternalIds: true }) {}

  private isPersonNameField(key: string, value: any): boolean {
    if (typeof value !== 'string' || value.length === 0) {
      return false;
    }
    
    const lowerKey = key.toLowerCase();
    
    // Exclude technical field names that contain "name" but aren't person names
    const technicalNameFields = [
      'langmode', 'language', 'mode', 'env_type', 'environment', 'hostname', 
      'filename', 'pathname', 'classname', 'methodname', 'functionname',
      'username', 'keyname', 'typename', 'tagname', 'nodename', 'dirname',
      'basename', 'appname', 'servicename', 'containername', 'imagename'
    ];
    
    if (technicalNameFields.some(tech => lowerKey.includes(tech))) {
      return false;
    }
    
    // Only consider fields that are specifically for person names
    const personNameFields = [
      'firstname', 'lastname', 'fullname', 'displayname', 
      'customername', 'clientname', 'callername', 'membername',
      'patientname', 'employeename'
    ];
    
    // Check if it's explicitly a person name field
    if (personNameFields.some(person => lowerKey.includes(person))) {
      return true;
    }
    
    // For generic "name" fields, check if the value looks like a person's name
    // (contains letters, spaces, and looks like a name pattern)
    if (lowerKey === 'name' || lowerKey === 'names') {
      return this.looksLikePersonName(value);
    }
    
    return false;
  }
  
  private looksLikePersonName(value: string): boolean {
    // Check if the value looks like a person's name
    // - Contains letters and possibly spaces/apostrophes/hyphens
    // - Doesn't look like technical identifiers or codes
    const namePattern = /^[A-Za-z][A-Za-z\s\'\-\.]*[A-Za-z]$/;
    const technicalPattern = /^[a-z]+[A-Z]/; // camelCase
    const codePattern = /[_\-]{2,}|^\d+|[0-9]{3,}/; // underscores, numbers
    
    return namePattern.test(value) && 
           !technicalPattern.test(value) && 
           !codePattern.test(value) &&
           value.length > 1 && 
           value.length < 50; // reasonable name length
  }

  private hashString(str: string): string {
    return createHash('md5').update(str).digest('hex').substring(0, 8);
  }

  private getConsistentReplacement(original: string, type: string): string {
    const cacheKey = `${type}:${original}`;
    if (this.replacementCache.has(cacheKey)) {
      return this.replacementCache.get(cacheKey)!;
    }

    let replacement: string;
    const hash = this.hashString(original);
    const index = parseInt(hash, 16);

    switch (type) {
      case 'name':
        const firstName = this.firstNames[index % this.firstNames.length];
        const lastName = this.lastNames[(index >> 4) % this.lastNames.length];
        replacement = `${firstName} ${lastName}`;
        break;
      case 'email':
        const fName = this.firstNames[index % this.firstNames.length].toLowerCase();
        const lName = this.lastNames[(index >> 4) % this.lastNames.length].toLowerCase();
        replacement = `${fName}.${lName}@example.com`;
        break;
      case 'phone':
        const areaCode = 200 + (index % 800);
        const prefix = 200 + ((index >> 8) % 800);
        const lineNumber = 1000 + ((index >> 16) % 9000);
        replacement = `(${areaCode}) ${prefix}-${lineNumber}`;
        break;
      case 'ssn':
        const ssnPart1 = 100 + (index % 899);
        const ssnPart2 = 10 + ((index >> 8) % 89);
        const ssnPart3 = 1000 + ((index >> 16) % 9000);
        replacement = `${ssnPart1}-${ssnPart2}-${ssnPart3}`;
        break;
      case 'dob':
        const year = 1950 + (index % 50);
        const month = 1 + (index % 12);
        const day = 1 + (index % 28);
        replacement = `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
        break;
      case 'address':
        const streetNum = 100 + (index % 9900);
        const street = this.streets[index % this.streets.length];
        const city = this.cities[(index >> 8) % this.cities.length];
        const state = this.states[(index >> 16) % this.states.length];
        const zip = 10000 + (index % 89999);
        replacement = `${streetNum} ${street}, ${city}, ${state} ${zip}`;
        break;
      case 'policyId':
        replacement = `POL-${1000000 + (index % 9000000)}`;
        break;
      case 'memberId':
        replacement = `MEM-${1000000 + (index % 9000000)}`;
        break;
      case 'claimId':
        replacement = `CLM-${1000000 + (index % 9000000)}`;
        break;
      case 'accountNumber':
        replacement = `ACCT-${1000000 + (index % 9000000)}`;
        break;
      case 'creditCard':
        replacement = `4111-1111-1111-${1000 + (index % 9000)}`;
        break;
      default:
        replacement = `[REDACTED-${type.toUpperCase()}]`;
    }

    this.replacementCache.set(cacheKey, replacement);
    return replacement;
  }

  private sanitizeHexEncodedData(hexString: string): string {
    try {
      // Decode hex to string
      const decoded = Buffer.from(hexString, 'hex').toString('utf-8');
      
      // Parse as JSON if possible
      let data: any;
      try {
        data = JSON.parse(decoded);
      } catch {
        // If not JSON, just sanitize as string (but avoid recursion)
        const sanitized = this.sanitizeStringInternal(decoded, false);
        return Buffer.from(sanitized).toString('hex');
      }
      
      // Sanitize phone numbers in DNIS and ANI fields
      if (data.DNIS) {
        // DNIS is typically just 10 digits
        const hash = this.hashString(data.DNIS);
        const index = parseInt(hash, 16);
        const areaCode = 200 + (index % 800);
        const prefix = 200 + ((index >> 8) % 800);
        const lineNumber = 1000 + ((index >> 16) % 9000);
        data.DNIS = `${areaCode}${prefix}${lineNumber}`;
      }
      
      if (data.ANI) {
        // ANI includes country code format with + prefix
        const hash = this.hashString(data.ANI);
        const index = parseInt(hash, 16);
        const countryCode = '1'; // US country code
        const areaCode = 200 + (index % 800);
        const prefix = 200 + ((index >> 8) % 800);
        const lineNumber = 1000 + ((index >> 16) % 9000);
        data.ANI = `+${countryCode}${areaCode}${prefix}${lineNumber}`;
      }
      
      // Sanitize any other fields that might contain sensitive data
      for (const key in data) {
        if (typeof data[key] === 'string' && 
            !['DNIS', 'ANI', 'XIninCnv'].includes(key) && 
            !key.toLowerCase().includes('id')) {
          // Don't process hex strings again to avoid recursion
          data[key] = this.sanitizeStringInternal(data[key], false);
        }
      }
      
      // Re-encode to hex
      return Buffer.from(JSON.stringify(data)).toString('hex');
    } catch (error) {
      // If decoding fails, return original
      return hexString;
    }
  }

  private sanitizeString(text: string): string {
    return this.sanitizeStringInternal(text, true);
  }

  private sanitizeStringInternal(text: string, processHex: boolean = true): string {
    if (!text || typeof text !== 'string') return text;

    let sanitized = text;

    // First, handle hex-encoded data in User-to-User headers and similar fields
    // Look for hex strings that might contain encoded JSON with phone numbers
    if (processHex) {
      const hexPattern = /\b[0-9a-fA-F]{100,}\b/g;
      sanitized = sanitized.replace(hexPattern, (match) => {
        // Check if this looks like hex-encoded JSON with DNIS/ANI
        if (match.length % 2 === 0) {
          try {
            const decoded = Buffer.from(match, 'hex').toString('utf-8');
            if (decoded.includes('DNIS') || decoded.includes('ANI')) {
              return this.sanitizeHexEncodedData(match);
            }
          } catch {
            // Not valid hex or not containing phone data
          }
        }
        return match;
      });
    }

    // Replace SSNs
    sanitized = sanitized.replace(this.patterns.ssn, (match) => 
      this.getConsistentReplacement(match, 'ssn'));

    // Replace phone numbers
    sanitized = sanitized.replace(this.patterns.phone, (match) => 
      this.getConsistentReplacement(match, 'phone'));

    // Replace email addresses
    sanitized = sanitized.replace(this.patterns.email, (match) => 
      this.getConsistentReplacement(match, 'email'));

    // Replace dates of birth
    sanitized = sanitized.replace(this.patterns.dob, (match) => 
      this.getConsistentReplacement(match, 'dob'));

    // Replace credit card numbers
    sanitized = sanitized.replace(this.patterns.creditCard, (match) => 
      this.getConsistentReplacement(match, 'creditCard'));

    // Replace policy IDs
    sanitized = sanitized.replace(this.patterns.policyId, (match) => 
      this.getConsistentReplacement(match, 'policyId'));

    // Replace member IDs
    sanitized = sanitized.replace(this.patterns.memberId, (match) => 
      this.getConsistentReplacement(match, 'memberId'));

    // Replace claim IDs (only if not preserving internal IDs)
    if (!this.options.preserveInternalIds) {
      sanitized = sanitized.replace(this.patterns.claimId, (match) => 
        this.getConsistentReplacement(match, 'claimId'));
    }

    // Replace account numbers
    sanitized = sanitized.replace(this.patterns.accountNumber, (match) => 
      this.getConsistentReplacement(match, 'accountNumber'));

    // Replace addresses
    sanitized = sanitized.replace(this.patterns.address, (match) => {
      const streetNum = match.match(/^\d+/)?.[0] || '123';
      const index = parseInt(this.hashString(match), 16);
      const street = this.streets[index % this.streets.length];
      return `${streetNum} ${street}`;
    });

    // Look for name patterns in common fields
    const namePatterns = [
      /\b(?:my name is|i am|this is|caller:?|customer:?|member:?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/gi,
      /\b(?:Mr\.|Mrs\.|Ms\.|Dr\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/g,
    ];

    for (const pattern of namePatterns) {
      sanitized = sanitized.replace(pattern, (match, name) => {
        const replacement = this.getConsistentReplacement(name, 'name');
        return match.replace(name, replacement);
      });
    }

    return sanitized;
  }

  public sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    if (typeof obj === 'object') {
      const sanitized: any = {};
      
      for (const [key, value] of Object.entries(obj)) {
        // Preserve internal IDs if specified
        if (this.options.preserveInternalIds && 
            (key.toLowerCase().includes('sessionid') || 
             key.toLowerCase().includes('callid') ||
             key.toLowerCase().includes('conversationid') ||
             key.toLowerCase().includes('messageid') ||
             key === 'id' ||
             key === '_id')) {
          sanitized[key] = value;
        } else {
          // Special handling for known sensitive fields
          const lowerKey = key.toLowerCase();
          if (this.isPersonNameField(key, value)) {
            sanitized[key] = this.getConsistentReplacement(value, 'name');
          } else if (lowerKey.includes('email') && typeof value === 'string' && value.includes('@')) {
            sanitized[key] = this.getConsistentReplacement(value, 'email');
          } else if (lowerKey.includes('phone') && typeof value === 'string') {
            sanitized[key] = this.getConsistentReplacement(value, 'phone');
          } else if (lowerKey.includes('ssn') && typeof value === 'string') {
            sanitized[key] = this.getConsistentReplacement(value, 'ssn');
          } else if ((lowerKey.includes('dob') || lowerKey.includes('birth')) && typeof value === 'string') {
            sanitized[key] = this.getConsistentReplacement(value, 'dob');
          } else if (lowerKey.includes('address') && typeof value === 'string') {
            sanitized[key] = this.getConsistentReplacement(value, 'address');
          } else {
            sanitized[key] = this.sanitizeObject(value);
          }
        }
      }
      
      return sanitized;
    }

    return obj;
  }

  public getSanitizationStats() {
    return {
      totalReplacements: this.replacementCache.size,
      byType: {
        names: [...this.replacementCache.keys()].filter(k => k.startsWith('name:')).length,
        emails: [...this.replacementCache.keys()].filter(k => k.startsWith('email:')).length,
        phones: [...this.replacementCache.keys()].filter(k => k.startsWith('phone:')).length,
        ssns: [...this.replacementCache.keys()].filter(k => k.startsWith('ssn:')).length,
        policyIds: [...this.replacementCache.keys()].filter(k => k.startsWith('policyId:')).length,
        addresses: [...this.replacementCache.keys()].filter(k => k.startsWith('address:')).length,
        creditCards: [...this.replacementCache.keys()].filter(k => k.startsWith('creditCard:')).length,
      }
    };
  }
}