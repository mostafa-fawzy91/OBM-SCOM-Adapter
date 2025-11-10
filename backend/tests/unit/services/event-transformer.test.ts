import { eventTransformer } from '@/services/event-transformer.service';
import type { ScomEvent } from '@/types/events';

const baseEvent: ScomEvent = {
  eventId: '1',
  name: 'Test Event',
  severity: 'Critical',
  description: 'Description',
  receivedAt: new Date().toISOString(),
};

describe('EventTransformerService', () => {
  it('maps severity and core fields', () => {
    const [transformed] = eventTransformer.transform([baseEvent]);
    expect(transformed.event.title).toBe('Test Event');
    expect(transformed.event.severity).toBe('critical');
    expect(transformed.event.source).toBe('SCOM');
  });

  it('truncates descriptions longer than limit', () => {
    const event: ScomEvent = {
      ...baseEvent,
      description: 'x'.repeat(1100),
    };
    const [transformed] = eventTransformer.transform([event]);
    expect(transformed.event.description.length).toBeLessThanOrEqual(1000);
  });

  it('preserves custom fields', () => {
    const event: ScomEvent = {
      ...baseEvent,
      customFields: { extra: 'value' },
    };
    const [transformed] = eventTransformer.transform([event]);
    expect(transformed.event.customAttributes?.extra).toBe('value');
  });
});

