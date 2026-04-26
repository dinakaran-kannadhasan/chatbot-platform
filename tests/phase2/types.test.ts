import { describe, it, expectTypeOf, expect } from 'vitest';
import type {
  Lead,
  IntentLevel,
  LeadStatus,
  Message,
  BaseDocument,
  ApiResponse,
  PartialLead,
  CreateLeadInput,
  UpdateLeadInput,
  CreateTenantInput,
  StreamChunk,
  MarketoLeadInput,
} from '@chatbot/types';

describe('Phase 2 — Shared Types', () => {

  describe('BaseDocument', () => {
    it('has required fields', () => {
      const doc: BaseDocument = {
        id: 'abc123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(doc.id).toBe('abc123');
    });

    it('id is readonly', () => {
      const doc: BaseDocument = {
        id: '1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(doc.id).toBeDefined();
    });
  });

  describe('IntentLevel', () => {
    it('accepts all valid intent levels', () => {
      const levels: IntentLevel[] = ['EXPLORING', 'INTERESTED', 'HIGH_INTENT'];
      expect(levels).toHaveLength(3);
    });
  });

  describe('LeadStatus', () => {
    it('accepts all valid statuses', () => {
      const statuses: LeadStatus[] = [
        'NEW',
        'QUALIFIED',
        'DEMO_REQUESTED',
        'SYNCED',
        'LOST',
      ];
      expect(statuses).toHaveLength(5);
    });
  });

  describe('Lead', () => {
    it('can be constructed with required fields only', () => {
      const lead: Lead = {
        id: 'lead_1',
        createdAt: new Date(),
        updatedAt: new Date(),
        sessionId: 'sess_1',
        websiteId: 'appviewx',
        name: 'Arun Kumar',
        email: 'arun@appviewx.com',
        intentLevel: 'HIGH_INTENT',
        status: 'NEW',
      };
      expect(lead.email).toBe('arun@appviewx.com');
    });

    it('optional fields can be omitted', () => {
      const lead: Lead = {
        id: 'lead_2',
        createdAt: new Date(),
        updatedAt: new Date(),
        sessionId: 'sess_2',
        websiteId: 'appviewx',
        name: 'Test User',
        email: 'test@test.com',
        intentLevel: 'EXPLORING',
        status: 'NEW',
      };
      expect(lead.company).toBeUndefined();
    });

    it('optional fields can be included', () => {
      const lead: Lead = {
        id: 'lead_3',
        createdAt: new Date(),
        updatedAt: new Date(),
        sessionId: 'sess_3',
        websiteId: 'appviewx',
        name: 'Full Lead',
        email: 'full@test.com',
        intentLevel: 'HIGH_INTENT',
        status: 'QUALIFIED',
        company: 'AppViewX',
        jobTitle: 'Security Engineer',
        useCase: 'PKI automation',
        currentSolution: 'Manual certs',
        marketoLeadId: 12345,
        marketoSyncedAt: new Date(),
      };
      expect(lead.company).toBe('AppViewX');
    });
  });

  describe('PartialLead', () => {
    it('allows empty object', () => {
      const partial: PartialLead = {};
      expect(partial).toBeDefined();
    });

    it('allows just email', () => {
      const partial: PartialLead = { email: 'test@test.com' };
      expect(partial.email).toBe('test@test.com');
    });

    it('allows all fields', () => {
      const partial: PartialLead = {
        name: 'Arun',
        email: 'arun@test.com',
        company: 'AppViewX',
        jobTitle: 'Engineer',
        useCase: 'PKI',
        currentSolution: 'Manual',
      };
      expect(Object.keys(partial)).toHaveLength(6);
    });
  });

  describe('CreateLeadInput', () => {
    it('does not include id field', () => {
      expectTypeOf<CreateLeadInput>().not.toHaveProperty('id');
    });

    it('does not include createdAt field', () => {
      expectTypeOf<CreateLeadInput>().not.toHaveProperty('createdAt');
    });

    it('does not include marketoLeadId', () => {
      expectTypeOf<CreateLeadInput>().not.toHaveProperty('marketoLeadId');
    });
  });

  describe('UpdateLeadInput', () => {
    it('empty object is valid', () => {
      const update: UpdateLeadInput = {};
      expect(update).toBeDefined();
    });

    it('can update just intentLevel', () => {
      const update: UpdateLeadInput = { intentLevel: 'HIGH_INTENT' };
      expect(update.intentLevel).toBe('HIGH_INTENT');
    });
  });

  describe('Message', () => {
    it('accepts user role', () => {
      const msg: Message = {
        role: 'user',
        content: 'Hello',
        timestamp: new Date(),
      };
      expect(msg.role).toBe('user');
    });

    it('accepts assistant role', () => {
      const msg: Message = {
        role: 'assistant',
        content: 'Hi there!',
        timestamp: new Date(),
      };
      expect(msg.role).toBe('assistant');
    });
  });

  describe('StreamChunk', () => {
    it('can be a partial chunk', () => {
      const chunk: StreamChunk = { delta: 'Hello', done: false };
      expect(chunk.done).toBe(false);
    });

    it('can be a final chunk', () => {
      const chunk: StreamChunk = { delta: '', done: true, intentLevel: 'HIGH_INTENT' };
      expect(chunk.done).toBe(true);
    });
  });

  describe('ApiResponse', () => {
    it('can wrap a data payload', () => {
      const response: ApiResponse<Lead[]> = { success: true, data: [] };
      expect(response.success).toBe(true);
    });

    it('can represent an error', () => {
      const response: ApiResponse = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Lead not found' },
      };
      expect(response.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('CreateTenantInput', () => {
    it('does not include id field', () => {
      expectTypeOf<CreateTenantInput>().not.toHaveProperty('id');
    });

    it('does not include createdAt field', () => {
      expectTypeOf<CreateTenantInput>().not.toHaveProperty('createdAt');
    });
  });

  describe('MarketoLeadInput', () => {
    it('requires email firstName and LeadSource', () => {
      const input: MarketoLeadInput = {
        email: 'test@test.com',
        firstName: 'Arun',
        LeadSource: 'Website Chatbot',
      };
      expect(input.email).toBeDefined();
    });

    it('optional fields can be added', () => {
      const input: MarketoLeadInput = {
        email: 'test@test.com',
        firstName: 'Arun',
        LeadSource: 'Website Chatbot',
        Use_Case__c: 'PKI automation',
        Intent_Level__c: 'HIGH_INTENT',
      };
      expect(input.Use_Case__c).toBe('PKI automation');
    });
  });

});
