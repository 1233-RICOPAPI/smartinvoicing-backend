import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { CopilotService } from './copilot.service';
import { IntentParserService } from './intent-parser.service';
import { QueryEngineService } from './query-engine.service';
import { ReasoningService } from './reasoning.service';
import { COPILOT_INTENTS } from '../constants/intents';

describe('CopilotService', () => {
  let service: CopilotService;
  let cacheFindOne: jest.Mock;
  let cacheUpdateOne: jest.Mock;
  let conversationFindAndUpdate: jest.Mock;
  let queryEngineExecute: jest.Mock;

  beforeEach(async () => {
    cacheFindOne = jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(null) }) });
    cacheUpdateOne = jest.fn().mockReturnValue({ exec: () => Promise.resolve({}) });
    conversationFindAndUpdate = jest.fn().mockReturnValue({ exec: () => Promise.resolve({}) });
    queryEngineExecute = jest.fn().mockResolvedValue({
      from: '2025-02-01',
      to: '2025-02-28',
      totalIva: 190000,
      totalVentas: 1190000,
      invoiceCount: 5,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CopilotService,
        IntentParserService,
        ReasoningService,
        {
          provide: QueryEngineService,
          useValue: { execute: queryEngineExecute },
        },
        {
          provide: getModelToken('CopilotConversation'),
          useValue: { findOneAndUpdate: conversationFindAndUpdate },
        },
        {
          provide: getModelToken('CopilotCache'),
          useValue: { findOne: cacheFindOne, updateOne: cacheUpdateOne },
        },
      ],
    }).compile();

    service = module.get<CopilotService>(CopilotService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('query - sin cache', () => {
    it('ejecuta QueryEngine y Reasoning y devuelve answer + data + intent', async () => {
      const result = await service.query('company-1', 'user-1', '¿Cuánto IVA generé este mes?');
      expect(result).toHaveProperty('answer');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('conversationId');
      expect(result).toHaveProperty('intent');
      expect(result.from).toBeDefined();
      expect(result.to).toBeDefined();
      expect(cacheFindOne).toHaveBeenCalled();
      expect(cacheUpdateOne).toHaveBeenCalled();
      expect(conversationFindAndUpdate).toHaveBeenCalled();
    });

    it('persiste en cache con queryHash y actualiza conversación', async () => {
      await service.query('company-1', 'user-1', 'Balance general');
      expect(cacheUpdateOne).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          $set: expect.objectContaining({
            companyId: 'company-1',
            intent: expect.any(String),
            answer: expect.any(String),
            data: expect.any(Object),
          }),
        }),
        { upsert: true },
      );
    });
  });

  describe('query - con cache', () => {
    it('devuelve respuesta desde cache sin llamar a QueryEngine', async () => {
      const cachedAnswer = 'Respuesta en cache';
      cacheFindOne.mockReturnValue({
        lean: () => ({
          exec: () =>
            Promise.resolve({
              answer: cachedAnswer,
              data: { from: '2025-02-01', to: '2025-02-28' },
              intent: COPILOT_INTENTS.TAX_SUMMARY,
              from: '2025-02-01',
              to: '2025-02-28',
            }),
        }),
      });

      const result = await service.query('company-1', 'user-1', 'IVA este mes');
      expect(result.answer).toBe(cachedAnswer);
      expect(result.intent).toBe(COPILOT_INTENTS.TAX_SUMMARY);
      expect(queryEngineExecute).not.toHaveBeenCalled();
    });
  });
});
