'use server';

import {
  createSale as _createSale,
  updateSaleDetails as _updateSaleDetails,
  recordIssuance as _recordIssuance,
  cancelSale as _cancelSale,
  reassignSale as _reassignSale,
} from '@/app/(dashboard)/sell/actions';
import { Sale } from '@/lib/types';

export async function createSale(data: Parameters<typeof _createSale>[0]) {
  return await _createSale(data);
}

export async function updateSaleDetails(saleId: string, updates: Partial<Sale>) {
  return await _updateSaleDetails(saleId, updates);
}

export async function recordIssuance(saleId: string, channel: 'whatsapp' | 'printed') {
  return await _recordIssuance(saleId, channel);
}

export async function cancelSale(saleId: string, reason?: string) {
  return await _cancelSale(saleId, reason || '');
}

export async function reassignSale(saleId: string, newDonorName: string, newDonorPhone: string, notes?: string) {
  return await _reassignSale(saleId, newDonorName, newDonorPhone, notes);
}

