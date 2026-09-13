'use client';

import { BASE_PLATFORMS, ROBINHOOD_PLATFORMS, FILTER_LABELS } from '@/lib/platforms';
import { PotentialFilters } from '@/lib/potentialFilters';

function NumberField({
  label,
  value,
  onChange,
  placeholder = 'Not set',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
        placeholder={placeholder}
        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
      />
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-blue-500"
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
  options: { key: T; label: string }[];
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
          className={`px-2.5 py-1.5 text-xs font-bold transition-colors whitespace-nowrap ${
            value === o.key ? 'bg-blue-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-slate-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
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
  // Empty selection already means "match every platform" in the filter logic,
  // so the "All" checkbox should read as checked in that state too — not only
  // when every individual platform has been explicitly ticked.
  const allSelected = selected.length === 0 || (list.length > 0 && list.every((p) => selected.includes(p)));
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-extrabold text-blue-300 cursor-pointer">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={() => onToggleAll(list)}
          className="w-3.5 h-3.5 accent-blue-500"
        />
        All
      </label>
      {list.map((p) => (
        <label key={p} className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={selected.includes(p)}
            onChange={() => onToggleOne(p)}
            className="w-3.5 h-3.5 accent-blue-500"
          />
          {FILTER_LABELS[p] ?? p}
        </label>
      ))}
    </div>
  );
}

export function PotentialFilterPanel({
  filters,
  onChange,
  onApply,
  onReset,
  resultCount,
}: {
  filters: PotentialFilters;
  onChange: (f: PotentialFilters) => void;
  onApply: () => void;
  onReset: () => void;
  resultCount: number;
}) {
  function set<K extends keyof PotentialFilters>(key: K, value: PotentialFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  function togglePlatform(p: string) {
    const key = filters.network === 'base' ? 'basePlatforms' : 'robinhoodPlatforms';
    const list = filters[key];
    const has = list.includes(p);
    set(key, has ? list.filter((x) => x !== p) : [...list, p]);
  }

  function toggleGroupAll(list: string[]) {
    const key = filters.network === 'base' ? 'basePlatforms' : 'robinhoodPlatforms';
    const current = filters[key];
    const allSelected = list.length > 0 && list.every((p) => current.includes(p));
    set(key, allSelected ? [] : [...list]);
  }

  const activePlatformList = filters.network === 'base' ? BASE_PLATFORMS : ROBINHOOD_PLATFORMS;
  const activeSelected = filters.network === 'base' ? filters.basePlatforms : filters.robinhoodPlatforms;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
      {/* Network + Platforms */}
      <div className="grid lg:grid-cols-[auto_1fr] gap-4">
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Network</span>
          <SegButton
            options={[
              { key: 'base' as const, label: 'Base' },
              { key: 'robinhood' as const, label: 'Robinhood' },
            ]}
            value={filters.network}
            onChange={(v) => set('network', v)}
          />
        </div>

        <div className="space-y-3">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
            Platform ({filters.network === 'base' ? 'Base' : 'Robinhood'})
          </span>
          <PlatformGroup
            list={activePlatformList}
            selected={activeSelected}
            onToggleOne={togglePlatform}
            onToggleAll={toggleGroupAll}
          />
        </div>
      </div>

      <div className="h-px bg-slate-800" />

      {/* Score / whale / buying / trends */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <NumberField label="Min WYCKSCORE" value={filters.minScore} onChange={(v) => set('minScore', v)} />
        <div className="flex flex-col gap-1.5 justify-end pb-1.5">
          <Toggle label="Has Whale 🐋" checked={filters.hasWhale} onChange={(v) => set('hasWhale', v)} />
          <Toggle label="Strong buying ▲" checked={filters.strongBuying} onChange={(v) => set('strongBuying', v)} />
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

      {/* Bull / Bear / NetBull */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <NumberField label="Min Bull" value={filters.minBull} onChange={(v) => set('minBull', v)} />
        <NumberField label="Max Bear" value={filters.maxBear} onChange={(v) => set('maxBear', v)} />
        <NumberField label="Min Net Bull" value={filters.minNetBull} onChange={(v) => set('minNetBull', v)} />
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Check over</span>
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
      </div>

      <div className="h-px bg-slate-800" />

      {/* Market metrics */}
      <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <NumberField label="Min Market Cap" value={filters.minMarketCap} onChange={(v) => set('minMarketCap', v)} />
        <NumberField label="Max Market Cap" value={filters.maxMarketCap} onChange={(v) => set('maxMarketCap', v)} />
        <NumberField label="Min Liquidity" value={filters.minLiq} onChange={(v) => set('minLiq', v)} />
        <NumberField label="Min Vol 1h" value={filters.minVol1h} onChange={(v) => set('minVol1h', v)} />
        <NumberField label="Min Vol 6h" value={filters.minVol6h} onChange={(v) => set('minVol6h', v)} />
        <NumberField label="Min Vol 24h" value={filters.minVol24h} onChange={(v) => set('minVol24h', v)} />
      </div>

      <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
        <span className="text-xs text-slate-500">
          {resultCount} token{resultCount === 1 ? '' : 's'} match current filters
        </span>
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
    </div>
  );
}