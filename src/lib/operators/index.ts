import type { Company } from '../types';
import { ctbAdapter } from './ctb';
import { gmbAdapter } from './gmb';
import { kmbAdapter } from './kmb';
import { nlbAdapter } from './nlb';
import type { OperatorAdapter, OperatorMeta } from './adapter';

export const OPERATORS: Record<Company, OperatorAdapter> = {
  KMB: kmbAdapter,
  CTB: ctbAdapter,
  NLB: nlbAdapter,
  GMB: gmbAdapter,
};

/** 顯示順序 */
export const COMPANY_ORDER: readonly Company[] = ['KMB', 'CTB', 'NLB', 'GMB'];

export function getOperator(company: Company): OperatorAdapter {
  return OPERATORS[company];
}

export function operatorMeta(company: Company): OperatorMeta {
  return OPERATORS[company].meta;
}

/** 營運商是否提供全港車站清單（由 adapter 是否實作 listAllStops 決定，避免與 meta 不同步） */
export function supportsStopSearch(company: Company): boolean {
  return typeof OPERATORS[company].listAllStops === 'function';
}

export type { OperatorAdapter, OperatorMeta };
