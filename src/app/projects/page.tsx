'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { parseDate, VALID_TYPES, signedAmount } from '@/lib/tx';
import { usePersistedFilters } from '@/hooks/usePersistedState';
import { useSheetData } from '@/hooks/useSheetData';
import { Button, SectionCard, SortArrow, StatTile, TooltipWithCalculation, TypeChip } from '@/components/ui';

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
  status: string;
}

interface ProjectsPersistedFilters {
  selectedProject: string;
  selectedProjects: string[];
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
    { selectedProject: '', selectedProjects: [], sortColumn: 'date', sortDirection: 'desc' }
  );

  const { selectedProject, selectedProjects, sortColumn, sortDirection } = filters;
  const setSelectedProject = useCallback((value: string) => updateFilters({ selectedProject: value, selectedProjects: value ? [value] : [] }), [updateFilters]);
  const setSelectedProjects = useCallback((value: string[] | ((prev: string[]) => string[])) => {
    updateFilters(prev => {
      const next = typeof value === 'function' ? value(prev.selectedProjects || []) : value;
      return { selectedProjects: next, selectedProject: next[0] || '' };
    });
  }, [updateFilters]);
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

      if (projectsData.length > 0) {
        const validSelected = (selectedProjects || []).filter(project => projectsData.some(p => p.name === project));
        const migratedProject = selectedProject && projectsData.some(p => p.name === selectedProject) ? selectedProject : '';
        if (validSelected.length === 0) setSelectedProjects([migratedProject || projectsData[0].name]);
        else if (validSelected.length !== selectedProjects.length) setSelectedProjects(validSelected);
      }
    } catch (err) {
      console.error('Failed to process sheet data:', err);
    }
  }, [data, selectedProject, selectedProjects, setSelectedProjects]);

  const handleSort = useCallback((column: string) => {
    if (sortColumn === column) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    else {
      setSortColumn(column);
      setSortDirection(column === 'date' ? 'desc' : 'asc');
    }
  }, [sortColumn, sortDirection, setSortColumn, setSortDirection]);

  const handleProjectToggle = useCallback((project: string) => {
    setSelectedProjects(prev => prev.includes(project) ? prev.filter(p => p !== project) : [...prev, project]);
  }, [setSelectedProjects]);

  const projectData = useMemo(() => {
    if (!selectedProjects.length) {
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

    const projectSet = new Set(selectedProjects);
    const projectTransactions = allTransactions.filter(tx => tx.project && projectSet.has(tx.project));
    const paidBonusesTransactions = projectTransactions.filter(tx => tx.type === 'Витрата' && tx.category === 'Бонуси і премії');
    const paidBonuses = paidBonusesTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const totalIncome = projectTransactions.filter(tx => tx.type === 'Надходження').reduce((sum, tx) => sum + tx.amount, 0);
    const totalExpenses = projectTransactions.filter(tx => tx.type === 'Витрата' && tx.category !== 'Бонуси і премії').reduce((sum, tx) => sum + tx.amount, 0);
    const taxes = totalIncome * 0.11;

    let bonusFromSum = 0;
    let bonusFromBalance = 0;
    let weightedSumPercent = 0;
    let weightedBalancePercent = 0;
    let baseForBalanceBonus = 0;

    selectedProjects.forEach(projectName => {
      const currentProject = projectsWithBonuses.find(p => p.name === projectName) || null;
      const txs = allTransactions.filter(tx => tx.project === projectName);
      const income = txs.filter(tx => tx.type === 'Надходження').reduce((sum, tx) => sum + tx.amount, 0);
      const expenses = txs.filter(tx => tx.type === 'Витрата' && tx.category !== 'Бонуси і премії').reduce((sum, tx) => sum + tx.amount, 0);
      const projectTaxes = income * 0.11;
      const sumPercent = currentProject?.bonusFromSum ?? 0;
      const balancePercent = currentProject?.bonusFromBalance ?? 0;
      const sumBonus = income * (sumPercent / 100);
      const balanceBase = income - expenses - projectTaxes - sumBonus;
      const balanceBonus = balanceBase > 0 ? balanceBase * (balancePercent / 100) : 0;
      bonusFromSum += sumBonus;
      bonusFromBalance += balanceBonus;
      baseForBalanceBonus += balanceBase;
      weightedSumPercent += sumPercent;
      weightedBalancePercent += balancePercent;
    });

    const totalBonuses = bonusFromSum + bonusFromBalance;
    const balance = totalIncome - totalExpenses - taxes - totalBonuses;
    const currentProject = selectedProjects.length === 1 ? projectsWithBonuses.find(p => p.name === selectedProjects[0]) || null : null;

    return {
      transactions: projectTransactions,
      totalIncome,
      totalExpenses,
      taxes,
      bonusFromSum,
      bonusFromSumPercent: selectedProjects.length ? weightedSumPercent / selectedProjects.length : 0,
      bonusFromBalance,
      bonusFromBalancePercent: selectedProjects.length ? weightedBalancePercent / selectedProjects.length : 0,
      baseForBalanceBonus,
      totalBonuses,
      paidBonuses,
      paidBonusesTransactions,
      balance,
      currentProject
    };
  }, [allTransactions, selectedProjects, projectsWithBonuses]);

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
    ];
    await writeXlsxFile(sortedTransactions, { columns, stickyRowsCount: 1 }).toFile(`projects-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, [sortedTransactions]);

  const title = selectedProjects.length === 1 ? selectedProjects[0] : `${selectedProjects.length} проєктів`;
  const mobileProject = projectsWithBonuses.find(p => p.name === selectedProjects[0]);
  const columns = [
    { key: 'id', label: 'ID', align: 'text-left' },
    { key: 'date', label: 'Дата', align: 'text-left' },
    { key: 'type', label: 'Тип', align: 'text-left' },
    { key: 'amount', label: 'Сума', align: 'text-right' },
    { key: 'description', label: 'Опис', align: 'text-left' },
    { key: 'category', label: 'Категорія', align: 'text-left' },
    { key: 'account', label: 'Рахунок', align: 'text-left' },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* design-md: fintracker Журнал v1 */}
      {isLoading && !data && <p className="text-sm text-ink-2 text-center py-10">Завантаження...</p>}
      {error && !data && <p className="text-danger text-sm text-center py-10">Помилка завантаження звіту: {error}</p>}
      {data && (
        <>
          <SectionCard title="Оберіть проєкт" aside={<span className="hidden sm:inline text-xs text-ink-2">можна кілька</span>}>
            {isLoading ? <p className="text-xs text-ink-3">Завантаження проектів...</p> : projectsWithBonuses.length === 0 ? <p className="text-xs text-ink-3">Проектів не знайдено</p> : (
              <>
                <div className="hidden sm:flex gap-1.5 flex-wrap">
                  {projectsWithBonuses.map(project => {
                    const active = selectedProjects.includes(project.name);
                    const live = project.status === 'live';
                    return (
                      <button key={project.name} type="button" onClick={() => handleProjectToggle(project.name)} className={`inline-flex items-center gap-2 h-[34px] px-3.5 rounded-full text-[13px] font-medium border max-w-full ${active ? 'bg-ink text-white border-ink' : 'bg-panel text-ink border-line hover:border-ink-3'}`}>
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${live ? 'bg-income border border-income' : 'border border-ink-2'}`} />
                        <span className="truncate">{project.name}</span>
                        <span className={`text-[11px] whitespace-nowrap ${active ? 'text-white/70' : 'text-ink-2'}`}>{bonusLabel(project)}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="sm:hidden">
                  <select value={selectedProjects[0] || ''} onChange={(e) => setSelectedProject(e.target.value)} className="w-full rounded-full border border-line px-3.5 py-2.5 bg-panel text-[13px] font-medium">
                    {projectsWithBonuses.map(project => <option key={project.name} value={project.name}>{project.name} · {bonusLabel(project)}</option>)}
                  </select>
                  <div className="text-[11px] text-ink-2 mt-1">{selectedProjects.length} з {projectsWithBonuses.length} проєктів · {projectStatusLabel(mobileProject)}</div>
                </div>
                <div className="hidden sm:flex gap-4 text-xs text-ink-2 mt-2">
                  <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-income" />активний</span>
                  <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full border border-ink-2" />завершений</span>
                  <span>· у чипі — відсоток бонусу</span>
                </div>
              </>
            )}
          </SectionCard>

          {selectedProjects.length > 0 && (
            <SectionCard title={`Баланс проєкту: ${title}`} aside={<span className="text-xs text-ink-2">(+) — формула на ховері</span>}>
              {projectData.transactions.length > 0 ? (
                <div className="grid grid-cols-2 sm:flex gap-3">
                  <div className="sm:flex-1 min-w-0"><StatTile label="Надходження" value={`${formatMoney(projectData.totalIncome)} ₴`} tone="income" /></div>
                  <div className="sm:flex-1 min-w-0"><StatTile label="Витрати" value={`${formatMoney(-projectData.totalExpenses, false)} ₴`} tone="expense" /></div>
                  <div className="sm:flex-1 min-w-0"><StatTile label="Податки та комісії посередників 11%" value={`${formatNumber(projectData.taxes)} ₴`} calculation={calculations.taxes} /></div>
                  <div className="sm:flex-1 min-w-0"><StatTile label="Бонуси нараховані" value={`${formatNumber(projectData.totalBonuses)} ₴`} suffix={<div className="text-[11px] text-ink-2 font-normal mt-0.5">з суми {formatNumber(projectData.bonusFromSum)} · з балансу {formatNumber(projectData.bonusFromBalance)}</div>} calculation={calculations.totalBonuses} /></div>
                  <div className="sm:flex-1 min-w-0"><StatTile label="Бонуси виплачені" value={`${formatNumber(projectData.paidBonuses)} ₴`} calculation={calculations.paidBonuses} /></div>
                  <div className="sm:flex-1 min-w-0"><StatTile label="Баланс проєкту" value={`${formatNumber(projectData.balance)} ₴`} tone="mute" calculation={calculations.balance} /></div>
                </div>
              ) : <p className="text-center text-ink-2 py-10">Немає транзакцій для цього проекту</p>}
            </SectionCard>
          )}

          {selectedProjects.length > 0 && (
            <SectionCard title="Транзакції проєкту" aside={<Button onClick={handleExportXls} disabled={sortedTransactions.length === 0}>XLSX</Button>}>
              <div className="sm:hidden">
                {sortedTransactions.length === 0 ? <div className="py-4 text-center text-ink-2">Транзакцій для цього проекту не знайдено</div> : sortedTransactions.map((tx, index) => (
                  <div key={`${tx.id || ''}-${tx.date}-${index}-${tx.amount}`} className="flex flex-col gap-1 py-2.5 border-b border-line">
                    <div className="flex justify-between items-baseline gap-2">
                      <span className="text-xs text-ink-2 tabular-nums truncate">{formatDateShort(tx.date)} · {tx.account}</span>
                      <span className={`text-[15px] font-semibold tabular-nums whitespace-nowrap ${amountClass(tx)}`}>{tx.type === 'Витрата' ? '−' : '+'} {formatNumber(tx.amount)}</span>
                    </div>
                    <div className="text-sm">{tx.description}</div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-xs text-ink-2 truncate">{tx.category}</span>
                      <TypeChip tx={tx} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full border-collapse text-[13.5px]">
                  <thead>
                    <tr>
                      {columns.map(col => (
                        <th key={col.key} className={`px-2.5 py-2 border-b border-line text-[11px] uppercase tracking-[.06em] font-medium cursor-pointer select-none whitespace-nowrap ${col.align} ${sortColumn === col.key ? 'text-ink' : 'text-ink-2'}`} onClick={() => handleSort(col.key)}>
                          {col.label}{sortColumn === col.key && <SortArrow direction={sortDirection} />}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTransactions.length === 0 ? (
                      <tr><td colSpan={7} className="py-4 text-center text-ink-2">Транзакцій для цього проекту не знайдено</td></tr>
                    ) : sortedTransactions.map((tx, index) => (
                      <tr key={`${tx.id || ''}-${tx.date}-${index}-${tx.amount}`}>
                        <td className="px-2.5 py-2.5 border-b border-line align-top text-xs text-ink-2 tabular-nums whitespace-nowrap">{tx.id || 'без ID'}</td>
                        <td className="px-2.5 py-2.5 border-b border-line align-top tabular-nums whitespace-nowrap">{formatDateShort(tx.date)}</td>
                        <td className="px-2.5 py-2.5 border-b border-line align-top"><TypeChip tx={tx} /></td>
                        <td className={`px-2.5 py-2.5 border-b border-line align-top text-right whitespace-nowrap font-semibold tabular-nums ${amountClass(tx)}`}>{tx.type === 'Витрата' ? '−' : '+'} {formatNumber(tx.amount)} ₴</td>
                        <td className="px-2.5 py-2.5 border-b border-line align-top min-w-[220px]">{tx.description}</td>
                        <td className="px-2.5 py-2.5 border-b border-line align-top text-ink-2 whitespace-nowrap">{tx.category}</td>
                        <td className="px-2.5 py-2.5 border-b border-line align-top whitespace-nowrap">{tx.account}</td>
                      </tr>
                    ))}
                    {sortedTransactions.length > 0 && (
                      <>
                        <tr className="border-t-[1.5px] border-ink">
                          <td colSpan={3} className="px-2.5 py-2.5 font-semibold">Надходження</td>
                          <td className="px-2.5 py-2.5 text-right whitespace-nowrap font-semibold tabular-nums text-income">+ {formatNumber(projectData.totalIncome)} ₴</td>
                          <td colSpan={3}></td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="px-2.5 py-1.5 font-medium">Витрати</td>
                          <td className="px-2.5 py-1.5 text-right whitespace-nowrap font-semibold tabular-nums text-expense">− {formatNumber(projectData.totalExpenses)} ₴</td>
                          <td colSpan={3}></td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="px-2.5 py-1.5 font-medium"><TooltipWithCalculation calculation={calculations.taxes}><span>Податки та комісії 11%</span></TooltipWithCalculation></td>
                          <td className="px-2.5 py-1.5 text-right whitespace-nowrap font-semibold tabular-nums">− {formatNumber(projectData.taxes)} ₴</td>
                          <td colSpan={3}></td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="px-2.5 py-1.5 font-medium"><TooltipWithCalculation calculation={calculations.totalBonuses}><span>Бонуси нараховані</span></TooltipWithCalculation></td>
                          <td className="px-2.5 py-1.5 text-right whitespace-nowrap font-semibold tabular-nums">− {formatNumber(projectData.totalBonuses)} ₴</td>
                          <td colSpan={3}></td>
                        </tr>
                        <tr className="border-t border-line font-semibold">
                          <td colSpan={3} className="px-2.5 py-2.5"><TooltipWithCalculation calculation={calculations.balance}><span>Баланс проєкту</span></TooltipWithCalculation></td>
                          <td className="px-2.5 py-2.5 text-right whitespace-nowrap tabular-nums">= {formatNumber(projectData.balance)} ₴</td>
                          <td colSpan={3}></td>
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
