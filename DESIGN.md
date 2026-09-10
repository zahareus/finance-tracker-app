---
meta:
  project: fintracker            # fin.mmedia.com.ua · Next.js 14 + Tailwind 3.4 + Recharts
  follows: design-md/v1
  name: "Журнал"                 # обрано Віктором 10.09.2026 з трьох напрямків (Гросбух / Пульт / Журнал)
  status: v1-2026-09-10
colors:
  primitive:
    paper:        "#FAFAF6"
    panel:        "#FFFFFF"
    ink-900:      "#1B1B1F"
    ink-500:      "#66666E"
    ink-300:      "#9A9AA2"
    line:         "#E6E6E0"
    mute:         "#F3F3EE"
    green-600:    "#1E8E5A"
    green-50:     "#E3F4EA"
    blue-600:     "#2B6CB0"
    blue-50:      "#E3ECF7"
    amber-600:    "#B7791F"
    amber-50:     "#FBF1DC"
    red-600:      "#C53030"
    red-50:       "#F9E3E3"
    red-700:      "#B91C1C"
  semantic:                      # tailwind.config.ts extend.colors — компоненти вживають ТІЛЬКИ це
    canvas:         paper
    surface:        panel
    text:           ink-900
    text-secondary: ink-500
    text-muted:     ink-300
    border:         line
    selected:       mute          # виділений рядок, idle-чип року
    action:         ink-900       # активні контроли — чорні (нема окремого бренд-кольору)
    income:         green-600 / green-50     # Надходження
    tin:            blue-600  / blue-50      # Переказ ВХІД
    expense:        amber-600 / amber-50     # Витрата
    tout:           red-600   / red-50       # ВИХІД Переказ
    danger:         red-700                  # помилки застосунку
typography:
  family: { display: "Unbounded (500, 700)", sans: "Golos Text (400, 500, 600)" }   # next/font/google, змінні --font-unbounded / --font-golos
  scale:  { xs: 11–12px, sm: 13px, base: 14px, md: 15px, lg: 20px, kpi: 30px, kpi-mobile: 22px }
radius:  { pill: "9999px", card: "14px", field: "10px", check: "5px" }
spacing: { page-x: "48px (mobile 16px)", section-gap: "16px", card-pad: "18px 20px", cell: "10px" }
shadow:  none                    # глибина лише бордером і фоном
motion:  { duration: "150ms", easing: "ease-in-out", reduced: "motion-safe:" }
---

# DESIGN.md — Фінтрекер «Місцеві гроші», стиль «Журнал»

Джерело істини для UI. Макети-еталони: `~/Claude Code/mmedia/fintracker/design-audit-2026-09-10/directions/{Main,MainFilters,MainMobile,Earn*,Projects*,Fop*}.dc.html` (канва: https://claude.ai/code/artifact/82f4c868-10ee-4bff-a7cf-b477122bb056). Код НЕ є джерелом стилю — він містить легасі-дрейф (Recharts-палітра `#8884D8`, blue/indigo/purple-класи).

## 0. Atmosphere
Внутрішній фінансовий журнал для 3–5 людей редакції. Світлий теплувато-сірий папір, білі картки з тонким бордером і радіусом 14px, **без тіней**. Один акцент — чорний (активна вкладка, активний сегмент, активний чип, primary-кнопка). Колір несе лише одну інформацію: **тип транзакції**. Заголовки й великі числа — Unbounded, усе інше — Golos Text. Іконки — inline SVG (стрілка ▾ у чипах, галочка чекбокса), без emoji й дінгбатів у контролах.

## 1. Color — value → intent → boundary
- **action `#1B1B1F`** — активний стан контролів, primary-кнопка, підкреслені текст-дії. *Boundary:* не для сум, не для графіків.
- **income `#1E8E5A` / soft `#E3F4EA`** — Надходження: колір суми (+), чип типу, бар/лінія графіка, плитка «Надходження». *Boundary:* лише як текст ≥13px medium або заливка; не для «успіх» повідомлень поза грошима.
- **tin `#2B6CB0` / soft** — Переказ ВХІД: сума (+), чип, `↩ Txxxx` звʼязок в ID.
- **expense `#B7791F` / soft** — Витрата: сума (−), чип, бар графіка, плитка «Витрати», банер попереджень (⚠ непарні / пропущені).
- **tout `#C53030` / soft** — ВИХІД Переказ: сума (−), чип, недоплата на /fop. *Boundary:* не для помилок застосунку — для них `danger`.
- **text / text-secondary / text-muted** — 3 сходинки тексту. **border** — усі бордери й дільники. **selected** — виділений чекбоксом рядок, idle-чип року.
- Правило «зелено-синє = плюс, жовто-червоне = мінус» дотримуватись всюди, включно з графіками.
- Заборонено: `[#…]` arbitrary hex у компонентах, `blue-*/indigo-*/purple-*/sky-*/orange-*/gray-*` Tailwind-класи — тільки токени вище (`text-ink-2`, `bg-income-soft`, `border-line`…). Recharts бере кольори з `src/lib/theme.ts` (одна константа).

## 2. Typography
- **h1 сторінки** (лише /fop): `font-display text-lg font-semibold`. **Заголовок секції** `font-display text-[15px] font-semibold`. **Логотип-текст** `font-display font-bold`.
- **KPI** (Кошти/Ранвей): `font-display text-[30px] font-bold` (mobile 22px), лейбл над ним `text-[11px] uppercase tracking-[.08em] text-ink-2`. KPI завжди `whitespace-nowrap`.
- **Суми в таблицях/плитках**: `font-sans font-semibold tabular-nums` кольором типу; формат `formatNumber` uk-UA, знак `+ `/`− ` з пробілом (мінус — U+2212).
- **Шапка таблиці**: `text-[11px] uppercase tracking-[.06em] text-ink-2 font-medium`; активна сортована колонка `text-ink` + SVG-стрілка.
- **ID**: `text-xs text-ink-2 tabular-nums`. **Вторинний текст у рядку** (категорія, контрагент, проєкт): `text-ink-2`.
- Ваги: bold — KPI і логотип; semibold — заголовки, суми, підсумки; medium — лейбли, дії, чипи; regular — решта.

## 3. Components (default / hover / focus / active / disabled / loading / empty / error)
**Nav pill** `px-4 py-2 rounded-full text-[13px] font-medium` · default text-ink-2 · hover text-ink · active bg-ink text-white · focus — без кільця (рішення Віктора) · disabled — не буває.
**Button primary** («Скопіювати (N)») `inline-flex items-center px-3.5 py-[7px] rounded-full bg-ink text-white text-[13px] font-medium` · hover opacity-90 · active opacity-80 · disabled opacity-40 cursor-not-allowed · loading — текст «…» без зміни ширини · success — inline `text-income text-sm` «Скопійовано» 2 с поруч.
**Button secondary** («XLSX», «Вибрати всі» не сюди) `… border border-ink text-ink bg-panel` · hover bg-mute · disabled opacity-40 · loading «XLSX…».
**Text action** («Оновити», «Джерело», «Скинути», «Вибрати всі / Зняти всі») `text-[13px] text-ink-2 underline underline-offset-[3px]` · hover text-ink · disabled text-ink-3 no-underline · loading («Оновлюю…») text-ink-3. Один рендер на весь застосунок; xs-варіант (12px) лише у шапках списків фільтрів.
**Chip-summary** (згорнутий Період / Фільтри) `inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-line bg-panel text-[13px]`: лейбл text-ink-2 + значення font-medium tabular-nums + SVG ▾ · hover border-ink-3 · клік розгортає панель.
**Segmented** (Всі / Надходження / Витрати / Перекази) контейнер `inline-flex p-[3px] rounded-full border border-line bg-panel`; сегмент `px-4 py-[7px] rounded-full text-[13px] font-medium text-ink-2` · active bg-ink text-white (усі чотири — чорні, семантика типу в чипах таблиці, не тут).
**Month chip** `h-[30px] px-3 rounded-full text-xs font-medium border` · default border-line text-ink-2 bg-transparent · hover border-ink-3 · active bg-ink text-white border-ink · selecting (перший клік діапазону) `ring-2 ring-ink ring-offset-1` · disabled (майбутній місяць) text-ink-3 no-hover. Рік — той самий чип із `bg-mute text-ink font-semibold`, клік = увесь рік. Сітка `flex flex-wrap gap-1.5` (не aspect-square, не grid-12).
**Date input** `px-3 py-2 rounded-field border border-line bg-panel text-[13px] tabular-nums` · focus `border-ink` (єдиний focus-стиль у системі) · disabled bg-mute text-ink-3.
**Multi-select list** контейнер `rounded-[12px] border border-line bg-panel p-2 px-3 h-[168px] overflow-y-auto`; рядок `label flex items-center gap-2 py-1 text-[13px]` checked text-ink / unchecked text-ink-2 · hover bg-mute -mx-1 px-1 rounded · loading/empty `text-xs text-ink-3 p-1` («Завантаження…» / «Немає …»). Шапка списку: title `text-xs font-semibold` + text action xs «Вибрати всі». На мобільному шапка згортає список (SVG ▾).
**Checkbox** (таблиця й списки) `h-4 w-4 rounded-[5px] border-[1.5px] border-line bg-panel accent-ink` · checked bg-ink + біла SVG-галочка (або нативний з `accent-ink`) · виділений рядок bg-mute.
**Type chip** `inline-block px-[9px] py-[3px] rounded-full text-[11.5px] font-medium` — bg `*-soft`, text `*` кольору типу. Єдиний спосіб показати тип у таблиці; **фон рядка не фарбується** (рішення 10.09).
**Category chip** (/earn) як Month chip, але з крапкою `w-2 h-2 rounded-full` кольору лінії графіка перед назвою; крапка завжди, легенда графіка не рендериться.
**Project chip** (/projects) як Category chip: крапка статусу (income-заливка = активний, лише бордер ink-2 = завершений) + назва + `%` text-xs text-ink-2 (у активного — text-white/70). Легенда «● активний ○ завершений» одним рядком під чипами.
**Stat tile** `rounded-card px-[18px] py-3.5`: income/expense — `bg-*-soft` без бордера, число кольором типу; нейтральні — `bg-panel border border-line`, число text-ink; «Баланс проєкту» — `bg-mute`. Лейбл `text-xs text-ink-2`, число `text-[22px] font-semibold tabular-nums` (mobile 17–20px). Мобайл: суми Балансу — список «лейбл … число» з дільниками, не плитки.
**Section card** `bg-panel border border-line rounded-card px-5 py-[18px]`; заголовок секції зліва, дії/підказка справа (`flex justify-between items-center mb-2.5`). Згортання — заголовок клікабельний, справа `text-[13px] text-ink-2` «згорнуто» + SVG ▾.
**Table** `w-full border-collapse text-[13.5px]`; head за §2; `td px-2.5 py-2.5 border-b border-line align-top`; суми `text-right whitespace-nowrap`. Рядок вихідного переказу має service-рядок під собою `text-xs` (ok → text-income «↳ Txxxx · різниця 0,00 ✓», інакше text-expense «↳ ще не повернувся»). Підсумок — ОДИН рядок `border-t-[1.5px] border-ink font-semibold` («Разом за період: +… −… = …»); на /projects — розрахункові рядки під таблицею (Надходження / Витрати / Податки 11% / Бонуси / = Баланс). empty — один `td colSpan` `py-4 text-center text-ink-2` з причиною і кнопкою «Скинути». loading — «Завантаження…» `text-sm text-ink-2 text-center py-10` лише при першому завантаженні; при refresh дані лишаються.
**Mobile row card** (<sm замість таблиці) `flex gap-2.5 py-2.5 border-b border-line`: чекбокс · колонка: рядок1 `text-xs text-ink-2` «дата · рахунок · ID» + сума справа `text-[15px] font-semibold` кольором типу; рядок2 опис `text-sm`; рядок3 категорія text-xs text-ink-2 + type chip справа.
**Warning line** (⚠ непарних / пропущено / без ID) `text-xs text-expense` одним рядком у шапці секції таблиці; «без ID» — text-danger.
**Recharts** бар `radius [2,2,0,0]`, grid `stroke line dasharray 3 3`, tick `fontSize 11 fill ink-500`, tooltip `contentStyle {border:1px solid line, borderRadius:10, boxShadow:none, fontFamily:sans}`; кольори з `theme.ts`: income/expense для барів і пирогів, `CHART_SERIES` для ліній категорій.

## 4. Layout
`max-w-[1440px] mx-auto px-12 lg:px-12 sm:px-6 px-4`; шапка НЕ sticky на мобайлі (звільняє 130px), sticky на ≥md; порядок на всіх сторінках: header (лого · nav · Оновити/Джерело) → KPI-рядок (+ «Оновлено ЧЧ:ХХ» справа) → рядок chip-summary/сегмент/Скинути → плитки → секції. Секції — `flex flex-col gap-4`. Фільтри розгорнуті: поля дат (2×200px) → рядки років із чипами місяців → 5 списків `flex gap-3.5`.

## 5. Depth
Без тіней. Шари: canvas → panel (бордер) → selected (mute) → active (ink). Popover ранвею: `bg-panel border border-line rounded-card` без shadow, `z-30`.

## 6. Responsive
sm 640 / md 768 / lg 1024. <sm: таблиці → Mobile row card; /fop → 4 колонки (Місяць коротко «вер 26» · Рах. · Сплачено · Різниця), база в розгортанні; /projects → нативний `<select>` замість чипів + плитки 2 колонки; шапка два рядки (лого+Оновити / nav) + KPI 22px. Touch-target ≥ 40px для чипів і сегментів.

## 7. Do / Don't
- ✅ Кольори тільки токенами з `tailwind.config.ts`; Recharts — з `src/lib/theme.ts`.
- ✅ Один рендер: text action, primary/secondary button, chip, checkbox, section header, table head.
- ✅ Тип транзакції = chip + колір суми. ❌ Фон рядка за типом.
- ✅ Підсумок таблиці — один рядок. ❌ Три кольорові рядки «Разом/Разом/Баланс».
- ❌ `shadow-*`, `[#hex]`, `text-md`, `rounded-md`, `blue-*`, `indigo-*`, `purple-*`, `sky-*`, `orange-*`, `gray-*`.
- ❌ `:focus-visible`-кільця; focus лише `border-ink` на інпутах.
- ❌ Emoji у контролах; ⚠ ↳ ↩ ✓ як текстові гліфи в таблиці — дозволено (легасі-семантика колонки ID/пар).

## 8. Agent guide
Перед правкою UI: прочитати front-matter → знайти компонент у §3 → писати класи лише з токенів. Verify: `grep -nE "\[#[0-9A-Fa-f]{3,6}\]|shadow-|text-md|rounded-md|blue-|indigo-|purple-|sky-|orange-|gray-" src/app src/components` → 0 рядків; `npm run build` зелений; скріншот desktop 1440 + mobile 390 кожної зачепленої сторінки поруч із еталонним `.dc.html`; числа на сторінці = числа з `/api/sheet-data` (перевірка скриптом). Штамп у кожному page.tsx: `{/* design-md: fintracker Журнал v1 */}`.
