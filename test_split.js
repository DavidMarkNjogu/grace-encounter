const text = `682 .mayaka samwuel 
 0715 791021.         383. Shem Edward+254 701 251561`;

// Normalize spaces
const flat = text.replace(/\r?\n/g, ' ');

// Split by looking for "number dot" pattern
// A pattern is an optional space, 1-4 digits, optional space, dot/colon/parenthesis
const parts = flat.split(/(?=\b\d{1,4}\s*[.):-]\s*[a-zA-Z])/);

console.log(parts);
