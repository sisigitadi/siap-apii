import { apiClient } from './client';
import { CashAccount, CashBalances, CashCategory, CashFlow, CashFlowType, MonthlyReport, VoucherStatus } from './types';

export interface CreateVoucherPayload {
  type: CashFlowType;
  category: CashCategory;
  account: CashAccount;
  amount: number;
  description: string;
  transaction_date: string;
  attachment_url?: string;
}

export interface VouchersListResponse {
  items: CashFlow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const financeApi = {
  async listVouchers(params: { status?: VoucherStatus; account?: CashAccount; page?: number; limit?: number } = {}): Promise<VouchersListResponse> {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set('status', params.status);
    if (params.account) searchParams.set('account', params.account);
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));

    const res = await apiClient.get<VouchersListResponse>(`/finance/vouchers?${searchParams.toString()}`);
    if (!res.success) throw new Error(res.error?.message || 'Gagal mengambil data voucher');
    return res.data;
  },

  async getBalances(): Promise<CashBalances> {
    const res = await apiClient.get<CashBalances>('/finance/balances');
    if (!res.success) throw new Error(res.error?.message || 'Gagal mengambil saldo kas');
    return res.data;
  },

  async getMonthlyReport(month: number, year: number): Promise<MonthlyReport> {
    const res = await apiClient.get<MonthlyReport>(`/finance/reports/monthly?month=${month}&year=${year}`);
    if (!res.success) throw new Error(res.error?.message || 'Gagal mengambil laporan bulanan');
    return res.data;
  },

  async createVoucher(payload: CreateVoucherPayload): Promise<CashFlow> {
    const res = await apiClient.post<CashFlow>('/finance/vouchers', payload);
    if (!res.success) throw new Error(res.error?.message || 'Gagal membuat voucher kas');
    return res.data;
  },

  async verifyBendahara(id: string): Promise<CashFlow> {
    const res = await apiClient.post<CashFlow>(`/finance/vouchers/${id}/verify-bendahara`);
    if (!res.success) throw new Error(res.error?.message || 'Gagal memverifikasi voucher sebagai Bendahara');
    return res.data;
  },

  async verifyKetum(id: string): Promise<CashFlow> {
    const res = await apiClient.post<CashFlow>(`/finance/vouchers/${id}/verify-ketum`);
    if (!res.success) throw new Error(res.error?.message || 'Gagal menyetujui voucher sebagai Ketua Umum');
    return res.data;
  },

  async rejectVoucher(id: string, reason: string): Promise<CashFlow> {
    const res = await apiClient.post<CashFlow>(`/finance/vouchers/${id}/reject`, { reason });
    if (!res.success) throw new Error(res.error?.message || 'Gagal menolak voucher');
    return res.data;
  },
};
