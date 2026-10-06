/* eslint-disable @typescript-eslint/no-unused-vars */
import { type DataCache, type RuleConfig, type RuleRequest, type RuleResult } from '@tazama-lf/frms-coe-lib/lib/interfaces';
import {
  DatabaseManagerMock,
  determineOutcome,
  LoggerServiceMock,
  MockDatabaseManagerFactory,
  MockLoggerServiceFactory,
} from '@tazama-lf/frms-coe-lib/lib/tests/mocks';
import { handleTransaction, RuleExecutorConfig } from '../../src/rule';

const getRuleConfig = (): RuleConfig => {
  return {
    id: 'WD-001@1.0.0',
    cfg: '1.0.0',
    desc: 'NPSB withdrawal velocity - debtor',
    config: {
      bands: [
        {
          reason: 'Fewer than 3 previous successful NPSB withdrawals in the last 10 minutes',
          subRuleRef: '.01',
          upperLimit: 3,
        },
        {
          reason: '3 or more previous successful NPSB withdrawals in the last 10 minutes',
          lowerLimit: 3,
          subRuleRef: '.02',
        },
      ],
      parameters: {},
      exitConditions: [],
    },
    creDtTm: '2026-10-05T07:20:11.098Z',
    updDtTm: '2026-10-05T07:20:11.098Z',
    tenantId: 'DEFAULT',
  };
};

const getMockRequest = (): RuleRequest => {
  return {
    transaction: {
      TxTp: 'withdraw_money_npsb',
      MsgId: 'd5cad8be-f479-49ea-bba6-e3550e781436',
      TenantId: 'DEFAULT',
      Payload: {
        id: 'd5cad8be-f479-49ea-bba6-e3550e781436',
        amount: 5000,
        origin: 'merchant_app',
        status: 'success',
        channel: 'npsb',
        currency: 'BDT',
        provider: '',
        txn_type: 'withdraw_money',
        code_name: 'mtb_bank',
        user_slug: '37139538',
        created_at: '2025-07-22T06:51:26.433Z',
        updated_at: '2025-07-22T06:51:26.545Z',
        debitor_fee: 100,
        creditor_fee: 0,
        debitor_name: 'Ratul M 1',
        debitor_slug: '37139538',
        invoice_type: 'withdraw_money',
        txn_sub_type: 'withdraw_money_npsb',
        creditor_name: '',
        creditor_slug: '37139638',
        transaction_id: 'D1VJ9RG4E4',
        payment_gateway: 'mtb_bank',
      },
    },
    networkMap: {
      cfg: '1.0.0',
      active: true,
      messages: [
        {
          id: 'WD-001@1.0.0',
          cfg: '1.0.0',
          txTp: 'withdraw_money_npsb',
          typologies: [
            {
              id: 'typology-WD-001',
              cfg: '000@1.0.0',
              rules: [
                {
                  id: 'WD-001@1.0.0',
                  cfg: '1.0.0',
                },
              ],
            },
          ],
        },
      ],
      tenantId: 'DEFAULT',
    },
    DataCache: {
      name: 'Ratul M 1',
      evtId: 'd5cad8be-f479-49ea-bba6-e3550e781436',
      cdtrId: '37139638',
      dbtrId: '37139538',
      creDtTm: '2025-07-22T06:51:26.433Z',
      currency: 'BDT',
      instdAmt: {
        Amt: '5000',
        Ccy: 'BDT',
      },
      cdtrAcctId: '37139638',
      dbtrAcctId: '37139538',
    },
  } as RuleRequest;
};

const ruleResult: RuleResult = {
  id: 'WD-001@1.0.0',
  cfg: '1.0.0',
  tenantId: 'DEFAULT',
  subRuleRef: '.err',
  reason: 'Unhandled rule result outcome',
};

let databaseManager: DatabaseManagerMock<RuleExecutorConfig>;
let loggerService: LoggerServiceMock;

describe('Rule WD-001 Test', () => {
  beforeEach(() => {
    loggerService = MockLoggerServiceFactory();
    loggerService.resetMock();

    databaseManager = MockDatabaseManagerFactory<RuleExecutorConfig>();
    databaseManager.resetMock();
  });

  describe('handleTransaction', () => {
    describe('WD-001 bands Testing', () => {
      let req: RuleRequest;

      beforeEach(() => {
        req = getMockRequest();
      });

      test('should return .01 when there are no previous withdrawals', async () => {
        databaseManager._eventHistory.query.mockResolvedValue({
          rows: [{ length: '0' }],
        });

        const res = await handleTransaction(
          req,
          determineOutcome,
          ruleResult,
          loggerService,
          getRuleConfig(),
          databaseManager,
        );

        expect(res).toEqual({
          ...ruleResult,
          subRuleRef: '.01',
          reason: 'Fewer than 3 previous successful NPSB withdrawals in the last 10 minutes',
        });
      });

      test('should return .01 when there are 2 previous withdrawals', async () => {
        databaseManager._eventHistory.query.mockResolvedValue({
          rows: [{ length: '2' }],
        });

        const res = await handleTransaction(
          req,
          determineOutcome,
          ruleResult,
          loggerService,
          getRuleConfig(),
          databaseManager,
        );

        expect(res.subRuleRef).toBe('.01');
        expect(res.reason).toBe(
          'Fewer than 3 previous successful NPSB withdrawals in the last 10 minutes',
        );
      });

      test('should return .02 when there are exactly 3 previous withdrawals', async () => {
        databaseManager._eventHistory.query.mockResolvedValue({
          rows: [{ length: '3' }],
        });

        const res = await handleTransaction(
          req,
          determineOutcome,
          ruleResult,
          loggerService,
          getRuleConfig(),
          databaseManager,
        );

        expect(res.subRuleRef).toBe('.02');
        expect(res.reason).toBe(
          '3 or more previous successful NPSB withdrawals in the last 10 minutes',
        );
      });

      test('should return .02 when there are 10 previous withdrawals', async () => {
        databaseManager._eventHistory.query.mockResolvedValue({
          rows: [{ length: '10' }],
        });

        const res = await handleTransaction(
          req,
          determineOutcome,
          ruleResult,
          loggerService,
          getRuleConfig(),
          databaseManager,
        );

        expect(res.subRuleRef).toBe('.02');
      });
    });
  });
});