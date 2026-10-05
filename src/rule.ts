import type { DatabaseManagerInstance, LoggerService, ManagerConfig } from '@tazama-lf/frms-coe-lib';
  import type { Case, RuleConfig, RuleRequest, RuleResult } from '@tazama-lf/frms-coe-lib/lib/interfaces';
import type { SupportedTransactionMessage } from '@tazama-lf/frms-coe-lib/lib/interfaces';
import type { BaseMessage } from '@tazama-lf/frms-coe-lib/lib/interfaces';

export type RuleExecutorConfig = Required<Pick<ManagerConfig, 'rawHistory' | 'eventHistory' | 'configuration' | 'localCacheConfig'>>;

export async function handleTransaction(
  req: RuleRequest<SupportedTransactionMessage>,
  determineOutcome: (value: number, ruleConfig: RuleConfig, ruleResult: RuleResult) => RuleResult,
  ruleRes: RuleResult,
  loggerService: LoggerService,
  ruleConfig: RuleConfig,
  databaseManager: DatabaseManagerInstance<RuleExecutorConfig>,
): Promise<RuleResult> {
  const transaction = req.transaction as BaseMessage;
  

      /*
       * WD-001
       * NPSB withdrawal velocity - debtor
       *
       * Count previous successful NPSB withdrawals made by the
       * same debtor account during the previous 10 minutes.
       *
       * Previous count:
       *   0, 1, 2 -> .01
       *   3+      -> .02
       *
       * The current transaction is excluded from the count.
       */
    
    
      if (!req.DataCache.dbtrAcctId) {
        throw new Error('Data Cache does not have required dbtrAcctId');
      }
    
      if (!req.DataCache.creDtTm) {
        throw new Error('Data Cache does not have required creDtTm');
      }
    
      if (!transaction.Payload) {
        throw new Error('Transaction does not contain Payload');
      }
    
      /*
       * Only evaluate successful transactions.
       */
      if (transaction.Payload.status !== 'success') {
        return {
          ...ruleRes,
          subRuleRef: '.01',
          reason: 'Transaction was not successful',
        };
      }
    
      /*
       * Confirm this is the intended NPSB withdrawal transaction.
       */
      if (transaction.Payload.txn_sub_type !== 'withdraw_money_npsb') {
        return {
          ...ruleRes,
          subRuleRef: '.01',
          reason: 'Transaction is not an NPSB withdrawal',
        };
      }
    
      const debtorAccountId = req.DataCache.dbtrAcctId;
      const currentTransactionTime = req.DataCache.creDtTm;
      const tenantId = req.transaction.TenantId;
    
      /*
       * Count previous successful NPSB withdrawals from the same
       * debtor during the previous 10 minutes.
       *
       * txtp = withdraw_money is the value stored in event_history.
       * TxSubTp = withdraw_money_npsb identifies the NPSB withdrawal.
       *
       * The '< currentTransactionTime' condition excludes the
       * current transaction.
       */
      const queryString = `
        SELECT
          COUNT(*)::bigint AS "length"
        FROM
          transaction
        WHERE
          source = $1
          AND txtp = 'withdraw_money'
          AND txsts = 'success'
          AND transaction->>'TxSubTp' = 'withdraw_money_npsb'
          AND credttm::timestamptz >= (
            $2::timestamptz - interval '10 minutes'
          )
          AND credttm::timestamptz < $2::timestamptz
          AND tenantid = $3;
      `;
    
      const queryResult = await databaseManager._eventHistory.query<{
        length: string;
      }>(queryString, [
        debtorAccountId,
        currentTransactionTime,
        tenantId,
      ]);
    
      const count = Number(queryResult.rows[0]?.length);
    
      if (Number.isNaN(count)) {
        loggerService.error(
          'Data error: invalid transaction history count',
          new Error('Invalid transaction history count'),
          'WD-001 handleTransaction()',
        );
    
        throw new Error('Data error: invalid transaction history count');
      }
    
      return determineOutcome(count, ruleConfig, ruleRes);
    
  
}