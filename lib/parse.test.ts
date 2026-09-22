import { expect, test, describe } from 'vitest';
import { parseRegistrationText, dedupeParsedEntries } from './parse';

describe('parseRegistrationText', () => {
  test('parses simple numbered list with names and phones', () => {
    const raw = `
      1. John Doe - 0712345678
      2. Jane Smith +254 723 456 789
      3. Bob 0111222333
    `;
    const result = parseRegistrationText(raw);
    expect(result.skipped).toHaveLength(0);
    expect(result.entries).toHaveLength(3);
    
    expect(result.entries[0].name).toBe('John Doe');
    expect(result.entries[0].phoneCanonical).toBe('254712345678');
    
    expect(result.entries[1].name).toBe('Jane Smith');
    expect(result.entries[1].phoneCanonical).toBe('254723456789');
    
    expect(result.entries[2].name).toBe('Bob');
    expect(result.entries[2].phoneCanonical).toBe('254111222333');
  });

  test('skips boilerplate headers', () => {
    const raw = `
      FREE TRANSPORT TO NAKURU
      Read more...
      1. John - 0712345678
    `;
    const result = parseRegistrationText(raw);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].name).toBe('John');
  });

  test('handles messy unicode and weird formatting', () => {
    const raw = `
      O1) Máry—0712 345 678
      371. Pst. James_0722123456
    `;
    const result = parseRegistrationText(raw);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].name).toBe('Mary'); // Diacritics are stripped
    expect(result.entries[1].name).toBe('Pst. James');
  });

  test('flags entries without phones for review', () => {
    const raw = `
      1. John Doe
      2. Jane 0711122233
    `;
    const result = parseRegistrationText(raw);
    expect(result.entries).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toBe('no_phone_found');
    expect(result.skipped[0].rawText).toBe('1. John Doe');
  });
});

describe('dedupeParsedEntries', () => {
  test('deduplicates within a single paste', () => {
    const entries = [
      { name: 'John', phoneRaw: '0711111111', phoneCanonical: '254711111111', lineNumber: 1 },
      { name: 'John Doe', phoneRaw: '+254711111111', phoneCanonical: '254711111111', lineNumber: 2 }
    ];
    
    const result = dedupeParsedEntries(entries);
    expect(result.unique).toHaveLength(1);
    expect(result.duplicatesWithinPaste).toHaveLength(1);
    expect(result.unique[0].name).toBe('John');
  });
});
