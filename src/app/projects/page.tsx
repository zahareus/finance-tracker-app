'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { parseDate, VALID_TYPES, signedAmount } from '@/lib/tx';
import { usePersistedFilters } from '@/hooks/usePersistedState';
import { useSheetData } from '@/hooks/useSheetData';
import { Button, Checkbox, SectionCard, SortArrow, StatTile, TooltipWithCalculation, TypeChip } from '@/components/ui';
import { copyRowsToClipboard, useCopyToast } from '@/lib/copyRows';

interface Transaction {
  row?: number;
  id?: string | null;
  link?: string | null;
  noTax?: boolean;
  date: string | null;
  amount: number;
  type: string;
  account: string;
  category: string;
  description: string;
  counterparty?: string;
  project?: string;
}

interface ProjectWithBonuses {
  name: string;
  bonusFromSum: number | null;
  bonusFromBalance: number | null;
  status: string; // 'live', 'closed', або пусто
}

interface ProjectsPersistedFilters {
  selectedProject: string;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
}

const formatNumber = (num: number): string => {
  if (typeof num !== 'number' || isNaN(num)) return '0,00';
  return num.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDateShort = (dateString: string | null | undefined, withYear = true): string => {
  const dt = parseDate(dateString);
  if (!dt) return '—';
  const day = String(dt.getUTCDate()).padStart(2, '0');
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return withYear ? `${day}.${month}.${dt.getUTCFullYear()}` : `${day}.${month}`;
};

const formatMoney = (value: number, showPlus = true): string => {
  const sign = value < 0 ? '− ' : showPlus ? '+ ' : '';
  return `${sign}${formatNumber(Math.abs(value))}`;
};

const bonusLabel = (project: ProjectWithBonuses) => {
  const parts = [project.bonusFromSum, project.bonusFromBalance].filter((v): v is number => typeof v === 'number');
  return parts.length ? parts.map(v => `${v}%`).join(' / ') : '—';
};

const projectStatusLabel = (project: ProjectWithBonuses | undefined) => project?.status === 'live' ? 'активний' : project?.status === 'closed' ? 'завершений' : 'без статусу';

const amountClass = (tx: Transaction) => tx.type === 'Витрата' ? 'text-expense' : 'text-income';

const ProjectsPage: React.FC = () => {
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [projectsWithBonuses, setProjectsWithBonuses] = useState<ProjectWithBonuses[]>([]);
  const { data, isLoading, error } = useSheetData();

  const [filters, updateFilters] = usePersistedFilters<ProjectsPersistedFilters>(
    'finance-tracker-projects-filters',
    { selectedProject: '', sortColumn: 'date', sortDirection: 'desc' }
  );

  const { selectedProject, sortColumn, sortDirection } = filters;
  const setSelectedProject = useCallback((value: string) => updateFilters({ selectedProject: value }), [updateFilters]);
  const setSortColumn = useCallback((value: string) => updateFilters({ sortColumn: value }), [updateFilters]);
  const setSortDirection = useCallback((value: 'asc' | 'desc') => updateFilters({ sortDirection: value }), [updateFilters]);

  useEffect(() => {
    if (!data) return;
    try {
      const cleanedTransactions = data.transactions.map((tx: any) => ({
        row: typeof tx.row === 'number' ? tx.row : undefined,
        id: tx.id ? String(tx.id).trim() : null,
        link: tx.link ? String(tx.link).trim() : null,
        noTax: !!tx.noTax,
        date: typeof tx.date === 'string' ? tx.date.trim() : null,
        amount: typeof tx.amount === 'number' && !isNaN(tx.amount) ? tx.amount : parseFloat(String(tx.amount || '0').replace(/,/g, '.').replace(/\s/g, '')) || 0,
        type: String(tx?.type || '').trim(),
        account: String(tx?.account || '').trim(),
        category: String(tx?.category || '').trim(),
        description: String(tx?.description || '').trim(),
        counterparty: tx?.counterparty ? String(tx.counterparty).trim() : '',
        project: tx?.project ? String(tx.project).trim() : '',
      })).filter((tx: Transaction) => tx.date && VALID_TYPES.includes(tx.type) && tx.account && tx.category && typeof tx.amount === 'number' && !isNaN(tx.amount));
      setAllTransactions(cleanedTransactions);

      const projectsData: ProjectWithBonuses[] = Array.isArray(data.projectsWithBonuses)
        ? data.projectsWithBonuses.map((p: any) => ({
            name: String(p.name || '').trim(),
            bonusFromSum: typeof p.bonusFromSum === 'number' && !isNaN(p.bonusFromSum) ? p.bonusFromSum : null,
            bonusFromBalance: typeof p.bonusFromBalance === 'number' && !isNaN(p.bonusFromBalance) ? p.bonusFromBalance : null,
            status: String(p.status || '').trim().toLowerCase(),
          })).filter((p: ProjectWithBonuses) => p.name)
        : [];
      setProjectsWithBonuses(projectsData);

      // Проект за замовчуванням лише якщо збереженого нема або він більше не існує в списку
      if (projectsData.length > 0) {
        const savedProject = filters.selectedProject;
        const projectExists = projectsData.some(p => p.name === savedProject);
        if (!savedProject || !projectExists) setSelectedProject(projectsData[0].name);
      }
    } catch (err) {
      console.error('Failed to process sheet data:', err);
    }
  }, [data, filters.selectedProject, setSelectedProject]);

  const handleSort = useCallback((column: string) => {
    if (sortColumn === column) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    else {
      setSortColumn(column);
      setSortDirection(column === 'date' ? 'desc' : 'asc');
    }
  }, [sortColumn, sortDirection, setSortColumn, setSortDirection]);

  const projectData = useMemo(() => {
    if (!selectedProject) {
      return {
        transactions: [],
        totalIncome: 0,
        totalExpenses: 0,
        taxes: 0,
        bonusFromSum: 0,
        bonusFromSumPercent: 0,
        bonusFromBalance: 0,
        bonusFromBalancePercent: 0,
        baseForBalanceBonus: 0,
        totalBonuses: 0,
        paidBonuses: 0,
        paidBonusesTransactions: [] as Transaction[],
        balance: 0,
        currentProject: null as ProjectWithBonuses | null
      };
    }

    const currentProject = projectsWithBonuses.find(p => p.name === selectedProject) || null;
    const projectTransactions = allTransactions.filter(tx => tx.project === selectedProject);

    const paidBonusesTransactions = projectTransactions.filter(tx => tx.type === 'Витрата' && tx.category === 'Бонуси і премії');
    const paidBonuses = paidBonusesTransactions.reduce((sum, tx) => sum + tx.amount, 0);

    const totalIncome = projectTransactions.filter(tx => tx.type === 'Надходження').reduce((sum, tx) => sum + tx.amount, 0);
    const totalExpenses = projectTransactions.filter(tx => tx.type === 'Витрата' && tx.category !== 'Бонуси і премії').reduce((sum, tx) => sum + tx.amount, 0);
    const taxes = totalIncome * 0.11;

    const bonusFromSumPercent = currentProject?.bonusFromSum ?? 0;
    const bonusFromSum = totalIncome * (bonusFromSumPercent / 100);

    const bonusFromBalancePercent = currentProject?.bonusFromBalance ?? 0;
    const baseForBalanceBonus = totalIncome - totalExpenses - taxes - bonusFromSum;
    const bonusFromBalance = baseForBalanceBonus > 0 ? baseForBalanceBonus * (bonusFromBalancePercent / 100) : 0;

    const totalBonuses = bonusFromSum + bonusFromBalance;
    const balance = totalIncome - totalExpenses - taxes - totalBonuses;

    return {
      transactions: projectTransactions,
      totalIncome,
      totalExpenses,
      taxes,
      bonusFromSum,
      bonusFromSumPercent,
      bonusFromBalance,
      bonusFromBalancePercent,
      baseForBalanceBonus,
      totalBonuses,
      paidBonuses,
      paidBonusesTransactions,
      balance,
      currentProject
    };
  }, [allTransactions, selectedProject, projectsWithBonuses]);

  const calculations = useMemo(() => {
    const { totalIncome, totalExpenses, taxes, bonusFromSum, bonusFromSumPercent, bonusFromBalance, bonusFromBalancePercent, baseForBalanceBonus, totalBonuses, paidBonuses, paidBonusesTransactions, balance } = projectData;
    let paidBonusesCalculation = 'Сума виплачених бонусів по проекту:\n';
    if (paidBonusesTransactions.length > 0) {
      paidBonusesTransactions.forEach((tx) => {
        paidBonusesCalculation += `${tx.date}: ${formatNumber(tx.amount)} ₴ - ${tx.description || tx.counterparty || 'Бонус'}\n`;
      });
      paidBonusesCalculation += `\nРазом: ${formatNumber(paidBonuses)} ₴`;
    } else {
      paidBonusesCalculation = 'Виплачених бонусів немає';
    }

    return {
      taxes: `Податки й комісії посередників — орієнтовно 11% від усього, що надійшло на проєкт\n= Надходження × 11%\n= ${formatNumber(totalIncome)} × 0.11\n= ${formatNumber(taxes)} ₴`,
      bonusFromSum: `Бонус з суми = Надходження × ${bonusFromSumPercent}%\n= ${formatNumber(totalIncome)} × ${bonusFromSumPercent / 100}\n= ${formatNumber(bonusFromSum)} ₴`,
      bonusFromBalance: `База = Надходження - Видатки - Податки - Бонус з суми\n= ${formatNumber(totalIncome)} - ${formatNumber(totalExpenses)} - ${formatNumber(taxes)} - ${formatNumber(bonusFromSum)}\n= ${formatNumber(baseForBalanceBonus)} ₴\n\nБонус з балансу = База × ${bonusFromBalancePercent}%\n= ${formatNumber(baseForBalanceBonus)} × ${bonusFromBalancePercent / 100}\n= ${formatNumber(bonusFromBalance)} ₴`,
      totalBonuses: bonusFromSum > 0 && bonusFromBalance > 0
        ? `Бонуси нарах. = Бонус з суми + Бонус з балансу\n= ${formatNumber(bonusFromSum)} + ${formatNumber(bonusFromBalance)}\n= ${formatNumber(totalBonuses)} ₴`
        : bonusFromSum > 0
          ? `Бонуси нарах. = Бонус з суми\n= ${formatNumber(bonusFromSum)} ₴`
          : bonusFromBalance > 0
            ? `Бонуси нарах. = Бонус з балансу\n= ${formatNumber(bonusFromBalance)} ₴`
            : 'Бонуси нарах. = 0 ₴',
      paidBonuses: paidBonusesCalculation,
      balance: `Баланс = Надходження - Видатки - Податки - Бонуси нарах.\n= ${formatNumber(totalIncome)} - ${formatNumber(totalExpenses)} - ${formatNumber(taxes)} - ${formatNumber(totalBonuses)}\n= ${formatNumber(balance)} ₴`
    };
  }, [projectData]);

  const sortedTransactions = useMemo(() => {
    return [...projectData.transactions].sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case 'id': comparison = (a.id || '').localeCompare(b.id || '', 'uk'); break;
        case 'date': {
          const dateA = parseDate(a.date);
          const dateB = parseDate(b.date);
          if (!dateA && !dateB) comparison = 0;
          else if (!dateA) comparison = 1;
          else if (!dateB) comparison = -1;
          else comparison = dateA.getTime() - dateB.getTime();
          break;
        }
        case 'type': comparison = (a.type || '').localeCompare(b.type || '', 'uk'); break;
        case 'amount': comparison = signedAmount(a) - signedAmount(b); break;
        case 'description': comparison = (a.description || '').localeCompare(b.description || '', 'uk'); break;
        case 'category': comparison = (a.category || '').localeCompare(b.category || '', 'uk'); break;
        case 'account': comparison = (a.account || '').localeCompare(b.account || '', 'uk'); break;
        case 'counterparty': comparison = (a.counterparty || '').localeCompare(b.counterparty || '', 'uk'); break;
        default: comparison = 0;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [projectData.transactions, sortColumn, sortDirection]);

  // Виділення рядків і «Скопіювати (N)» — той самий хелпер, що на Балансі
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { toast: copiedToast, showToast, showError } = useCopyToast();
  const rowKey = (tx: Transaction) => `${tx.row ?? ''}:${tx.id || ''}:${tx.date}:${tx.amount}`;
  const toggleSelected = useCallback((key: string) => setSelectedIds(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; }), []);
  const allVisibleSelected = sortedTransactions.length > 0 && sortedTransactions.every(tx => selectedIds.has(rowKey(tx)));
  const toggleAllVisible = useCallback(() => setSelectedIds(prev => { if (sortedTransactions.every(tx => prev.has(rowKey(tx)))) return new Set(); return new Set(sortedTransactions.map(rowKey)); }), [sortedTransactions]);
  const handleCopy = useCallback(async () => {
    const rows = sortedTransactions.filter(tx => selectedIds.has(rowKey(tx)));
    if (!rows.length) return;
    const header = ['ID', 'Дата', 'Сума', 'Тип', 'Рахунок', 'Категорія', 'Опис', 'Контрагент', 'Проект', 'Звʼязок', 'Без 11%'];
    const tsvRows = rows.map(tx => [tx.id || '', tx.date || '', tx.amount, tx.type, tx.account, tx.category, tx.description, tx.counterparty || '', tx.project || '', tx.link || '', tx.noTax ? 'TRUE' : '']);
    const { ok } = await copyRowsToClipboard(header, tsvRows);
    if (ok) showToast(rows.length); else showError();
  }, [sortedTransactions, selectedIds, showToast, showError]);

  useEffect(() => { setSelectedIds(new Set()); }, [selectedProject]);

  const handleExportXls = useCallback(async () => {
    const writeXlsxFile = (await import('write-excel-file/browser')).default;
    const header = (value: string) => ({ value, fontWeight: 'bold' as const });
    const columns = [
      { header: header('ID'), width: 8, cell: (tx: Transaction) => ({ type: String, value: tx.id || '' }) },
      { header: header('Дата'), width: 12, cell: (tx: Transaction) => { const dt = parseDate(tx.date); return dt ? { type: Date, format: 'dd.mm.yyyy', value: dt } : { type: String, value: tx.date || '' }; } },
      { header: header('Тип'), width: 16, cell: (tx: Transaction) => ({ type: String, value: tx.type || '' }) },
      { header: header('Сума'), width: 12, cell: (tx: Transaction) => ({ type: Number, format: '#,##0.00', value: tx.amount }) },
      { header: header('Опис'), width: 40, cell: (tx: Transaction) => ({ type: String, value: tx.description || '' }) },
      { header: header('Категорія'), width: 24, cell: (tx: Transaction) => ({ type: String, value: tx.category || '' }) },
      { header: header('Рахунок'), width: 12, cell: (tx: Transaction) => ({ type: String, value: tx.account || '' }) },
      { header: header('Контрагент'), width: 18, cell: (tx: Transaction) => ({ type: String, value: tx.counterparty || '' }) },
    ];
    await writeXlsxFile(sortedTransactions, { columns, stickyRowsCount: 1 }).toFile(`projects-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, [sortedTransactions]);

  const mobileProject = projectsWithBonuses.find(p => p.name === selectedProject);
  // Під «Бонуси нараховані» — лише ненульові частини
  const bonusPartsLabel = [projectData.bonusFromSum > 0 ? `з суми ${formatNumber(projectData.bonusFromSum)}` : null, projectData.bonusFromBalance > 0 ? `з балансу ${formatNumber(projectData.bonusFromBalance)}` : null].filter(Boolean).join(' · ');
  const columns = [
    { key: 'id', label: 'ID', align: 'text-left' },
    { key: 'date', label: 'Дата', align: 'text-left' },
    { key: 'type', label: 'Тип', align: 'text-left' },
    { key: 'amount', label: 'Сума', align: 'text-right' },
    { key: 'description', label: 'Опис', align: 'text-left' },
    { key: 'category', label: 'Категорія', align: 'text-left' },
    { key: 'account', label: 'Рахунок', align: 'text-left' },
    { key: 'counterparty', label: 'Контрагент', align: 'text-left' },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* design-md: fintracker Журнал v1 */}
      {isLoading && !data && <p className="text-sm text-ink-2 text-center py-10">Завантаження...</p>}
      {error && !data && <p className="text-danger text-sm text-center py-10">Помилка завантаження звіту: {error}</p>}
      {data && (
        <>
          <SectionCard title="Оберіть проєкт">
            {isLoading ? <p className="text-xs text-ink-3">Завантаження проектів...</p> : projectsWithBonuses.length === 0 ? <p className="text-xs text-ink-3">Проектів не знайдено</p> : (
              <>
                <div className="hidden sm:flex gap-1.5 flex-wrap">
                  {projectsWithBonuses.map(project => {
                    const active = selectedProject === project.name;
                    const live = project.status === 'live';
                    const chipClass = active
                      ? 'bg-ink text-white border-ink'
                      : live
                        ? 'bg-income-soft text-income border border-income/30'
                        : 'bg-mute text-ink-2 border border-line';
                    // Без статусу в довіднику — виглядає як завершений, але без крапки
                    const dotClass = !project.status ? '' : active
                      ? (live ? 'bg-income' : 'border border-white/60')
                      : (live ? 'bg-income' : 'border border-ink-3');
                    return (
                      <button key={project.name} type="button" onClick={() => setSelectedProject(project.name)} className={`inline-flex items-center gap-2 h-[34px] px-3.5 rounded-full text-[13px] font-medium max-w-full ${chipClass}`}>
                        {project.status && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} />}
                        <span className="truncate">{project.name}</span>
                        <span className={`text-[11px] whitespace-nowrap ${active ? 'text-white/70' : 'text-ink-2'}`}>{bonusLabel(project)}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="sm:hidden">
                  <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} className="w-full rounded-full border border-line px-3.5 py-2.5 bg-panel text-[13px] font-medium">
                    {projectsWithBonuses.map(project => <option key={project.name} value={project.name}>{project.name} · {bonusLabel(project)}</option>)}
                  </select>
                  <div className="text-[11px] text-ink-2 mt-1">{projectStatusLabel(mobileProject)}</div>
                </div>
                <div className="hidden sm:flex gap-4 text-xs text-ink-2 mt-2">
                  <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-income" />активний</span>
                  <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full border border-ink-3" />завершений</span>
                  <span>· у чипі — відсоток бонусу</span>
                </div>
              </>
            )}
          </SectionCard>

          {selectedProject && (
            <SectionCard title={`Баланс проєкту: ${selectedProject}`} aside={<span className="text-xs text-ink-2">(+) — формула на ховері</span>}>
              {projectData.transactions.length > 0 ? (
                <div className="grid grid-cols-2 sm:flex gap-3">
                  <div className="sm:flex-1 min-w-0"><StatTile label="Надходження" value={`${formatMoney(projectData.totalIncome)} ₴`} tone="income" /></div>
                  <div className="sm:flex-1 min-w-0"><StatTile label="Витрати" value={`${formatMoney(-projectData.totalExpenses, false)} ₴`} tone="expense" /></div>
                  <div className="sm:flex-1 min-w-0"><StatTile label="Податки та комісії посередників 11%" value={`${formatNumber(projectData.taxes)} ₴`} calculation={calculations.taxes} /></div>
                  <div className="sm:flex-1 min-w-0"><StatTile label="Бонуси нараховані" value={`${formatNumber(projectData.totalBonuses)} ₴`} suffix={bonusPartsLabel && <div className="text-[11px] text-ink-2 font-normal mt-0.5">{bonusPartsLabel}</div>} calculation={calculations.totalBonuses} /></div>
                  <div className="sm:flex-1 min-w-0"><StatTile label="Бонуси виплачені" value={`${formatNumber(projectData.paidBonuses)} ₴`} calculation={calculations.paidBonuses} /></div>
                  <div className="sm:flex-1 min-w-0"><StatTile label="Баланс проєкту" value={<span className={projectData.balance < 0 ? 'text-tout' : ''}>{formatNumber(projectData.balance)} ₴</span>} tone="mute" calculation={calculations.balance} /></div>
                </div>
              ) : <p className="text-center text-ink-2 py-10">Немає транзакцій для цього проекту</p>}
            </SectionCard>
          )}

          {selectedProject && (
            <SectionCard title="Транзакції проєкту" aside={
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={handleCopy} disabled={selectedIds.size === 0} variant="primary">Скопіювати ({selectedIds.size})</Button>
                {copiedToast && <span className="text-income text-sm">{copiedToast}</span>}
                <Button onClick={handleExportXls} disabled={sortedTransactions.length === 0}>XLSX</Button>
              </div>
            }>
              <div className="sm:hidden">
                {sortedTransactions.length === 0 ? <div className="py-4 text-center text-ink-2">Транзакцій для цього проекту не знайдено</div> : sortedTransactions.map((tx, index) => {
                  const key = rowKey(tx);
                  return (
                    <div key={`${tx.id || ''}-${tx.date}-${index}-${tx.amount}`} className={`flex gap-2.5 py-2.5 border-b border-line ${selectedIds.has(key) ? 'bg-mute -mx-4 px-4' : ''}`}>
                      <div className="pt-0.5"><Checkbox checked={selectedIds.has(key)} onChange={() => toggleSelected(key)} label={`Виділити ${tx.id || ''}`} /></div>
                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="text-xs text-ink-2 tabular-nums truncate">{formatDateShort(tx.date)} · {tx.account}</span>
                          <span className={`text-[15px] font-semibold tabular-nums whitespace-nowrap ${amountClass(tx)}`}>{tx.type === 'Витрата' ? '−' : '+'} {formatNumber(tx.amount)}</span>
                        </div>
                        <div className="text-sm">{tx.description}</div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-xs text-ink-2 truncate">{tx.category}{tx.counterparty ? ` · ${tx.counterparty}` : ''}</span>
                          <TypeChip tx={tx} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full border-collapse text-[13.5px]">
                  <thead>
                    <tr>
                      <th className="px-2.5 py-2 text-left border-b border-line w-8"><Checkbox checked={allVisibleSelected} onChange={toggleAllVisible} label="Виділити всі" /></th>
                      {columns.map(col => (
                        <th key={col.key} className={`px-2.5 py-2 border-b border-line text-[11px] uppercase tracking-[.06em] font-medium cursor-pointer select-none whitespace-nowrap ${col.align} ${sortColumn === col.key ? 'text-ink' : 'text-ink-2'}`} onClick={() => handleSort(col.key)}>
                          {col.label}{sortColumn === col.key && <SortArrow direction={sortDirection} />}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTransactions.length === 0 ? (
                      <tr><td colSpan={9} className="py-4 text-center text-ink-2">Транзакцій для цього проекту не знайдено</td></tr>
                    ) : sortedTransactions.map((tx, index) => {
                      const key = rowKey(tx);
                      return (
                        <tr key={`${tx.id || ''}-${tx.date}-${index}-${tx.amount}`} className={selectedIds.has(key) ? 'bg-mute' : ''}>
                          <td className="px-2.5 py-2.5 border-b border-line align-top"><Checkbox checked={selectedIds.has(key)} onChange={() => toggleSelected(key)} label={`Виділити ${tx.id || ''}`} /></td>
                          <td className="px-2.5 py-2.5 border-b border-line align-top text-[11px] text-ink-3 tabular-nums whitespace-nowrap">{tx.id || 'без ID'}</td>
                          <td className="px-2.5 py-2.5 border-b border-line align-top tabular-nums whitespace-nowrap">{formatDateShort(tx.date)}</td>
                          <td className="px-2.5 py-2.5 border-b border-line align-top"><TypeChip tx={tx} /></td>
                          <td className={`px-2.5 py-2.5 border-b border-line align-top text-right whitespace-nowrap font-semibold tabular-nums ${amountClass(tx)}`}>{tx.type === 'Витрата' ? '−' : '+'} {formatNumber(tx.amount)} ₴</td>
                          <td className="px-2.5 py-2.5 border-b border-line align-top min-w-[220px]">{tx.description}</td>
                          <td className="px-2.5 py-2.5 border-b border-line align-top text-ink-2 whitespace-nowrap">{tx.category}</td>
                          <td className="px-2.5 py-2.5 border-b border-line align-top whitespace-nowrap">{tx.account}</td>
                          <td className="px-2.5 py-2.5 border-b border-line align-top text-ink-2 whitespace-nowrap">{tx.counterparty || '—'}</td>
                        </tr>
                      );
                    })}
                    {sortedTransactions.length > 0 && (
                      <>
                        <tr className="border-t-[1.5px] border-ink">
                          <td colSpan={4} className="px-2.5 py-2.5 font-semibold">Надходження</td>
                          <td className="px-2.5 py-2.5 text-right whitespace-nowrap font-semibold tabular-nums text-income">+ {formatNumber(projectData.totalIncome)} ₴</td>
                          <td colSpan={4}></td>
                        </tr>
                        <tr>
                          <td colSpan={4} className="px-2.5 py-1.5">Витрати</td>
                          <td className="px-2.5 py-1.5 text-right whitespace-nowrap font-semibold tabular-nums text-expense">− {formatNumber(projectData.totalExpenses)} ₴</td>
                          <td colSpan={4}></td>
                        </tr>
                        <tr>
                          <td colSpan={4} className="px-2.5 py-1.5"><TooltipWithCalculation calculation={calculations.taxes}><span>Податки та комісії посередників 11%</span></TooltipWithCalculation></td>
                          <td className="px-2.5 py-1.5 text-right whitespace-nowrap font-semibold tabular-nums">− {formatNumber(projectData.taxes)} ₴</td>
                          <td colSpan={4}></td>
                        </tr>
                        <tr>
                          <td colSpan={4} className="px-2.5 py-1.5"><TooltipWithCalculation calculation={calculations.bonusFromSum}><span>Бонус з суми ({projectData.bonusFromSumPercent}%)</span></TooltipWithCalculation></td>
                          <td className="px-2.5 py-1.5 text-right whitespace-nowrap font-semibold tabular-nums">− {formatNumber(projectData.bonusFromSum)} ₴</td>
                          <td colSpan={4}></td>
                        </tr>
                        <tr>
                          <td colSpan={4} className="px-2.5 py-1.5"><TooltipWithCalculation calculation={calculations.bonusFromBalance}><span>Бонус з балансу ({projectData.bonusFromBalancePercent}%)</span></TooltipWithCalculation></td>
                          <td className="px-2.5 py-1.5 text-right whitespace-nowrap font-semibold tabular-nums">− {formatNumber(projectData.bonusFromBalance)} ₴</td>
                          <td colSpan={4}></td>
                        </tr>
                        <tr>
                          <td colSpan={4} className="px-2.5 py-1.5"><TooltipWithCalculation calculation={calculations.paidBonuses}><span>Виплачено бонусів</span></TooltipWithCalculation></td>
                          <td className="px-2.5 py-1.5 text-right whitespace-nowrap font-semibold tabular-nums">− {formatNumber(projectData.paidBonuses)} ₴</td>
                          <td colSpan={4}></td>
                        </tr>
                        <tr className="border-t border-line font-semibold">
                          <td colSpan={4} className="px-2.5 py-2.5"><TooltipWithCalculation calculation={calculations.balance}><span>Баланс проєкту</span></TooltipWithCalculation></td>
                          <td className={`px-2.5 py-2.5 text-right whitespace-nowrap tabular-nums ${projectData.balance < 0 ? 'text-tout' : ''}`}>= {formatNumber(projectData.balance)} ₴</td>
                          <td colSpan={4}></td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
};

export default ProjectsPage;
