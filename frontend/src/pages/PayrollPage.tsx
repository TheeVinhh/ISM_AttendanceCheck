import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';
import { getCurrentYearMonthGMT7 } from '../utils/timezone';
import type {
  Department, OvertimePolicy, EmployeePayProfile, EmployeeProfileListItem,
  AllowanceDeductionItem, PayrollRun, PayrollRunEntry, RunStatus, PayType,
} from '../types';

// Constants
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CURRENCIES = ['VND','USD','SGD','THB','EUR','JPY'];
const CATEGORIES = ['transport','housing','meal','childcare','insurance','pension','tax','loan','advance','other'];

const STATUS_BADGE: Record<RunStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  under_review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  exported: 'bg-blue-100 text-blue-800',
};
const STATUS_LABEL: Record<RunStatus, string> = {
  draft: 'Draft', under_review: 'Under Review', approved: 'Approved', exported: 'Exported',
};

// Modal Component
function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`relative max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl ${wide ? 'w-full max-w-5xl' : 'w-full max-w-xl'}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">✕</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// Field Helper
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-gray-600">{label}</label>
      {children}
    </div>
  );
}
const inputCls = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const selectCls = inputCls;

// Item Editor Component
function ItemEditor({
  items, onChange, type,
}: { items: AllowanceDeductionItem[]; onChange: (v: AllowanceDeductionItem[]) => void; type: 'allowance' | 'deduction' }) {
  const label = type === 'allowance' ? 'Allowance' : 'Deduction';
  const add = () =>
    onChange([...items, { name: '', type, category: 'other', valueType: 'fixed', value: 0, taxable: false, recurring: true }]);
  const update = (i: number, patch: Partial<AllowanceDeductionItem>) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 rounded-lg border bg-gray-50 p-3">
          <div className="col-span-3">
            <input value={item.name} onChange={(e) => update(i, { name: e.target.value })}
              placeholder="Name" className={inputCls} />
          </div>
          <div className="col-span-2">
            <select value={item.category} onChange={(e) => update(i, { category: e.target.value })} className={selectCls}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <select value={item.valueType} onChange={(e) => update(i, { valueType: e.target.value as AllowanceDeductionItem['valueType'] })} className={selectCls}>
              <option value="fixed">Fixed</option>
              <option value="percent_of_base">% of Base</option>
              <option value="percent_of_gross">% of Gross</option>
            </select>
          </div>
          <div className="col-span-2">
            <input type="number" min="0" step="any" value={item.value}
              onChange={(e) => update(i, { value: parseFloat(e.target.value) || 0 })}
              className={inputCls} />
          </div>
          <div className="col-span-2 flex items-center gap-3">
            <label className="flex items-center gap-1 text-xs text-gray-600">
              <input type="checkbox" checked={item.taxable} onChange={(e) => update(i, { taxable: e.target.checked })} />
              Taxable
            </label>
          </div>
          <div className="col-span-1 flex items-center">
            <button onClick={() => remove(i)} className="text-red-400 hover:text-red-600">X</button>
          </div>
        </div>
      ))}
      <button onClick={add} className="text-sm font-medium text-blue-600 hover:underline">+ Add {label}</button>
    </div>
  );
}

// Profile Edit Modal
interface ProfileFormState {
  payType: PayType; department: string; jobTitle: string; grade: string;
  baseHourlyRate: string; monthlySalary: string; contractAmount: string;
  currency: string; overtimePolicyId: string; effectiveFrom: string; notes: string;
  allowances: AllowanceDeductionItem[]; deductions: AllowanceDeductionItem[];
}
const defaultProfileForm = (p?: EmployeePayProfile | null): ProfileFormState => ({
  payType: p?.payType ?? 'salaried',
  department: p?.department ?? '',
  jobTitle: p?.jobTitle ?? '',
  grade: p?.grade ?? '',
  baseHourlyRate: String(p?.baseHourlyRate ?? ''),
  monthlySalary: String(p?.monthlySalary ?? ''),
  contractAmount: String(p?.contractAmount ?? ''),
  currency: p?.currency ?? 'VND',
  overtimePolicyId: p?.overtimePolicyId ?? '',
  effectiveFrom: new Date().toISOString().slice(0, 10),
  notes: p?.notes ?? '',
  allowances: p?.allowances ?? [],
  deductions: p?.deductions ?? [],
});

function ProfileEditModal({
  emp, currentProfile, otPolicies, onSaved, onClose,
}: {
  emp: { _id: string; fullName: string; email: string };
  currentProfile: EmployeePayProfile | null;
  otPolicies: OvertimePolicy[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ProfileFormState>(() => defaultProfileForm(currentProfile));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<ProfileFormState>) => setForm((f) => ({ ...f, ...patch }));

  const handleSave = async () => {
    setError('');
    if (!form.payType) { setError('Pay type is required'); return; }
    if (!form.effectiveFrom) { setError('Effective from date is required'); return; }
    if (form.payType === 'hourly' && !parseFloat(form.baseHourlyRate)) { setError('Base hourly rate is required'); return; }
    if (form.payType === 'salaried' && !parseFloat(form.monthlySalary)) { setError('Monthly salary is required'); return; }
    if (form.payType === 'contract' && !parseFloat(form.contractAmount)) { setError('Contract amount is required'); return; }

    setSaving(true);
    try {
      await api.post(`/payroll/profiles/${emp._id}`, {
        payType: form.payType,
        department: form.department,
        jobTitle: form.jobTitle,
        grade: form.grade,
        baseHourlyRate: parseFloat(form.baseHourlyRate) || undefined,
        monthlySalary: parseFloat(form.monthlySalary) || undefined,
        contractAmount: parseFloat(form.contractAmount) || undefined,
        currency: form.currency,
        overtimePolicyId: form.overtimePolicyId || undefined,
        effectiveFrom: form.effectiveFrom,
        notes: form.notes,
        allowances: form.allowances,
        deductions: form.deductions,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Pay Profile - ${emp.fullName}`} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Pay Type *">
            <select value={form.payType} onChange={(e) => set({ payType: e.target.value as PayType })} className={selectCls}>
              <option value="hourly">Hourly</option>
              <option value="salaried">Salaried</option>
              <option value="contract">Contract</option>
            </select>
          </Field>
          <Field label="Department">
            <input value={form.department} onChange={(e) => set({ department: e.target.value })} placeholder="e.g. Engineering" className={inputCls} />
          </Field>
          <Field label="Job Title">
            <input value={form.jobTitle} onChange={(e) => set({ jobTitle: e.target.value })} placeholder="e.g. Senior Developer" className={inputCls} />
          </Field>
          <Field label="Grade / Band">
            <input value={form.grade} onChange={(e) => set({ grade: e.target.value })} placeholder="e.g. L3, Senior" className={inputCls} />
          </Field>
          <Field label="Currency">
            <select value={form.currency} onChange={(e) => set({ currency: e.target.value })} className={selectCls}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="OT Policy">
            <select value={form.overtimePolicyId} onChange={(e) => set({ overtimePolicyId: e.target.value })} className={selectCls}>
              <option value="">None</option>
              {otPolicies.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Effective From *">
            <input type="date" value={form.effectiveFrom} onChange={(e) => set({ effectiveFrom: e.target.value })} className={inputCls} />
          </Field>
        </div>

        <div className="rounded-xl border bg-blue-50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-blue-700">Pay Basis</p>
          {form.payType === 'hourly' && (
            <Field label="Base Rate / Hour">
              <input type="number" min="0" step="any" value={form.baseHourlyRate}
                onChange={(e) => set({ baseHourlyRate: e.target.value })} placeholder="50000" className={inputCls + ' max-w-xs'} />
            </Field>
          )}
          {form.payType === 'salaried' && (
            <Field label="Monthly Gross Salary">
              <input type="number" min="0" step="any" value={form.monthlySalary}
                onChange={(e) => set({ monthlySalary: e.target.value })} placeholder="20000000" className={inputCls + ' max-w-xs'} />
            </Field>
          )}
          {form.payType === 'contract' && (
            <Field label="Contract Amount (per period)">
              <input type="number" min="0" step="any" value={form.contractAmount}
                onChange={(e) => set({ contractAmount: e.target.value })} placeholder="30000000" className={inputCls + ' max-w-xs'} />
            </Field>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-gray-700">Allowances</p>
          <ItemEditor items={form.allowances} onChange={(v) => set({ allowances: v })} type="allowance" />
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-gray-700">Deductions</p>
          <ItemEditor items={form.deductions} onChange={(v) => set({ deductions: v })} type="deduction" />
        </div>

        <Field label="Notes">
          <textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })}
            rows={2} className={inputCls} placeholder="Reason for change..." />
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button onClick={handleSave} disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            {saving ? 'Saving...' : 'Save Profile (create new version)'}
          </button>
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

// Employees Tab
function EmployeesTab({ otPolicies, departments }: { otPolicies: OvertimePolicy[]; departments: Department[] }) {
  const [items, setItems] = useState<EmployeeProfileListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDept, setFilterDept] = useState('');
  const [filterType, setFilterType] = useState('');
  const [editing, setEditing] = useState<EmployeeProfileListItem | null>(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterDept) params['dept'] = filterDept;
      if (filterType) params['payType'] = filterType;
      const { data } = await api.get<{ items: EmployeeProfileListItem[] }>('/payroll/profiles', { params });
      setItems(data.items);
    } finally { setLoading(false); }
  }, [filterDept, filterType]);

  useEffect(() => { void fetchProfiles(); }, [fetchProfiles]);

  const PAY_TYPE_COLOR: Record<string, string> = {
    hourly: 'bg-purple-100 text-purple-700',
    salaried: 'bg-green-100 text-green-700',
    contract: 'bg-orange-100 text-orange-700',
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d._id} value={d.code}>{d.name}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
          <option value="">All Pay Types</option>
          <option value="hourly">Hourly</option>
          <option value="salaried">Salaried</option>
          <option value="contract">Contract</option>
        </select>
        <span className="text-sm text-gray-500">{items.length} employees</span>
        <span className="text-sm text-orange-600">{items.filter((i) => !i.profile).length} missing config</span>
      </div>

      {loading ? <p className="text-sm text-gray-400">Loading...</p> : (
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-200">
                {['Employee', 'Department', 'Pay Type', 'Job Title / Grade', 'Base Pay', 'OT Policy', 'Effective From', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const p = item.profile;
                const basePay = p?.payType === 'hourly' ? `${(p.baseHourlyRate ?? 0).toLocaleString()}/hr`
                  : p?.payType === 'salaried' ? (p.monthlySalary ?? 0).toLocaleString()
                  : p?.payType === 'contract' ? (p.contractAmount ?? 0).toLocaleString()
                  : '—';
                return (
                  <tr key={String(item.employee._id)} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-800">{item.employee.fullName}</p>
                      <p className="text-xs text-gray-400">{item.employee.email}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{p?.department || '—'}</td>
                    <td className="px-4 py-3">
                      {p ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PAY_TYPE_COLOR[p.payType] ?? ''}`}>
                          {p.payType}
                        </span>
                      ) : <span className="text-xs text-orange-500">No profile</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {p ? <>{p.jobTitle}{p.grade ? <span className="ml-1 text-xs text-gray-400">({p.grade})</span> : null}</> : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {p ? <>{basePay} <span className="text-xs text-gray-400">{p.currency}</span></> : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {p?.overtimePolicyId ? otPolicies.find((o) => o._id === p.overtimePolicyId)?.name ?? '—' : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {p ? new Date(p.effectiveFrom).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setEditing(item)}
                        className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100">
                        {p ? 'Edit / Update' : 'Set Up Profile'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <ProfileEditModal
          emp={editing.employee}
          currentProfile={editing.profile}
          otPolicies={otPolicies}
          onSaved={fetchProfiles}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

// Runs Tab
const ENTRY_STATUS_BADGE: Record<string, string> = {
  calculated: 'bg-gray-100 text-gray-600',
  adjusted:   'bg-amber-100 text-amber-700',
  locked:     'bg-green-100 text-green-700',
};

function RunsTab() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { year: y, month: m } = getCurrentYearMonthGMT7();
  const [runs, setRuns]           = useState<PayrollRun[]>([]);
  const [loading, setLoading]     = useState(true);
  const [creating, setCreating]   = useState(false);
  const [year, setYear]           = useState(y);
  const [month, setMonth]         = useState(m);
  const [viewRun, setViewRun]     = useState<PayrollRun | null>(null);
  const [loadingRunId, setLoadingRunId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError]     = useState('');
  // Adjust-entry modal
  const [adjEntry, setAdjEntry]   = useState<PayrollRunEntry | null>(null);
  const [adjAmount, setAdjAmount] = useState('');
  const [adjNote, setAdjNote]     = useState('');
  const [adjSaving, setAdjSaving] = useState(false);
  const [adjError, setAdjError]   = useState('');

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ runs: PayrollRun[] }>('/payroll/runs');
      setRuns(data.runs);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchRuns(); }, [fetchRuns]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await api.post('/payroll/runs', { year, month });
      await fetchRuns();
    } finally { setCreating(false); }
  };

  const handleView = async (run: PayrollRun) => {
    setLoadingRunId(run._id);
    setActionError('');
    try {
      const { data } = await api.get<{ run: PayrollRun }>(`/payroll/runs/${run._id}`);
      setViewRun(data.run);
    } finally { setLoadingRunId(null); }
  };

  const refreshViewRun = async (runId: string) => {
    const { data } = await api.get<{ run: PayrollRun }>(`/payroll/runs/${runId}`);
    setViewRun(data.run);
    await fetchRuns();
  };

  const handleRecalculate = async () => {
    if (!viewRun) return;
    if (!confirm('Recalculate this payroll run? Current entries will be overwritten.')) return;
    setActionLoading(true); setActionError('');
    try {
      await api.post('/payroll/runs', { year: viewRun.year, month: viewRun.month });
      await refreshViewRun(viewRun._id);
    } catch (e: any) {
      setActionError(e.response?.data?.message ?? 'Recalculation failed');
    } finally { setActionLoading(false); }
  };

  const handleSubmit = async () => {
    if (!viewRun) return;
    setActionLoading(true); setActionError('');
    try {
      await api.post(`/payroll/runs/${viewRun._id}/submit`);
      await refreshViewRun(viewRun._id);
    } catch (e: any) {
      setActionError(e.response?.data?.message ?? 'Submit failed');
    } finally { setActionLoading(false); }
  };

  const handleApprove = async () => {
    if (!viewRun) return;
    if (!confirm('Approve this payroll run? All entries will be locked and cannot be edited.')) return;
    setActionLoading(true); setActionError('');
    try {
      await api.post(`/payroll/runs/${viewRun._id}/approve`);
      await refreshViewRun(viewRun._id);
    } catch (e: any) {
      setActionError(e.response?.data?.message ?? 'Approve failed');
    } finally { setActionLoading(false); }
  };

  const handleExport = async () => {
    if (!viewRun) return;
    const url = `/payroll/runs/${viewRun._id}/export-csv`;
    const { data } = await api.get(url, { responseType: 'blob' });
    const href = URL.createObjectURL(data as Blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `payroll-${viewRun.year}-${String(viewRun.month).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(href);
    await refreshViewRun(viewRun._id);
  };

  const openAdjust = (entry: PayrollRunEntry) => {
    setAdjEntry(entry);
    setAdjAmount(entry.manualAdjustment != null ? String(entry.manualAdjustment) : '');
    setAdjNote(entry.adjustmentNote ?? '');
    setAdjError('');
  };

  const saveAdjust = async () => {
    if (!viewRun || !adjEntry) return;
    const amount = parseFloat(adjAmount);
    if (isNaN(amount)) { setAdjError('Enter a valid number'); return; }
    setAdjSaving(true); setAdjError('');
    try {
      await api.put(`/payroll/runs/${viewRun._id}/entries/${adjEntry.userId}`, {
        manualAdjustment: amount,
        adjustmentNote: adjNote,
      });
      setAdjEntry(null);
      await refreshViewRun(viewRun._id);
    } catch (e: any) {
      setAdjError(e.response?.data?.message ?? 'Save failed');
    } finally { setAdjSaving(false); }
  };

  const fmt = (n: number) => n.toLocaleString();

  return (
    <div className="space-y-4">
      {/* Admin: Calculate payroll control */}
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-gray-700">Calculate payroll for:</p>
          <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className="rounded-lg border bg-white px-3 py-2 text-sm">
            {MONTHS.map((name, i) => <option key={i} value={i + 1}>{name}</option>)}
          </select>
          <input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value))}
            className="w-24 rounded-lg border bg-white px-3 py-2 text-sm" />
          <button onClick={handleCreate} disabled={creating}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            {creating ? 'Calculating...' : 'Calculate Run'}
          </button>
        </div>
      )}

      {/* Pay Runs List */}
      {loading ? <p className="text-sm text-gray-400">Loading...</p> : runs.length === 0 ? (
        <p className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">
          {isAdmin ? 'No payroll runs yet. Use the calculator above to create one.' : 'No payroll data available yet.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Period</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-600 min-w-[100px]">Employees</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600 min-w-[140px]">Gross Pay</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600 min-w-[140px]">Deductions</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600 min-w-[140px]">Net Pay</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-600 min-w-[120px]">Created</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 min-w-[140px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run._id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                  <td className="px-4 py-4 font-semibold text-gray-900">{MONTHS[(run.month ?? 1) - 1]} {run.year}</td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[run.status]}`}>
                      {STATUS_LABEL[run.status]}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700 font-medium">{run.employeeCount}</td>
                  <td className="px-4 py-4 text-right text-gray-900 font-semibold">{run.totalGrossPay.toLocaleString()}</td>
                  <td className="px-4 py-4 text-right text-red-600 font-semibold">{run.totalDeductions.toLocaleString()}</td>
                  <td className="px-4 py-4 text-right text-blue-700 font-bold">
                    {run.totalNetPay.toLocaleString()} <span className="text-xs text-gray-500 font-normal">{run.currency}</span>
                  </td>
                  <td className="px-4 py-4 text-center text-gray-600 text-sm">{new Date(run.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-4">
                    <button onClick={() => void handleView(run)} disabled={loadingRunId === run._id}
                      className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition disabled:opacity-60">
                      {loadingRunId === run._id ? 'Loading...' : 'View'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {viewRun && (
        <Modal title={`Payroll Run — ${MONTHS[(viewRun.month ?? 1) - 1]} ${viewRun.year}`} onClose={() => setViewRun(null)} wide>
          <div className="space-y-5">

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Employees', value: String(viewRun.employeeCount) },
                { label: 'Total Gross Pay', value: `${fmt(viewRun.totalGrossPay)} ${viewRun.currency}` },
                { label: 'Total Deductions', value: `${fmt(viewRun.totalDeductions)} ${viewRun.currency}`, red: true },
                { label: 'Total Net Pay', value: `${fmt(viewRun.totalNetPay)} ${viewRun.currency}`, bold: true },
              ].map(({ label, value, bold, red }) => (
                <div key={label} className="rounded-xl border bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className={`mt-1 text-sm ${bold ? 'font-bold text-blue-700' : red ? 'font-semibold text-red-600' : 'font-semibold text-gray-800'}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Status + Workflow Actions (Admin only) */}
            <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-gray-50 p-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status:</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE[viewRun.status]}`}>
                  {STATUS_LABEL[viewRun.status]}
                </span>
              </div>
              {isAdmin && (
                <div className="ml-auto flex flex-wrap gap-2">
                  {viewRun.status === 'draft' && (
                    <>
                      <button onClick={() => void handleRecalculate()} disabled={actionLoading}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60">
                        Recalculate
                      </button>
                      <button onClick={() => void handleSubmit()} disabled={actionLoading}
                        className="rounded-lg bg-yellow-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yellow-600 disabled:opacity-60">
                        Submit for Review
                      </button>
                      <button onClick={() => void handleApprove()} disabled={actionLoading}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60">
                        Approve &amp; Lock
                      </button>
                    </>
                  )}
                  {viewRun.status === 'under_review' && (
                    <button onClick={() => void handleApprove()} disabled={actionLoading}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60">
                      Approve &amp; Lock
                    </button>
                  )}
                  {viewRun.status === 'approved' && (
                    <button onClick={() => void handleExport()} disabled={actionLoading}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                      Export CSV
                    </button>
                  )}
                </div>
              )}
            </div>
            {actionError && <p className="text-sm text-red-600">{actionError}</p>}

            {/* Status legend */}
            {viewRun.status === 'draft' && (
              <p className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2 text-xs text-yellow-800">
                <strong>Draft</strong> — Data is editable. Not final. Approve the run to lock entries as the official payslip.
              </p>
            )}
            {viewRun.status === 'under_review' && (
              <p className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-xs text-orange-800">
                <strong>Under Review</strong> — Submitted for approval. Entries are read-only pending final approval.
              </p>
            )}
            {(viewRun.status === 'approved' || viewRun.status === 'exported') && (
              <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-xs text-green-800">
                <strong>{STATUS_LABEL[viewRun.status]}</strong> — This is the official payslip. All entries are locked and cannot be modified.
              </p>
            )}

            {/* Employee Breakdown Table */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">
                {isAdmin ? 'Employee Breakdown' : 'Your Pay Breakdown'}
              </h3>
              {(!viewRun.entries || viewRun.entries.length === 0) ? (
                <p className="text-sm text-gray-400">No entries found.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr className="border-b border-gray-200">
                        {isAdmin && <th className="px-3 py-2 text-left font-semibold text-gray-500">Employee</th>}
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Dept</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Pay Type</th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-500">Work Days</th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-500">Present</th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-500">Late</th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-500">Absent</th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-500">Leave</th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-500">Reg. Hrs</th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-500">OT Hrs</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-500">Base Pay</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-500">OT Pay</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-500">Allowances</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-500">Deductions</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-500">Gross Pay</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-500">Net Pay</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-500">Final Pay</th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-500">Entry</th>
                        {isAdmin && viewRun.status === 'draft' && (
                          <th className="px-3 py-2 text-center font-semibold text-gray-500">Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {viewRun.entries.map((entry) => {
                        const finalPay = entry.manualAdjustment != null ? entry.manualAdjustment : entry.netPay;
                        const hasAdj = entry.manualAdjustment != null;
                        return (
                          <tr key={String(entry.userId)} className="border-b border-gray-100 hover:bg-gray-50">
                            {isAdmin && (
                              <td className="px-3 py-2">
                                <p className="font-medium text-gray-800">{entry.fullName}</p>
                                <p className="text-gray-400">{entry.email}</p>
                              </td>
                            )}
                            <td className="px-3 py-2 text-gray-600">{entry.department || '—'}</td>
                            <td className="px-3 py-2 text-gray-600 capitalize">{entry.payType || '—'}</td>
                            <td className="px-3 py-2 text-center text-gray-700">{entry.workingDays}</td>
                            <td className="px-3 py-2 text-center text-green-700">{entry.presentDays}</td>
                            <td className="px-3 py-2 text-center text-amber-600">{entry.lateDays}</td>
                            <td className="px-3 py-2 text-center text-red-600">{entry.absentDays}</td>
                            <td className="px-3 py-2 text-center text-blue-600">{entry.leaveDays}</td>
                            <td className="px-3 py-2 text-center text-gray-700">{entry.regularHours}</td>
                            <td className="px-3 py-2 text-center text-purple-700">{entry.overtimeHours}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{fmt(entry.basePay)}</td>
                            <td className="px-3 py-2 text-right text-purple-700">{fmt(entry.overtimePay)}</td>
                            <td className="px-3 py-2 text-right text-green-700">{fmt(entry.allowancesTotal)}</td>
                            <td className="px-3 py-2 text-right text-red-600">{fmt(entry.deductionsTotal)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-gray-800">{fmt(entry.grossPay)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-gray-800">{fmt(entry.netPay)}</td>
                            <td className="px-3 py-2 text-right font-bold text-blue-700">
                              {fmt(finalPay)}
                              {hasAdj && (
                                <span title={entry.adjustmentNote ?? ''} className="ml-1 cursor-help text-amber-500">*</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ENTRY_STATUS_BADGE[entry.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                {entry.status}
                              </span>
                            </td>
                            {isAdmin && viewRun.status === 'draft' && (
                              <td className="px-3 py-2 text-center">
                                <button onClick={() => openAdjust(entry)}
                                  className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100">
                                  Adjust
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </Modal>
      )}

      {/* Adjust Entry Modal */}
      {adjEntry && (
        <Modal title={`Manual Adjustment — ${adjEntry.fullName}`} onClose={() => setAdjEntry(null)}>
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700 space-y-1">
              <p>Calculated Net Pay: <strong>{fmt(adjEntry.netPay)} {viewRun?.currency}</strong></p>
              {adjEntry.manualAdjustment != null && (
                <p>Current Adjustment: <strong className="text-amber-700">{fmt(adjEntry.manualAdjustment)}</strong></p>
              )}
            </div>
            <Field label="Adjusted Final Pay Amount">
              <input type="number" value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)}
                placeholder={`e.g. ${adjEntry.netPay}`} className={inputCls} />
            </Field>
            <Field label="Adjustment Note">
              <input value={adjNote} onChange={(e) => setAdjNote(e.target.value)}
                placeholder="Reason for adjustment..." className={inputCls} />
            </Field>
            {adjError && <p className="text-sm text-red-600">{adjError}</p>}
            <div className="flex gap-3 pt-2">
              <button onClick={() => void saveAdjust()} disabled={adjSaving}
                className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
                {adjSaving ? 'Saving...' : 'Save Adjustment'}
              </button>
              <button onClick={() => setAdjEntry(null)} className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// OT Policies Tab
function OTPoliciesTab({ onChange }: { onChange: (policies: OvertimePolicy[]) => void }) {
  const [policies, setPolicies] = useState<OvertimePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<OvertimePolicy> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchPolicies = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ policies: OvertimePolicy[] }>('/payroll/ot-policies');
      setPolicies(data.policies);
      onChange(data.policies);
    } finally { setLoading(false); }
  }, [onChange]);

  useEffect(() => { void fetchPolicies(); }, [fetchPolicies]);

  const handleSave = async () => {
    setError('');
    if (!editing?.name) { setError('Policy name is required'); return; }
    setSaving(true);
    try {
      if (editing._id) {
        await api.put(`/payroll/ot-policies/${editing._id}`, editing);
      } else {
        await api.post('/payroll/ot-policies', editing);
      }
      setEditing(null);
      await fetchPolicies();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this OT policy?')) {
      try {
        await api.delete(`/payroll/ot-policies/${id}`);
        await fetchPolicies();
      } catch (err: any) {
        setError(err.response?.data?.message ?? 'Failed to delete');
      }
    }
  };

  const defaultPolicy: Partial<OvertimePolicy> = {
    name: '', description: '',
    dailyThresholdHours: 8, dailyOTRate: 1.5,
    weeklyThresholdHours: 40, weeklyOTRate: 1.5,
    weekendRate: 2, holidayRate: 3, maxOTHoursPerMonth: null,
  };

  return (
    <div className="space-y-4">
      <button onClick={() => { setEditing(defaultPolicy); setError(''); }}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
        + New OT Policy
      </button>

      {loading ? <p className="text-sm text-gray-400">Loading...</p> : policies.length === 0 ? (
        <p className="text-sm text-gray-400">No OT policies configured.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {policies.map((p) => (
            <div key={p._id} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.description}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditing(p); setError(''); }} className="text-xs text-blue-600 hover:underline">Edit</button>
                  <button onClick={() => void handleDelete(p._id)} className="text-xs text-red-500 hover:underline">Delete</button>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-xs text-gray-600">
                <p>Daily: {p.dailyThresholdHours}h threshold, {p.dailyOTRate}x rate</p>
                <p>Weekly: {p.weeklyThresholdHours}h threshold, {p.weeklyOTRate}x rate</p>
                <p>Weekend: {p.weekendRate}x rate, Holiday: {p.holidayRate}x rate</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Modal title={editing._id ? 'Edit OT Policy' : 'New OT Policy'} onClose={() => setEditing(null)} wide={false}>
          <div className="space-y-4">
            <Field label="Policy Name *">
              <input value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="e.g. Standard OT" className={inputCls} />
            </Field>
            <Field label="Description">
              <input value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                placeholder="e.g. Standard overtime policy" className={inputCls} />
            </Field>
            <div className="rounded-lg border bg-gray-50 p-4">
              <p className="mb-3 text-xs font-semibold uppercase text-gray-700">Daily Overtime</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Threshold (hours)">
                  <input type="number" value={editing.dailyThresholdHours ?? 8} onChange={(e) => setEditing({ ...editing, dailyThresholdHours: parseFloat(e.target.value) })}
                    className={inputCls} />
                </Field>
                <Field label="Rate Multiplier">
                  <input type="number" step="0.1" value={editing.dailyOTRate ?? 1.5} onChange={(e) => setEditing({ ...editing, dailyOTRate: parseFloat(e.target.value) })}
                    className={inputCls} />
                </Field>
              </div>
            </div>
            <div className="rounded-lg border bg-gray-50 p-4">
              <p className="mb-3 text-xs font-semibold uppercase text-gray-700">Weekly Overtime</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Threshold (hours)">
                  <input type="number" value={editing.weeklyThresholdHours ?? 40} onChange={(e) => setEditing({ ...editing, weeklyThresholdHours: parseFloat(e.target.value) })}
                    className={inputCls} />
                </Field>
                <Field label="Rate Multiplier">
                  <input type="number" step="0.1" value={editing.weeklyOTRate ?? 1.5} onChange={(e) => setEditing({ ...editing, weeklyOTRate: parseFloat(e.target.value) })}
                    className={inputCls} />
                </Field>
              </div>
            </div>
            <div className="rounded-lg border bg-gray-50 p-4">
              <p className="mb-3 text-xs font-semibold uppercase text-gray-700">Special Rates</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Weekend Rate">
                  <input type="number" step="0.1" value={editing.weekendRate ?? 2} onChange={(e) => setEditing({ ...editing, weekendRate: parseFloat(e.target.value) })}
                    className={inputCls} />
                </Field>
                <Field label="Holiday Rate">
                  <input type="number" step="0.1" value={editing.holidayRate ?? 3} onChange={(e) => setEditing({ ...editing, holidayRate: parseFloat(e.target.value) })}
                    className={inputCls} />
                </Field>
                <Field label="Max OT/Month (blank = unlimited)">
                  <input type="number" value={editing.maxOTHoursPerMonth ?? ''} onChange={(e) => setEditing({ ...editing, maxOTHoursPerMonth: e.target.value ? parseFloat(e.target.value) : null })}
                    className={inputCls} />
                </Field>
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={saving}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                {saving ? 'Saving...' : 'Save Policy'}
              </button>
              <button onClick={() => setEditing(null)} className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// My Payslip Tab - Employee self-service view (Vietnam-compliant)
function MyPayslipTab() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSlip, setLoadingSlip] = useState(false);
  const [error, setError] = useState('');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [entry, setEntry] = useState<PayrollRunEntry | null>(null);
  const [runStatus, setRunStatus] = useState<RunStatus>('draft');

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await api.get<{ runs: PayrollRun[] }>('/payroll/runs');
        setRuns(data.runs);
        if (data.runs.length > 0) setSelectedRunId(data.runs[0]._id);
      } catch { setError('Failed to load payroll runs'); }
      finally { setLoading(false); }
    };
    void fetch();
  }, []);

  useEffect(() => {
    if (!selectedRunId) return;
    const fetchSlip = async () => {
      setLoadingSlip(true); setEntry(null);
      try {
        const { data } = await api.get<{ run: PayrollRun }>(`/payroll/runs/${selectedRunId}`);
        const myEntry = data.run.entries[0] ?? null;
        setEntry(myEntry);
        setRunStatus(data.run.status);
      } catch { setError('Failed to load payslip'); }
      finally { setLoadingSlip(false); }
    };
    void fetchSlip();
  }, [selectedRunId]);

  const fmt = (n: number) => (n ?? 0).toLocaleString();
  const selectedRun = runs.find(r => r._id === selectedRunId);

  if (loading) return <p className="text-center text-sm text-gray-400">Loading...</p>;
  if (error) return <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  if (runs.length === 0) {
    return <p className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400">No payslips available yet. Ask HR/Admin to run payroll.</p>;
  }

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-gray-700">Payslip period:</p>
        <select value={selectedRunId ?? ''} onChange={(e) => setSelectedRunId(e.target.value)} className="rounded-lg border bg-white px-3 py-2 text-sm">
          {runs.map((r) => (
            <option key={r._id} value={r._id}>
              {MONTHS[r.month - 1]} {r.year} — {STATUS_LABEL[r.status]}
            </option>
          ))}
        </select>
        {selectedRun && (
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE[selectedRun.status]}`}>
            {STATUS_LABEL[selectedRun.status]}
          </span>
        )}
      </div>

      {loadingSlip && <p className="text-center text-sm text-gray-400">Loading payslip...</p>}

      {entry && !loadingSlip && (
        <div className="space-y-4">

          {/* Status notice */}
          {runStatus === 'draft' && (
            <p className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2 text-xs text-yellow-800">
              This payslip is still a <strong>Draft</strong> — figures are preliminary and may change pending HR approval.
            </p>
          )}
          {runStatus === 'under_review' && (
            <p className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-xs text-orange-800">
              This payslip is <strong>Under Review</strong> by HR. Figures are pending final approval.
            </p>
          )}
          {(runStatus === 'approved' || runStatus === 'exported') && (
            <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-xs text-green-800">
              This is your <strong>Official Payslip</strong> — approved and locked by HR.
            </p>
          )}

          {/* Employee info */}
          <div className="grid gap-4 rounded-xl border bg-white p-5 shadow-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-gray-500">Employee</p>
              <p className="font-semibold text-gray-800">{entry.fullName}</p>
              <p className="text-xs text-gray-400">{entry.email}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Position / Department</p>
              <p className="font-semibold text-gray-800">{entry.jobTitle}</p>
              <p className="text-xs text-gray-400">{entry.department}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Pay Type / Period</p>
              <p className="font-semibold capitalize text-gray-800">{entry.payType}</p>
              <p className="text-xs text-gray-400">{selectedRun ? `${MONTHS[selectedRun.month - 1]} ${selectedRun.year}` : ''}</p>
            </div>
          </div>

          {/* Attendance summary */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Attendance Summary</h3>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
              {[
                { label: 'Work Days', value: entry.workingDays, color: 'text-gray-800' },
                { label: 'Present', value: entry.presentDays, color: 'text-green-700' },
                { label: 'Late', value: entry.lateDays, color: 'text-amber-600' },
                { label: 'Absent', value: entry.absentDays, color: 'text-red-600' },
                { label: 'Leave', value: entry.leaveDays, color: 'text-blue-600' },
                { label: 'Reg. Hrs', value: entry.regularHours, color: 'text-gray-700' },
                { label: 'OT Hrs', value: entry.overtimeHours, color: 'text-purple-700' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-lg bg-gray-50 p-3 text-center">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className={`mt-0.5 text-lg font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Gross pay build-up */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Earnings</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Base Pay ({entry.payType})</span>
                <span className="font-medium">{fmt(entry.basePay)} {entry.currency}</span>
              </div>
              {entry.overtimePay > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Overtime Pay</span>
                  <span className="font-medium text-purple-700">+ {fmt(entry.overtimePay)} {entry.currency}</span>
                </div>
              )}
              {entry.allowanceItems.map((item, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-gray-600 pl-2">
                    {item.name}
                    {!item.taxable && <span className="ml-1 text-xs text-gray-400">(non-taxable)</span>}
                  </span>
                  <span className="font-medium text-green-700">+ {fmt(item.amount)} {entry.currency}</span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-2 font-bold text-blue-700">
                <span>Gross Pay</span>
                <span>{fmt(entry.grossPay)} {entry.currency}</span>
              </div>
            </div>
          </div>

          {/* Vietnam Statutory Deductions */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">
              Statutory Deductions (Vietnam)
            </h3>
            <div className="space-y-2 text-sm">
              <p className="text-xs text-gray-400">
                Insurable salary: {fmt(entry.insurableSalary)} {entry.currency}
                {entry.insurableSalary < entry.grossPay && ' (capped at 20× base salary = 46,800,000 VND)'}
              </p>

              <div className="mt-2 rounded-lg bg-orange-50 p-3 space-y-1.5">
                <p className="text-xs font-semibold text-orange-800 uppercase tracking-wide">Employee Insurance Contributions</p>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">BHXH – Social Insurance (8%)</span>
                  <span className="text-red-600">- {fmt(entry.bhxhEmployee)} {entry.currency}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">BHYT – Health Insurance (1.5%)</span>
                  <span className="text-red-600">- {fmt(entry.bhytEmployee)} {entry.currency}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">BHTN – Unemployment Insurance (1%)</span>
                  <span className="text-red-600">- {fmt(entry.bhtnEmployee)} {entry.currency}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold border-t border-orange-200 pt-1">
                  <span>Total Insurance (10.5%)</span>
                  <span className="text-red-700">- {fmt(entry.totalInsuranceEmployee)} {entry.currency}</span>
                </div>
              </div>

              <div className="rounded-lg bg-blue-50 p-3 space-y-1.5">
                <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Personal Income Tax (PIT)</p>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Personal Relief</span>
                  <span className="text-blue-600">- {fmt(entry.personalRelief)} {entry.currency}</span>
                </div>
                {entry.dependentRelief > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Dependent Relief ({entry.numberOfDependents} × 4,400,000)</span>
                    <span className="text-blue-600">- {fmt(entry.dependentRelief)} {entry.currency}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-semibold">
                  <span>Taxable Income</span>
                  <span>{fmt(entry.taxableIncome)} {entry.currency}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold border-t border-blue-200 pt-1">
                  <span>PIT Amount</span>
                  <span className="text-red-700">- {fmt(entry.pitAmount)} {entry.currency}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Extra deductions */}
          {entry.deductionItems.length > 0 && (
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Other Deductions</h3>
              <div className="space-y-2 text-sm">
                {entry.deductionItems.map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-gray-600">{item.name}</span>
                    <span className="text-red-600">- {fmt(item.amount)} {entry.currency}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Net pay summary */}
          <div className="rounded-xl border-2 border-green-300 bg-green-50 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-green-800">Total Net Pay</p>
                <p className="text-xs text-green-700 mt-0.5">
                  Gross ({fmt(entry.grossPay)}) − Insurance ({fmt(entry.totalInsuranceEmployee)}) − PIT ({fmt(entry.pitAmount)})
                  {entry.deductionItems.length > 0 && ` − Other (${fmt(entry.deductionsTotal - entry.totalStatutoryDeductions)})`}
                </p>
              </div>
              <p className="text-2xl font-bold text-green-800">
                {fmt(entry.manualAdjustment ?? entry.netPay)} {entry.currency}
              </p>
            </div>
            {entry.manualAdjustment != null && (
              <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
                Manual adjustment applied by HR. Original calculated net: {fmt(entry.netPay)} {entry.currency}.
                {entry.adjustmentNote && ` Note: ${entry.adjustmentNote}`}
              </p>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

// Departments Tab
function DepartmentsTab({ onChange }: { onChange: (depts: Department[]) => void }) {
  const [depts, setDepts] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Department> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchDepts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ departments: Department[] }>('/payroll/departments');
      setDepts(data.departments);
      onChange(data.departments);
    } finally { setLoading(false); }
  }, [onChange]);

  useEffect(() => { void fetchDepts(); }, [fetchDepts]);

  const handleSave = async () => {
    setError('');
    if (!editing?.name) { setError('Department name is required'); return; }
    if (!editing?.code) { setError('Department code is required'); return; }
    setSaving(true);
    try {
      if (editing._id) {
        await api.put(`/payroll/departments/${editing._id}`, editing);
      } else {
        await api.post('/payroll/departments', editing);
      }
      setEditing(null);
      await fetchDepts();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this department?')) {
      try {
        await api.delete(`/payroll/departments/${id}`);
        await fetchDepts();
      } catch (err: any) {
        setError(err.response?.data?.message ?? 'Failed to delete');
      }
    }
  };

  return (
    <div className="space-y-4">
      <button onClick={() => { setEditing({ name: '', code: '', locationCode: '', country: '', currency: 'VND' }); setError(''); }}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
        + New Department
      </button>

      {loading ? <p className="text-sm text-gray-400">Loading...</p> : depts.length === 0 ? (
        <p className="text-sm text-gray-400">No departments configured.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-200">
                {['Name', 'Code', 'Location', 'Country', 'Currency', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {depts.map((d) => (
                <tr key={d._id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{d.name}</td>
                  <td className="px-4 py-3"><span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono font-semibold text-gray-700">{d.code}</span></td>
                  <td className="px-4 py-3 text-sm text-gray-600">{d.locationCode || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{d.country || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{d.currency}</td>
                  <td className="px-4 py-3 flex gap-3">
                    <button onClick={() => { setEditing(d); setError(''); }} className="text-xs text-blue-600 hover:underline">Edit</button>
                    <button onClick={() => void handleDelete(d._id)} className="text-xs text-red-500 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal title={editing._id ? 'Edit Department' : 'New Department'} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
              <Field label="Department Name *">
                <input value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="e.g. Engineering" className={inputCls} />
              </Field>
              <Field label="Code * (uppercase)">
                <input value={editing.code ?? ''} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. ENG" maxLength={10} className={inputCls} />
              </Field>
              <Field label="Location Code">
                <input value={editing.locationCode ?? ''} onChange={(e) => setEditing({ ...editing, locationCode: e.target.value })}
                  placeholder="e.g. VN-HCM" className={inputCls} />
              </Field>
              <Field label="Country">
                <input value={editing.country ?? ''} onChange={(e) => setEditing({ ...editing, country: e.target.value })}
                  placeholder="e.g. Vietnam" className={inputCls} />
              </Field>
            </div>
            <Field label="Default Currency">
              <select value={editing.currency ?? 'VND'} onChange={(e) => setEditing({ ...editing, currency: e.target.value })} className={selectCls}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={saving}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                {saving ? 'Saving...' : 'Save Department'}
              </button>
              <button onClick={() => setEditing(null)} className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Main Page
type Tab = 'runs' | 'employees' | 'ot-policies' | 'departments' | 'my-payslip';

const ADMIN_TABS: { key: Tab; label: string }[] = [
  { key: 'runs', label: 'Pay Runs' },
  { key: 'employees', label: 'Employee Profiles' },
  { key: 'ot-policies', label: 'OT Policies' },
  { key: 'departments', label: 'Departments' },
];

const EMPLOYEE_TABS: { key: Tab; label: string }[] = [
  { key: 'runs', label: 'Pay Runs' },
  { key: 'my-payslip', label: 'My Payslip' },
];

export default function PayrollPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('runs');
  const [otPolicies, setOtPolicies] = useState<OvertimePolicy[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const isAdmin = user?.role === 'admin';
  const visibleTabs = isAdmin ? ADMIN_TABS : EMPLOYEE_TABS;

  // Ensure the current tab is valid for the user role
  useEffect(() => {
    if (!visibleTabs.find(t => t.key === tab)) {
      setTab(visibleTabs[0]?.key || 'runs');
    }
  }, [isAdmin, tab, visibleTabs]);

  useEffect(() => {
    if (isAdmin) {
      api.get<{ policies: OvertimePolicy[] }>('/payroll/ot-policies').then(({ data }) => setOtPolicies(data.policies)).catch(() => {});
      api.get<{ departments: Department[] }>('/payroll/departments').then(({ data }) => setDepartments(data.departments)).catch(() => {});
    }
  }, [isAdmin]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          {isAdmin ? 'Payroll Management' : 'My Payroll'}
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {isAdmin
            ? 'Enterprise payroll - versioned profiles, rule-based calculation, approval workflow'
            : 'View your payroll information and approved payslips'}
        </p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1">
        {visibleTabs.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'runs' && <RunsTab />}
      {isAdmin && tab === 'employees' && <EmployeesTab otPolicies={otPolicies} departments={departments} />}
      {isAdmin && tab === 'ot-policies' && <OTPoliciesTab onChange={setOtPolicies} />}
      {isAdmin && tab === 'departments' && <DepartmentsTab onChange={setDepartments} />}
      {!isAdmin && tab === 'my-payslip' && <MyPayslipTab />}
    </div>
  );
}