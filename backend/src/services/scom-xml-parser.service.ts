import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { randomUUID } from 'node:crypto';

import { configService } from '@/config/config.service';
import { logger } from '@/logger';
import type { ScomEvent } from '@/types/events';
import { DateTimeUtils } from '@/utils/datetime';

interface ParseOptions {
  sourceFile?: string;
}

export class ScomXmlParser {
  private readonly parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      allowBooleanAttributes: true,
      parseAttributeValue: true,
      parseTagValue: true,
      trimValues: true,
    });
  }

  async parse(xmlContent: string, options: ParseOptions = {}): Promise<ScomEvent[]> {
    const config = configService.getConfig();
    const wrappedXml = `<root>${xmlContent}</root>`;

    let parsed: unknown;
    const validationResult = XMLValidator.validate(wrappedXml);
    if (validationResult !== true) {
      const validationError =
        validationResult instanceof Error
          ? validationResult
          : new Error(
              `XML validation error: ${(validationResult as { err?: { msg?: string } })?.err?.msg ?? 'unknown validation failure'}`
            );
      const wrappedError = new Error(
        `XML parsing error: ${validationError.message ?? 'unknown parsing failure'}`
      );
      logger().error(
        {
          component: 'ScomXmlParser',
          error: wrappedError,
        },
        'XML validation error'
      );
      throw wrappedError;
    }

    try {
      parsed = this.parser.parse(wrappedXml);
    } catch (error) {
      const wrappedError = new Error(
        `XML parsing error: ${(error as Error).message ?? 'unknown parsing failure'}`
      );
      logger().error(
        {
          component: 'ScomXmlParser',
          error: wrappedError,
        },
        'XML parsing error'
      );
      throw wrappedError;
    }

    const root = (parsed as { root?: { scom_event_message?: unknown } }).root;
    const messages = root?.scom_event_message;

    if (!messages) {
      return [];
    }

    const eventsArray = Array.isArray(messages) ? messages : [messages];

    return eventsArray
      .map((msg) => this.transformEvent(msg, options.sourceFile))
      .filter((event): event is ScomEvent => event !== undefined)
      .slice(0, config.processing.maxEventsPerFile);
  }

  private transformEvent(rawEvent: unknown, sourceFile?: string): ScomEvent | undefined {
    if (!rawEvent || typeof rawEvent !== 'object') {
      return undefined;
    }

    const getText = (key: string): string | undefined => {
      const value = (rawEvent as Record<string, unknown>)[key];
      if (!value) return undefined;
      return String(value).trim() || undefined;
    };

    const name = getText('Name');
    if (!name) {
      return undefined;
    }

    const severity = (getText('Severity') as ScomEvent['severity']) ?? 'Warning';
    const description = this.truncateDescription(getText('Description') ?? '');

    return {
      eventId: randomUUID(),
      name,
      severity,
      description,
      netbiosComputerName: getText('NetbiosComputerName'),
      monitoringObjectPath: getText('MonitoringObjectPath'),
      category: getText('Category'),
      timeRaised: DateTimeUtils.normalize(getText('TimeRaised')),
      timeAdded: DateTimeUtils.normalize(getText('TimeAdded')),
      priority: this.parseNumber(getText('Priority')),
      resolutionState: getText('ResolutionState'),
      customFields: this.collectCustomFields(rawEvent as Record<string, unknown>),
      rawXml: JSON.stringify(rawEvent),
      sourceFile,
      receivedAt: DateTimeUtils.nowIso(),
    };
  }

  private truncateDescription(value: string): string {
    const MAX_LENGTH = 1000;
    if (value.length <= MAX_LENGTH) {
      return value;
    }
    return value.slice(0, MAX_LENGTH);
  }

  private parseNumber(value?: string): number | undefined {
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  private collectCustomFields(rawEvent: Record<string, unknown>): Record<string, unknown> {
    const standardKeys = new Set([
      'Name',
      'Severity',
      'Description',
      'NetbiosComputerName',
      'MonitoringObjectPath',
      'Category',
      'TimeRaised',
      'TimeAdded',
      'Priority',
      'ResolutionState',
    ]);

    const custom: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawEvent)) {
      if (!standardKeys.has(key)) {
        custom[key] = value;
      }
    }
    return custom;
  }
}

