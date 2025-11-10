import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ScomXmlParser } from '@/services/scom-xml-parser.service';

describe('ScomXmlParser', () => {
  const parser = new ScomXmlParser();
  const xml = readFileSync(
    join(process.cwd(), 'tests/__fixtures__/sample-events.xml'),
    'utf-8'
  );

  it('parses multiple SCOM events', async () => {
    const events = await parser.parse(xml, { sourceFile: 'sample.xml' });
    expect(events).toHaveLength(2);
    expect(events[0].name).toBe('Server Down');
    expect(events[0].severity).toBe('Critical');
    expect(events[0].netbiosComputerName).toBe('HOST01');
    expect(events[0].receivedAt).toBeDefined();
  });

  it('sanitizes description length', async () => {
    const longDescription = '<scom_event_message><Name>A</Name><Severity>Warning</Severity><Description>' +
      'x'.repeat(2000) +
      '</Description></scom_event_message>';
    const events = await parser.parse(longDescription);
    expect(events[0].description).toHaveLength(1000);
  });

  it('returns empty array for invalid XML', async () => {
    await expect(parser.parse('<invalid>')).rejects.toThrow(/XML parsing error/);
  });
});

