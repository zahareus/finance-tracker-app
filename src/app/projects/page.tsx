'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell
} from 'recharts';

// --- Типи даних ---
interface Transaction {
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
}

// --- Хелпери ---
const formatNumber = (num: number): string => {
    if (typeof num !== 'number' || isNaN(num)) { return '0,00'; }
    return num.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseDate = (dateString: string | null): Date | null => {
    if (!dateString || typeof dateString !== 'string') return null;
    try {
        let parts = dateString.split('-');
        if (parts.length === 3 && parts[0].length === 4) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const day = parseInt(parts[2], 10);
            if (!isNaN(year) && !isNaN(month) && !isNaN(day) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
               const date = new Date(Date.UTC(year, month - 1, day));
               if (!isNaN(date.getTime())) return date;
            }
        }
        parts = dateString.split('.');
        if (parts.length === 3 && parts[2].length === 4) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);
             if (!isNaN(year) && !isNaN(month) && !isNaN(day) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                 const date = new Date(Date.UTC(year, month - 1, day));
                 if (!isNaN(date.getTime())) return date;
             }
        }
    } catch (e) {
        console.error("Error parsing date string:", dateString, e);
    }
    return null;
};

const ProjectsPage: React.FC = () => {
    // --- Стан ---
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
    const [projectsWithBonuses, setProjectsWithBonuses] = useState<ProjectWithBonuses[]>([]);
    const [selectedProject, setSelectedProject] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Стан для сортування таблиці
    const [sortColumn, setSortColumn] = useState<string>('date');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // --- Завантаження даних ---
    useEffect(() => {
        const fetchData = async () => {
           setIsLoading(true); setError(null);
           try {
             const response = await fetch('/api/sheet-data');
             if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
             const data = await response.json();

             const cleanedTransactions = data.transactions.map((tx: any) => ({
               date: typeof tx.date === 'string' ? tx.date.trim() : null,
               amount: typeof tx.amount === 'number' && !isNaN(tx.amount) ? tx.amount : parseFloat(String(tx.amount || '0').replace(/,/g, '.').replace(/\s/g, '')) || 0,
               type: String(tx?.type || '').trim(),
               account: String(tx?.account || '').trim(),
               category: String(tx?.category || '').trim(),
               description: String(tx?.description || '').trim(),
               counterparty: tx?.counterparty ? String(tx.counterparty).trim() : '',
               project: tx?.project ? String(tx.project).trim() : '',
             })).filter((tx: Transaction) => {
               return tx.date && (tx.type === 'Надходження' || tx.type === 'Витрата') && tx.account && tx.category && typeof tx.amount === 'number' && !isNaN(tx.amount);
             });

             setAllTransactions(cleanedTransactions);

             // Обробка проектів з бонусами
             const projectsData: ProjectWithBonuses[] = Array.isArray(data.projectsWithBonuses)
               ? data.projectsWithBonuses.map((p: any) => ({
                   name: String(p.name || '').trim(),
                   bonusFromSum: typeof p.bonusFromSum === 'number' && !isNaN(p.bonusFromSum) ? p.bonusFromSum : null,
                   bonusFromBalance: typeof p.bonusFromBalance === 'number' && !isNaN(p.bonusFromBalance) ? p.bonusFromBalance : null,
                 })).filter((p: ProjectWithBonuses) => p.name)
               : [];

             setProjectsWithBonuses(projectsData);

             // Встановлюємо перший проект за замовчуванням
             if (projectsData.length > 0 && !selectedProject) {
               setSelectedProject(projectsData[0].name);
             }
           } catch (err) {
             setError(err instanceof Error ? err.message : 'An unknown error occurred.');
             console.error("Failed to fetch data:", err);
           }
           finally { setIsLoading(false); }
        };
        fetchData();
     }, []);

    // Обробник сортування таблиці
    const handleSort = useCallback((column: string) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection(column === 'date' ? 'desc' : 'asc');
        }
    }, [sortColumn]);

    // --- Обчислення даних для обраного проекту ---
    const projectData = useMemo(() => {
        if (!selectedProject) {
            return {
                transactions: [],
                totalIncome: 0,
                totalExpenses: 0,
                taxes: 0,
                bonusFromSum: 0,
                bonusFromBalance: 0,
                totalBonuses: 0,
                balance: 0,
                chartData: [],
                currentProject: null as ProjectWithBonuses | null
            };
        }

        // Знаходимо обраний проект
        const currentProject = projectsWithBonuses.find(p => p.name === selectedProject) || null;

        // Фільтруємо транзакції по проекту
        const projectTransactions = allTransactions.filter(tx => tx.project === selectedProject);

        // Обчислюємо суми
        const totalIncome = projectTransactions
            .filter(tx => tx.type === 'Надходження')
            .reduce((sum, tx) => sum + tx.amount, 0);

        const totalExpenses = projectTransactions
            .filter(tx => tx.type === 'Витрата')
            .reduce((sum, tx) => sum + tx.amount, 0);

        // Податки 11% від надходжень
        const taxes = totalIncome * 0.11;

        // Бонус з суми (відсоток від надходжень)
        const bonusFromSumPercent = currentProject?.bonusFromSum ?? 0;
        const bonusFromSum = totalIncome * (bonusFromSumPercent / 100);

        // Бонус з балансу (відсоток від (надходження - податки - бонус з суми))
        const bonusFromBalancePercent = currentProject?.bonusFromBalance ?? 0;
        const baseForBalanceBonus = totalIncome - taxes - bonusFromSum;
        const bonusFromBalance = baseForBalanceBonus > 0 ? baseForBalanceBonus * (bonusFromBalancePercent / 100) : 0;

        // Загальні бонуси
        const totalBonuses = bonusFromSum + bonusFromBalance;

        // Баланс = Надходження - Видатки - Податки - Бонуси
        const balance = totalIncome - totalExpenses - taxes - totalBonuses;

        // Дані для графіка (два стовпці)
        const chartData = [
            {
                name: 'Надходження',
                value: totalIncome,
                fill: '#00C49F'
            },
            {
                name: 'Видатки',
                value: totalExpenses + taxes + totalBonuses,
                fill: '#FF8042'
            }
        ];

        return {
            transactions: projectTransactions,
            totalIncome,
            totalExpenses,
            taxes,
            bonusFromSum,
            bonusFromBalance,
            totalBonuses,
            balance,
            chartData,
            currentProject
        };
    }, [allTransactions, selectedProject, projectsWithBonuses]);

    // --- РЕНДЕР КОМПОНЕНТА ---
    return (
        <div>
          {/* --- Вибір проекту --- */}
          <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3 text-center">Оберіть проект</h2>
              {isLoading ? (
                  <p className="text-center text-gray-500">Завантаження проектів...</p>
              ) : error ? (
                  <p className="text-center text-red-600">Помилка: {error}</p>
              ) : projectsWithBonuses.length === 0 ? (
                  <p className="text-center text-gray-500">Проектів не знайдено</p>
              ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                      {projectsWithBonuses.map((project) => (
                          <button
                              key={project.name}
                              onClick={() => setSelectedProject(project.name)}
                              className={`p-3 sm:p-4 rounded-lg border-2 text-center transition-all duration-200 ${
                                  selectedProject === project.name
                                      ? 'border-[#8884D8] bg-[#8884D8] text-white shadow-lg'
                                      : 'border-gray-200 bg-white hover:border-[#8884D8] hover:shadow-md'
                              }`}
                          >
                              <span className="text-xs sm:text-sm font-medium block truncate">
                                  {project.name}
                              </span>
                              {(project.bonusFromSum !== null || project.bonusFromBalance !== null) && (
                                  <span className={`text-xs mt-1 block ${selectedProject === project.name ? 'text-white/80' : 'text-gray-400'}`}>
                                      {project.bonusFromSum !== null && `${project.bonusFromSum}%`}
                                      {project.bonusFromSum !== null && project.bonusFromBalance !== null && ' / '}
                                      {project.bonusFromBalance !== null && `${project.bonusFromBalance}%`}
                                  </span>
                              )}
                          </button>
                      ))}
                  </div>
              )}
          </div>

          {/* --- Графік балансу проекту --- */}
          {!isLoading && !error && selectedProject && (
              <div className="p-4 border rounded shadow bg-white mb-6">
                  <h2 className="text-lg font-semibold mb-4 text-center">
                      Баланс проекту: {selectedProject}
                  </h2>

                  {projectData.transactions.length > 0 ? (
                      <>
                          <ResponsiveContainer width="100%" height={300}>
                              <BarChart
                                  data={projectData.chartData}
                                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                  layout="vertical"
                              >
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis
                                      type="number"
                                      tickFormatter={(value) => formatNumber(value)}
                                      fontSize={12}
                                  />
                                  <YAxis
                                      type="category"
                                      dataKey="name"
                                      fontSize={12}
                                      width={100}
                                  />
                                  <Tooltip
                                      formatter={(value: number) => [`${formatNumber(value)} ₴`, '']}
                                      labelStyle={{ fontWeight: 'bold' }}
                                  />
                                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                      {projectData.chartData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={entry.fill} />
                                      ))}
                                  </Bar>
                              </BarChart>
                          </ResponsiveContainer>

                          {/* --- Деталі балансу --- */}
                          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                              <div className="text-center p-3 bg-green-50 rounded-lg">
                                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Надходження</p>
                                  <p className="text-lg sm:text-xl font-bold text-[#00C49F]">
                                      {formatNumber(projectData.totalIncome)} ₴
                                  </p>
                              </div>
                              <div className="text-center p-3 bg-red-50 rounded-lg">
                                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Видатки</p>
                                  <p className="text-lg sm:text-xl font-bold text-[#FF8042]">
                                      {formatNumber(projectData.totalExpenses)} ₴
                                  </p>
                              </div>
                              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Податки (11%)</p>
                                  <p className="text-lg sm:text-xl font-bold text-yellow-600">
                                      {formatNumber(projectData.taxes)} ₴
                                  </p>
                              </div>
                              <div className="text-center p-3 bg-orange-50 rounded-lg">
                                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Бонуси</p>
                                  <p className="text-lg sm:text-xl font-bold text-orange-500">
                                      {formatNumber(projectData.totalBonuses)} ₴
                                  </p>
                                  {(projectData.bonusFromSum > 0 || projectData.bonusFromBalance > 0) && (
                                      <p className="text-xs text-gray-400 mt-1">
                                          {projectData.bonusFromSum > 0 && `з суми: ${formatNumber(projectData.bonusFromSum)}`}
                                          {projectData.bonusFromSum > 0 && projectData.bonusFromBalance > 0 && ' | '}
                                          {projectData.bonusFromBalance > 0 && `з балансу: ${formatNumber(projectData.bonusFromBalance)}`}
                                      </p>
                                  )}
                              </div>
                              <div className="text-center p-3 bg-purple-50 rounded-lg col-span-2 sm:col-span-1">
                                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Баланс</p>
                                  <p className={`text-lg sm:text-xl font-bold ${projectData.balance >= 0 ? 'text-[#8884D8]' : 'text-red-600'}`}>
                                      {formatNumber(projectData.balance)} ₴
                                  </p>
                              </div>
                          </div>
                      </>
                  ) : (
                      <p className="text-center text-gray-500 py-10">
                          Немає транзакцій для цього проекту
                      </p>
                  )}
              </div>
          )}

          {/* --- Таблиця транзакцій проекту --- */}
          {!isLoading && !error && selectedProject && (
              <div className="overflow-x-auto">
                  <h2 className="text-lg font-semibold mb-2 text-center">
                      Транзакції проекту
                  </h2>
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                          <tr>
                              <th
                                  scope="col"
                                  className={`px-4 py-2 text-left text-xs uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none ${sortColumn === 'date' ? 'font-bold text-gray-900' : 'font-medium text-gray-500'}`}
                                  onClick={() => handleSort('date')}
                              >
                                  Дата {sortColumn === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                              </th>
                              <th
                                  scope="col"
                                  className={`px-4 py-2 text-right text-xs uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none ${sortColumn === 'amount' ? 'font-bold text-gray-900' : 'font-medium text-gray-500'}`}
                                  onClick={() => handleSort('amount')}
                              >
                                  Сума {sortColumn === 'amount' && (sortDirection === 'asc' ? '↑' : '↓')}
                              </th>
                              <th
                                  scope="col"
                                  className={`px-4 py-2 text-left text-xs uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none ${sortColumn === 'description' ? 'font-bold text-gray-900' : 'font-medium text-gray-500'}`}
                                  onClick={() => handleSort('description')}
                              >
                                  Опис {sortColumn === 'description' && (sortDirection === 'asc' ? '↑' : '↓')}
                              </th>
                              <th
                                  scope="col"
                                  className={`px-4 py-2 text-left text-xs uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none ${sortColumn === 'category' ? 'font-bold text-gray-900' : 'font-medium text-gray-500'}`}
                                  onClick={() => handleSort('category')}
                              >
                                  Категорія {sortColumn === 'category' && (sortDirection === 'asc' ? '↑' : '↓')}
                              </th>
                              <th
                                  scope="col"
                                  className={`px-4 py-2 text-left text-xs uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none ${sortColumn === 'account' ? 'font-bold text-gray-900' : 'font-medium text-gray-500'}`}
                                  onClick={() => handleSort('account')}
                              >
                                  Рахунок {sortColumn === 'account' && (sortDirection === 'asc' ? '↑' : '↓')}
                              </th>
                              <th
                                  scope="col"
                                  className={`px-4 py-2 text-left text-xs uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none ${sortColumn === 'counterparty' ? 'font-bold text-gray-900' : 'font-medium text-gray-500'}`}
                                  onClick={() => handleSort('counterparty')}
                              >
                                  Контрагент {sortColumn === 'counterparty' && (sortDirection === 'asc' ? '↑' : '↓')}
                              </th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                          {projectData.transactions.length === 0 ? (
                              <tr>
                                  <td colSpan={6} className="px-4 py-4 text-center text-gray-500">
                                      Транзакцій для цього проекту не знайдено
                                  </td>
                              </tr>
                          ) : (
                              <>
                                  {/* Транзакції */}
                                  {[...projectData.transactions]
                                      .sort((a, b) => {
                                          let comparison = 0;
                                          switch (sortColumn) {
                                              case 'date':
                                                  const dateA = parseDate(a.date);
                                                  const dateB = parseDate(b.date);
                                                  if (!dateA && !dateB) comparison = 0;
                                                  else if (!dateA) comparison = 1;
                                                  else if (!dateB) comparison = -1;
                                                  else comparison = dateA.getTime() - dateB.getTime();
                                                  break;
                                              case 'amount':
                                                  const amountA = a.type === 'Витрата' ? -a.amount : a.amount;
                                                  const amountB = b.type === 'Витрата' ? -b.amount : b.amount;
                                                  comparison = amountA - amountB;
                                                  break;
                                              case 'description':
                                                  comparison = (a.description || '').localeCompare(b.description || '', 'uk');
                                                  break;
                                              case 'category':
                                                  comparison = (a.category || '').localeCompare(b.category || '', 'uk');
                                                  break;
                                              case 'account':
                                                  comparison = (a.account || '').localeCompare(b.account || '', 'uk');
                                                  break;
                                              case 'counterparty':
                                                  comparison = (a.counterparty || '').localeCompare(b.counterparty || '', 'uk');
                                                  break;
                                              default:
                                                  comparison = 0;
                                          }
                                          return sortDirection === 'asc' ? comparison : -comparison;
                                      })
                                      .map((tx, index) => (
                                          <tr
                                              key={`${tx.date}-${index}-${tx.amount}`}
                                              className={`${tx.type === 'Витрата' ? 'bg-red-50 hover:bg-red-100' : 'bg-green-50 hover:bg-green-100'} transition-colors duration-150 ease-in-out`}
                                          >
                                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{tx.date}</td>
                                              <td className={`px-4 py-2 whitespace-nowrap text-sm text-right font-medium ${tx.type === 'Витрата' ? 'text-[#FF8042]' : 'text-[#00C49F]'}`}>
                                                  {tx.type === 'Витрата' ? '-' : '+'} {formatNumber(tx.amount)} ₴
                                              </td>
                                              <td className="px-4 py-2 text-sm text-gray-500 max-w-[200px] truncate">{tx.description}</td>
                                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{tx.category}</td>
                                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{tx.account}</td>
                                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{tx.counterparty || '-'}</td>
                                          </tr>
                                      ))
                                  }

                                  {/* Розрахункові рядки */}
                                  {projectData.transactions.length > 0 && (
                                      <>
                                          {/* Податки */}
                                          <tr className="bg-yellow-100 border-t-2 border-yellow-300">
                                              <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-yellow-800">
                                                  Розрахунково
                                              </td>
                                              <td className="px-4 py-2 whitespace-nowrap text-sm text-right font-medium text-yellow-800">
                                                  - {formatNumber(projectData.taxes)} ₴
                                              </td>
                                              <td colSpan={4} className="px-4 py-2 text-sm text-yellow-800">
                                                  Податки (11% від надходжень)
                                              </td>
                                          </tr>

                                          {/* Бонус з суми */}
                                          {projectData.currentProject && projectData.currentProject.bonusFromSum !== null && projectData.bonusFromSum > 0 && (
                                              <tr className="bg-orange-100">
                                                  <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-orange-800">
                                                      Розрахунково
                                                  </td>
                                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-right font-medium text-orange-800">
                                                      - {formatNumber(projectData.bonusFromSum)} ₴
                                                  </td>
                                                  <td colSpan={4} className="px-4 py-2 text-sm text-orange-800">
                                                      Бонус з суми ({projectData.currentProject.bonusFromSum}% від надходжень)
                                                  </td>
                                              </tr>
                                          )}

                                          {/* Бонус з балансу */}
                                          {projectData.currentProject && projectData.currentProject.bonusFromBalance !== null && projectData.bonusFromBalance > 0 && (
                                              <tr className="bg-orange-100">
                                                  <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-orange-800">
                                                      Розрахунково
                                                  </td>
                                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-right font-medium text-orange-800">
                                                      - {formatNumber(projectData.bonusFromBalance)} ₴
                                                  </td>
                                                  <td colSpan={4} className="px-4 py-2 text-sm text-orange-800">
                                                      Бонус з балансу ({projectData.currentProject.bonusFromBalance}% від надходжень за мінусом податків та бонусу з суми)
                                                  </td>
                                              </tr>
                                          )}
                                      </>
                                  )}
                              </>
                          )}
                      </tbody>
                  </table>
              </div>
          )}
        </div>
    );
};

export default ProjectsPage;
