import * as fs from 'node:fs';
import * as path from 'node:path';
import { workerConfig } from '../config.js';

export interface JournalCommandEntry {
  commandId: string;
  command: string;
  sessionId: string;
  timestamp: string;
  status: 'RECEIVED' | 'SPAWNED' | 'COMPLETED' | 'CANCELLED';
}

export interface JournalEventEntry {
  eventId: string;
  sequenceNumber: number;
  type: string;
  payload: any;
  acked: boolean;
  timestamp: string;
}

export class LocalJournal {
  private static commandLogPath = path.join(workerConfig.journalDir, 'commands.jsonl');
  private static eventLogPath = path.join(workerConfig.journalDir, 'events.jsonl');
  private static currentSequence = 0;

  static init(): void {
    if (!fs.existsSync(workerConfig.journalDir)) {
      fs.mkdirSync(workerConfig.journalDir, { recursive: true });
    }
  }

  static appendCommand(entry: JournalCommandEntry): void {
    this.init();
    fs.appendFileSync(this.commandLogPath, JSON.stringify(entry) + '\n');
  }

  static hasCommand(commandId: string): boolean {
    this.init();
    if (!fs.existsSync(this.commandLogPath)) return false;
    const lines = fs.readFileSync(this.commandLogPath, 'utf8').split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const item = JSON.parse(line);
        if (item.commandId === commandId) return true;
      } catch {}
    }
    return false;
  }

  static appendEvent(type: string, payload: any): JournalEventEntry {
    this.init();
    this.currentSequence++;
    const entry: JournalEventEntry = {
      eventId: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sequenceNumber: this.currentSequence,
      type,
      payload,
      acked: false,
      timestamp: new Date().toISOString()
    };
    fs.appendFileSync(this.eventLogPath, JSON.stringify(entry) + '\n');
    return entry;
  }

  static markEventAcked(_eventId: string): void {
    // In production, marks event acked or compacts JSONL
  }
}
