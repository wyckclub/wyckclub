'use client';

import { BASE_PLATFORMS, ROBINHOOD_PLATFORMS, ARC_PLATFORMS, FILTER_LABELS } from '@/lib/platforms';
import { PotentialFilters, NetworkKey } from '@/lib/potentialFilters';
import { NetworkIcon } from '@/components/NetworkIcon';

export type PotentialTab = 'following' | NetworkKey;

function NumberField({
  label,
  value,
  onChange,
  placeholder = 'Not set',
  className = '',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.\-]/g, ''))}
        placeholder={placeholder}
        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
      />
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: React.ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="wyck-checkbox"
      />
      {label}
    </label>
  );
}

function SegButton<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-slate-800 w-fit">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold transition-colors whitespace-nowrap ${
            value === o.key ? 'bg-blue-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-slate-200'
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? '#facc15' : 'none'}
      stroke={filled ? '#facc15' : 'currentColor'}
      strokeWidth={1.5}
      className="w-4 h-4 shrink-0"
    >
      <path d="M12 2.5l3.09 6.26 6.91 1-5 4.87 1.18 6.88L12 17.98l-6.18 3.53L7 14.63l-5-4.87 6.91-1L12 2.5z" />
    </svg>
  );
}

function PlatformGroup({
  list,
  selected,
  onToggleOne,
  onToggleAll,
}: {
  list: string[];
  selected: string[];
  onToggleOne: (p: string) => void;
  onToggleAll: (list: string[]) => void;
}) {
  const allSelected = list.length > 0 && list.every((p) => selected.includes(p));
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      <button
        type="button"
        onClick={() => onToggleAll(list)}
        className={`text-xs font-bold px-2 py-1 rounded transition-colors ${
          allSelected ? 'bg-green-700 text-white' : 'bg-slate-800 text-blue-300 hover:bg-slate-700'
        }`}
      >
        Select All
      </button>
      {list.map((p) => (
        <label key={p} className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={selected.includes(p)}
            onChange={() => onToggleOne(p)}
            className="wyck-checkbox wyck-checkbox-sm"
          />
          {FILTER_LABELS[p] ?? p}
        </label>
      ))}
    </div>
  );
}

export function PotentialFilterPanel({
  tab,
  network,
  onTabChange,
  filters,
  onChange,
  onApply,
  onReset,
  resultCount,
  rightSlot,
}: {
  tab: PotentialTab;
  network: NetworkKey;
  onTabChange: (t: PotentialTab) => void;
  filters: PotentialFilters;
  onChange: (f: PotentialFilters) => void;
  onApply: () => void;
  onReset: () => void;
  resultCount: number;
  rightSlot?: React.ReactNode;
}) {
  const isFollowing = tab === 'following';

  function set<K extends keyof PotentialFilters>(key: K, value: PotentialFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  function togglePlatform(p: string) {
    const key = filters.network === 'base' ? 'basePlatforms'
      : filters.network === 'robinhood' ? 'robinhoodPlatforms'
      : 'arcPlatforms';
    const list = filters[key];
    const has = list.includes(p);
    set(key, has ? list.filter((x) => x !== p) : [...list, p]);
  }

  function toggleGroupAll(list: string[]) {
    const key = filters.network === 'base' ? 'basePlatforms'
      : filters.network === 'robinhood' ? 'robinhoodPlatforms'
      : 'arcPlatforms';
    const current = filters[key];
    const allSelected = list.length > 0 && list.every((p) => current.includes(p));
    set(key, allSelected ? [] : [...list]);
  }

  const activePlatformList =
    filters.network === 'base' ? BASE_PLATFORMS :
    filters.network === 'robinhood' ? ROBINHOOD_PLATFORMS :
    ARC_PLATFORMS;

  const activeSelected =
    filters.network === 'base' ? filters.basePlatforms :
    filters.network === 'robinhood' ? filters.robinhoodPlatforms :
    filters.arcPlatforms;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
      <div className="grid lg:grid-cols-[auto_1fr] gap-4">
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Network</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onTabChange('following')}
              title="Following"
              className={`flex items-center justify-center w-8 h-[30px] rounded-lg border transition-colors ${
                isFollowing
                  ? 'border-yellow-400/60 bg-yellow-500/10'
                  : 'border-slate-800 bg-slate-950 hover:border-slate-700'
              }`}
            >
              <StarIcon filled={isFollowing} />
            </button>
            <SegButton
              options={[
                { key: 'base' as const, label: 'Base', icon: <NetworkIcon chain="base" className="w-3.5 h-3.5" /> },
                {
                  key: 'robinhood' as const,
                  label: 'Robinhood',
                  icon: <NetworkIcon chain="robinhood" className="w-3.5 h-3.5" />,
                },
                { key: 'arc' as const, label: 'Arc', icon: <NetworkIcon chain="arc" className="w-3.5 h-3.5" /> },
              ]}
              value={network}
              onChange={(v) => onTabChange(v)}
            />
          </div>
        </div>

        {!isFollowing && (
          <div className="space-y-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
              Platform ({network === 'base' ? 'Base' : network === 'robinhood' ? 'Robinhood' : 'Arc'})
            </span>
            <PlatformGroup
              list={activePlatformList}
              selected={activeSelected}
              onToggleOne={togglePlatform}
              onToggleAll={toggleGroupAll}
            />
          </div>
        )}

        {isFollowing && rightSlot && (
          <div className="flex items-end lg:justify-end min-w-0">{rightSlot}</div>
        )}
      </div>

      {!isFollowing && (
        <>
          <div className="h-px bg-slate-800" />

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <NumberField label="Min WYCKSCORE" value={filters.minScore} onChange={(v) => set('minScore', v)} />
            <div className="flex flex-col gap-1.5 justify-end pb-1.5">
              <Toggle label="Has Whale 🐋" checked={filters.hasWhale} onChange={(v) => set('hasWhale', v)} />
              <Toggle label={<>Strong buying<span className="text-green-500">▲</span></>} checked={filters.strongBuying} onChange={(v) => set('strongBuying', v)} />
              <Toggle
                label={<>Both 🐋 +<span className="text-green-500">▲</span></>}
                checked={filters.bothRequired}
                onChange={(v) => set('bothRequired', v)}
              />
            </div>
            <div className="flex flex-col gap-1.5 justify-end pb-1.5">
              <Toggle label="Bulls increase" checked={filters.bullsIncrease} onChange={(v) => set('bullsIncrease', v)} />
              <Toggle label="Bears decrease" checked={filters.bearsDecrease} onChange={(v) => set('bearsDecrease', v)} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Price trend</span>
              <SegButton
                options={[
                  { key: 'any' as const, label: 'Not set' },
                  { key: 'down' as const, label: 'Down' },
                  { key: 'up' as const, label: 'Up' },
                ]}
                value={filters.priceTrend}
                onChange={(v) => set('priceTrend', v)}
              />
            </div>
            <div className="space-y-1">
              <span
                className="text-[11px] font-bold text-slate-400 uppercase tracking-wide cursor-help"
                title="Whale Accumulation Index"
              >
                W.A.I trend
              </span>
              <SegButton
                options={[
                  { key: 'any' as const, label: 'Not set' },
                  { key: 'notdown' as const, label: 'Not decreasing' },
                  { key: 'down' as const, label: 'Decreasing' },
                ]}
                value={filters.waiTrend}
                onChange={(v) => set('waiTrend', v)}
              />
            </div>
          </div>

          <div className="h-px bg-slate-800" />

          <div className="flex flex-wrap lg:grid-cols-6 items-end gap-3">
            <div className="space-y-1 shrink-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">Check over</span>
              <SegButton
                options={[
                  { key: 1 as const, label: 'Current entry' },
                  { key: 2 as const, label: 'Last 2 entries' },
                  { key: 3 as const, label: 'Last 3 entries' },
                ]}
                value={filters.entryWindow}
                onChange={(v) => set('entryWindow', v)}
              />
            </div>
            <NumberField label="(Entry) % PriceUp under" value={filters.maxPriceUp} onChange={(v) => set('maxPriceUp', v)} placeholder="%" />
            <NumberField label="Min Bull" value={filters.minBull} onChange={(v) => set('minBull', v)} />
            <NumberField label="Max Bear" value={filters.maxBear} onChange={(v) => set('maxBear', v)} />
            <NumberField label="Min Net Bull" value={filters.minNetBull} onChange={(v) => set('minNetBull', v)} />
            <NumberField label="Min Age" value={filters.minAge} onChange={(v) => set('minAge', v)} placeholder="hour" />
            <NumberField label="Max Age" value={filters.maxAge} onChange={(v) => set('maxAge', v)} placeholder="hour" />
          </div>

          <div className="h-px bg-slate-800" />

          <div className="grid sm:grid-cols-3 lg:grid-cols-7 gap-3">
            <NumberField label="Min Market Cap" value={filters.minMarketCap} onChange={(v) => set('minMarketCap', v)} />
            <NumberField label="Max Market Cap" value={filters.maxMarketCap} onChange={(v) => set('maxMarketCap', v)} />
            <NumberField label="Min Liquidity" value={filters.minLiq} onChange={(v) => set('minLiq', v)} />
            <NumberField label="Max Change24h (%)" value={filters.maxChange24h} onChange={(v) => set('maxChange24h', v)} />
            <NumberField label="Min Vol 1h" value={filters.minVol1h} onChange={(v) => set('minVol1h', v)} />
            <NumberField label="Min Vol 6h" value={filters.minVol6h} onChange={(v) => set('minVol6h', v)} />
            <NumberField label="Min Vol 24h" value={filters.minVol24h} onChange={(v) => set('minVol24h', v)} />
          </div>

          <div className="flex items-center justify-end pt-1 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={onReset}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold transition-colors"
              >
                Reset
              </button>
              <button
                onClick={onApply}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-colors"
              >
                Filter tokens
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}