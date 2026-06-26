"use client";

import { useMemo, useState } from 'react';
import { AlertTriangle, Download, FileJson, Plus, Search, Trash2 } from 'lucide-react';
import type { CollectionRecord, CollectionStatus } from '@/lib/collections/types';
import type { ViewAsContext } from '@/lib/dashboard/view-as';
import { computedCollectionStatus, daysUntil, formatGbp, outstandingBalance } from '@/lib/collections/format';
import { buildCollectionSummary, filterCollectionPipeline, shouldShowCollectedForStatusFilter, type DateAddedFilter } from '@/lib/collections/pipeline';

type RepOption = { id: string; name: string; email?: string; role?: string; sales_role?: string | null };

type FormState = {
  id?: string;
  client_name: string;
  telegram: string;
  phone_number: string;
  owner_user_id: string;
  total_sale_value: string;
  amount_paid: string;
  collection_type: string;
  sale_date: string;
  balance_due_date: string;
  next_follow_up_date: string;
  risk: 'Low' | 'Medium' | 'High';
  status: CollectionStatus;
  payment_link: string;
  notes: string;
};

const emptyForm: FormState = {
  client_name: '', telegram: '', phone_number: '', owner_user_id: '',
  total_sale_value: '3000', amount_paid: '0', collection_type: 'Deposit then balance',
  sale_date: '', balance_due_date: '', next_follow_up_date: '', risk: 'Medium', status: 'Open', payment_link: '', notes: '',
};

export default function CollectionsClient({
  initialCollections,
  reps,
  isAdmin,
  viewAsContext,
}: {
  initialCollections: CollectionRecord[];
  reps: RepOption[];
  isAdmin: boolean;
  viewAsContext?: ViewAsContext;
}) {
  const [collections, setCollections] = useState(initialCollections);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [dateAddedFilter, setDateAddedFilter] = useState<DateAddedFilter>('all');
  const [dateAddedFrom, setDateAddedFrom] = useState('');
  const [dateAddedTo, setDateAddedTo] = useState('');
  const [showCollected, setShowCollected] = useState(false);
  const [message, setMessage] = useState('');
  const isViewingAs = Boolean(viewAsContext?.isViewingAs);
  const canManageCollections = !isViewingAs;
  const canUseAdminActions = isAdmin && !isViewingAs;

  const visible = useMemo(() => {
    return filterCollectionPipeline(collections, { query, statusFilter, riskFilter, typeFilter, ownerFilter, showCollected, dateAddedFilter, dateAddedFrom, dateAddedTo });
  }, [collections, query, statusFilter, riskFilter, typeFilter, ownerFilter, showCollected, dateAddedFilter, dateAddedFrom, dateAddedTo]);

  const summary = useMemo(() => buildCollectionSummary(visible), [visible]);
  const active = summary.activeRecords;
  const overdue = summary.overdueRecords;
  const due7 = summary.dueNextSevenDaysRecords;
  const effectiveShowCollected = shouldShowCollectedForStatusFilter(statusFilter, showCollected);

  function handleStatusFilter(value: string) {
    setStatusFilter(value);
    if (value === 'Collected') setShowCollected(true);
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function edit(record: CollectionRecord) {
    if (isViewingAs) return setMessage('Exit view-as mode to make admin changes.');
    setForm({
      id: record.id,
      client_name: record.client_name || '',
      telegram: record.telegram || '',
      phone_number: record.phone_number || '',
      owner_user_id: record.owner_user_id || '',
      total_sale_value: String(record.total_sale_value || 0),
      amount_paid: String(record.amount_paid || 0),
      collection_type: record.collection_type || 'Deposit then balance',
      sale_date: record.sale_date || '',
      balance_due_date: record.balance_due_date || '',
      next_follow_up_date: record.next_follow_up_date || '',
      risk: (record.risk as FormState['risk']) || 'Medium',
      status: (record.status as CollectionStatus) || 'Open',
      payment_link: record.payment_link || '',
      notes: record.notes || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save() {
    if (isViewingAs) return setMessage('Exit view-as mode to make admin changes.');
    setMessage('Saving...');
    const payload = {
      ...form,
      owner_user_id: form.owner_user_id || null,
      total_sale_value: Number(form.total_sale_value || 0),
      amount_paid: Number(form.amount_paid || 0),
    };
    const res = await fetch(form.id ? `/api/collections/${form.id}` : '/api/collections', {
      method: form.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) {
      setMessage(body.error || 'Save failed');
      return;
    }
    setCollections((current) => form.id ? current.map((item) => item.id === body.collection.id ? body.collection : item) : [body.collection, ...current]);
    setForm(emptyForm);
    setMessage('Collection saved');
  }

  async function remove(id: string) {
    if (isViewingAs) return setMessage('Exit view-as mode to make admin changes.');
    if (!confirm('Delete this collection record?')) return;
    const res = await fetch(`/api/collections/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json();
      setMessage(body.error || 'Delete failed');
      return;
    }
    setCollections((current) => current.filter((record) => record.id !== id));
  }

  async function markCollected(record: CollectionRecord) {
    if (isViewingAs) return setMessage('Exit view-as mode to make admin changes.');
    const res = await fetch(`/api/collections/${record.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount_paid: record.total_sale_value || 0, status: 'Collected' }),
    });
    const body = await res.json();
    if (res.ok) {
      setCollections((current) => current.map((item) => item.id === record.id ? body.collection : item));
      setMessage('Collection marked as collected. Turn on Show collected to view completed records.');
    }
    else setMessage(body.error || 'Could not mark collected');
  }

  async function exportBackup() {
    const res = await fetch('/api/collections/export');
    const body = await res.json();
    if (!res.ok) return setMessage(body.error || 'Export failed');
    download(`credit-club-collections-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: 'Credit Club Collections', version: 2, exportedAt: new Date().toISOString(), collections: body.collections }, null, 2), 'application/json');
  }

  async function exportCsv() {
    const res = await fetch('/api/collections/export');
    const body = await res.json();
    if (!res.ok) return setMessage(body.error || 'Export failed');
    const headers = ['Client','Telegram','Phone','Owner','Sale Value','Amount Paid','Balance Due','Type','Sale Date','Balance Due Date','Next Follow Up','Risk','Status','Payment Link','Notes'];
    const lines = [headers.join(',')].concat(body.collections.map((x: CollectionRecord) => [x.client_name,x.telegram,x.phone_number,x.owner_name,x.total_sale_value,x.amount_paid,outstandingBalance(x),x.collection_type,x.sale_date,x.balance_due_date,x.next_follow_up_date,x.risk,computedCollectionStatus(x),x.payment_link,x.notes].map(csvCell).join(',')));
    download(`credit-club-collections-${new Date().toISOString().slice(0, 10)}.csv`, lines.join('\n'), 'text/csv');
  }

  async function importBackup(file: File | undefined) {
    if (!file) return;
    const parsed = JSON.parse(await file.text());
    const res = await fetch('/api/collections/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collections: parsed.collections || parsed.data || parsed }) });
    const body = await res.json();
    setMessage(res.ok ? `Imported ${body.imported} records` : body.error || 'Import failed');
  }

  async function clearAll() {
    if (!confirm('Admin only: clear ALL collection records? This cannot be undone.')) return;
    const res = await fetch('/api/collections/clear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmed: true }) });
    if (res.ok) setCollections([]);
    else setMessage((await res.json()).error || 'Clear failed');
  }

  return <div className="space-y-6">
    {isViewingAs && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
      {viewAsContext?.viewAsError
        ? `${viewAsContext.viewAsError}. Admin actions are disabled in preview mode.`
        : `You are previewing the dashboard as ${viewAsContext?.effectiveRepName}. Admin actions are disabled in preview mode.`} <a className="font-semibold underline" href="/dashboard/collections">Exit view-as mode to make admin changes.</a>
    </div>}
    {message && <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">{message}</div>}

    <div className="grid gap-4 md:grid-cols-4">
      <Metric label="Outstanding balance" value={formatGbp(summary.outstandingBalance)} sub={`${summary.activeCount} active balances`} />
      <Metric label="Overdue balance" value={formatGbp(summary.overdueBalance)} sub={`${overdue.length} overdue clients`} danger />
      <Metric label="Due next 7 days" value={formatGbp(summary.dueNextSevenDaysBalance)} sub={`${due7.length} to chase`} warning />
      <Metric label="Deposits collected" value={formatGbp(summary.depositsCollected)} sub={`Active visible records only`} success />
    </div>
    {effectiveShowCollected && <p className="text-xs text-zinc-500">Summary cards still show active, uncollected collection work only. Completed records are included in the table because Show collected is on.</p>}

    {canManageCollections ? <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Add or update collection</h2><p className="text-sm text-zinc-500">Deposits, balances, payment plans, partial access and failed payment follow-up.</p></div>
        <div className="flex gap-2"><button disabled={isViewingAs} onClick={() => setForm(emptyForm)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Clear form</button><button disabled={isViewingAs} onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" />Save collection</button></div>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Input label="Client name" value={form.client_name} onChange={(v) => updateField('client_name', v)} />
        <Input label="Telegram" value={form.telegram} onChange={(v) => updateField('telegram', v)} />
        <Input label="Phone number" value={form.phone_number} onChange={(v) => updateField('phone_number', v)} />
        <Select label="Owner / Linked closer or SDR" value={form.owner_user_id} onChange={(v) => updateField('owner_user_id', v)} options={reps.map((r) => [r.id, r.name])} placeholder="Unassigned" />
        <Input label="Total sale value £" value={form.total_sale_value} onChange={(v) => updateField('total_sale_value', v)} type="number" />
        <Input label="Amount paid / deposit £" value={form.amount_paid} onChange={(v) => updateField('amount_paid', v)} type="number" />
        <Select label="Collection type" value={form.collection_type} onChange={(v) => updateField('collection_type', v)} options={['Deposit then balance','Payment plan','Split pay','Partial access collection','Failed payment recovery','Manual invoice'].map((x) => [x, x])} />
        <Input label="Sale date" value={form.sale_date} onChange={(v) => updateField('sale_date', v)} type="date" />
        <Input label="Balance due date" value={form.balance_due_date} onChange={(v) => updateField('balance_due_date', v)} type="date" />
        <Input label="Next follow-up date" value={form.next_follow_up_date} onChange={(v) => updateField('next_follow_up_date', v)} type="date" />
        <Select label="Risk" value={form.risk} onChange={(v) => updateField('risk', v as FormState['risk'])} options={['Low','Medium','High'].map((x) => [x, x])} />
        <Select label="Status" value={form.status} onChange={(v) => updateField('status', v as CollectionStatus)} options={['Open','Due Soon','Overdue','Collected','Failed Payment','Refund Risk','Cancelled'].map((x) => [x, x])} />
        <div className="md:col-span-3"><Input label="Payment link" value={form.payment_link} onChange={(v) => updateField('payment_link', v)} /></div>
        <div className="md:col-span-4"><label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-300">Notes</label><textarea value={form.notes} onChange={(e) => updateField('notes', e.target.value)} className="min-h-20 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" /></div>
      </div>
    </section> : <section className="rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">Exit view-as mode to make admin changes.</section>}

    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Collection pipeline</h2><p className="text-sm text-zinc-500">Server-filtered records for your role.</p></div>
        {canUseAdminActions && <div className="flex flex-wrap gap-2"><button onClick={exportBackup} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><FileJson className="h-4 w-4" />Export all backup</button><button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><Download className="h-4 w-4" />Export all CSV</button><label className="cursor-pointer rounded-lg border px-3 py-2 text-sm">Import backup<input type="file" accept="application/json" className="hidden" onChange={(e) => importBackup(e.target.files?.[0])} /></label><button onClick={clearAll} className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600"><Trash2 className="h-4 w-4" />Clear all</button></div>}
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-8">
        <div className="relative md:col-span-2"><Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search client, closer, owner, notes" className="w-full rounded-lg border border-zinc-200 py-2 pl-9 pr-3 text-sm dark:border-zinc-700 dark:bg-zinc-950" /></div>
        <Filter value={typeFilter} onChange={setTypeFilter} options={[['deposit','Deposits / balances'],['plan','Payment plans'],['other','Other']]} placeholder="All types" />
        <Filter value={statusFilter} onChange={handleStatusFilter} options={['Open','Due Soon','Overdue','Collected','Failed Payment','Refund Risk','Cancelled'].map((x) => [x, x])} placeholder="All statuses" />
        <Filter value={riskFilter} onChange={setRiskFilter} options={['Low','Medium','High'].map((x) => [x, x])} placeholder="All risks" />
        <label className="block"><span className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-300">Date added</span><select value={dateAddedFilter} onChange={(event) => setDateAddedFilter(event.target.value as DateAddedFilter)} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950">
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="last7">Last 7 days</option>
          <option value="last30">Last 30 days</option>
          <option value="thisMonth">This month</option>
          <option value="custom">Custom range</option>
        </select></label>
        {canUseAdminActions && <Filter value={ownerFilter} onChange={setOwnerFilter} options={reps.map((r) => [r.id, r.name])} placeholder="All owners" />}
        <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
          <input type="checkbox" checked={effectiveShowCollected} onChange={(e) => setShowCollected(e.target.checked)} className="h-4 w-4" />
          Show collected
        </label>
      </div>
      {dateAddedFilter === 'custom' && <div className="mb-4 grid gap-3 md:grid-cols-4">
        <Input label="From date" value={dateAddedFrom} onChange={setDateAddedFrom} type="date" />
        <Input label="To date" value={dateAddedTo} onChange={setDateAddedTo} type="date" />
      </div>}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800"><table className="min-w-[1200px] w-full text-left text-sm"><thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950"><tr><th className="p-3">Client</th><th className="p-3">Owner</th><th className="p-3">Payment</th><th className="p-3">Paid</th><th className="p-3">Outstanding</th><th className="p-3">Due</th><th className="p-3">Follow up</th><th className="p-3">Status</th><th className="p-3">Risk</th><th className="p-3">Notes</th>{canManageCollections && <th className="p-3">Actions</th>}</tr></thead><tbody>{visible.map((record) => <tr key={record.id} className="border-t border-zinc-100 dark:border-zinc-800"><td className="p-3 font-medium">{record.client_name}<div className="text-xs font-normal text-zinc-500">{record.telegram || record.phone_number || 'No contact'}</div></td><td className="p-3">{record.owner_name || 'Unassigned'}</td><td className="p-3">{record.collection_type}</td><td className="p-3 font-semibold">{formatGbp(record.amount_paid)}</td><td className="p-3 font-semibold">{formatGbp(outstandingBalance(record))}</td><td className="p-3">{record.balance_due_date || '—'}</td><td className="p-3">{record.next_follow_up_date || '—'}</td><td className="p-3"><StatusPill status={computedCollectionStatus(record)} /></td><td className="p-3">{record.risk}</td><td className="p-3 max-w-xs truncate">{record.notes}{record.payment_link && <a className="ml-2 text-indigo-600" href={record.payment_link} target="_blank">Link</a>}</td>{canManageCollections && <td className="p-3"><div className="flex gap-2"><button onClick={() => edit(record)} className="rounded border px-2 py-1 text-xs">Edit</button><button onClick={() => markCollected(record)} className="rounded border px-2 py-1 text-xs">Collected</button><button onClick={() => remove(record.id)} className="rounded border border-red-200 px-2 py-1 text-xs text-red-600">Delete</button></div></td>}</tr>)}</tbody></table>{visible.length === 0 && <div className="p-6 text-sm text-zinc-500">No collections match your filters.</div>}</div>
    </section>

    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /><h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Today’s chase board</h2></div>
      <div className="grid gap-3 md:grid-cols-4">{[['Overdue', overdue], ['Due in 7 days', due7], ['Follow up today', active.filter((x) => { const d = daysUntil(x.next_follow_up_date); return d !== null && d <= 0; })], ['High risk', active.filter((x) => x.risk === 'High')]].map(([name, items]) => <div key={String(name)} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950"><div className="mb-3 flex justify-between text-sm font-semibold"><span>{String(name)}</span><span>{(items as CollectionRecord[]).length}</span></div>{(items as CollectionRecord[]).slice(0, 8).map((x) => <div key={x.id} className="mb-2 rounded-lg bg-white p-3 text-sm shadow-sm dark:bg-zinc-900"><div className="font-semibold">{x.client_name}</div><div className="text-xs text-zinc-500">{formatGbp(outstandingBalance(x))} outstanding · {x.owner_name || 'No owner'}</div></div>)}</div>)}</div>
    </section>
  </div>;
}

function Metric({ label, value, sub, danger, warning, success }: { label: string; value: string; sub: string; danger?: boolean; warning?: boolean; success?: boolean }) {
  const color = danger ? 'text-red-600' : warning ? 'text-amber-600' : success ? 'text-emerald-600' : 'text-indigo-600';
  return <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"><div className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</div><div className={`mt-2 text-2xl font-bold ${color}`}>{value}</div><div className="mt-1 text-sm text-zinc-500">{sub}</div></div>;
}
function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) { return <label className="block"><span className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-300">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" /></label>; }
function Select({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (v: string) => void; options: string[][]; placeholder?: string }) { return <label className="block"><span className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-300">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950">{placeholder && <option value="">{placeholder}</option>}{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>; }
function Filter({ value, onChange, options, placeholder, disabled }: { value: string; onChange: (v: string) => void; options: string[][]; placeholder: string; disabled?: boolean }) { return <select disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950"><option value="">{placeholder}</option>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>; }
function StatusPill({ status }: { status: string }) { const color = status === 'Collected' ? 'bg-emerald-100 text-emerald-700' : status === 'Overdue' || status === 'Failed Payment' ? 'bg-red-100 text-red-700' : status === 'Due Soon' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'; return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${color}`}>{status}</span>; }
function download(name: string, content: string, type: string) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; a.click(); URL.revokeObjectURL(a.href); }
function csvCell(v: unknown) { return '"' + String(v ?? '').replaceAll('"', '""') + '"'; }
