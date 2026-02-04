import React, { useState } from 'react';
import { Copy, Trash2, Key, Check, SlidersHorizontal } from 'lucide-react';
import { ApiKey } from '../../types';
import { Button } from '../Common/Button';

export interface ApiKeyCardProps {
  apiKey: ApiKey;
  onRequestDelete: (id: string) => void;
  onEditLimits?: (id: string) => void;
  onCopy?: () => void;
  theme: 'light' | 'dark';
  solutionCount?: number;
}

export const ApiKeyCard: React.FC<ApiKeyCardProps> = ({
  apiKey,
  onRequestDelete,
  onEditLimits,
  onCopy,
  theme,
  solutionCount = 0,
}) => {
  const [copied, setCopied] = useState(false);
  const dailyLabel = apiKey.dailyLimit == null ? 'Unlimited' : apiKey.dailyLimit.toLocaleString();
  const monthlyLabel = apiKey.monthlyLimit == null ? 'Unlimited' : apiKey.monthlyLimit.toLocaleString();

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.();
  };

  const handleDelete = () => {
    onRequestDelete(apiKey.id);
  };

  return (
    <div
      className={`
        p-4 rounded-lg border transition-shadow duration-300
        ${theme === 'dark'
          ? 'bg-slate-900 border-slate-700 hover:shadow-xl'
          : 'bg-white border-gray-200 hover:shadow-xl'
        }
      `}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Key size={18} className={theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'} />
          <h3 className={`font-semibold ${theme === 'dark' ? 'text-slate-100' : 'text-gray-900'}`}>
            {apiKey.name}
          </h3>
        </div>
      </div>

      <div className={`mb-1 p-2 rounded font-mono text-sm break-all ${
        theme === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-gray-50 text-gray-700'
      }`}>
        Key ID: {apiKey.id}
      </div>
      <p className={`mb-3 text-xs ${
        theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
      }`}>
        API key values are shown only once at creation.
      </p>

      <div className={`mb-3 rounded-md border px-3 py-2 text-xs ${
        theme === 'dark' ? 'border-slate-700 text-slate-300 bg-slate-900/60' : 'border-gray-200 text-gray-600 bg-gray-50'
      }`}>
        <div className="flex items-center justify-between">
          <span>Daily limit</span>
          <span className="font-medium">{dailyLabel}</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span>Monthly limit</span>
          <span className="font-medium">{monthlyLabel}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCopy}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span className="ml-1">{copied ? 'Copied ID!' : 'Copy ID'}</span>
        </Button>
        {onEditLimits && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEditLimits(apiKey.id)}
          >
            <SlidersHorizontal size={14} />
            <span className="ml-1">Edit limits</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
        >
          <Trash2 size={14} />
          <span className="ml-1">Delete</span>
        </Button>
      </div>

      <div className={`text-xs pt-3 border-t ${
        theme === 'dark' ? 'border-slate-700 text-slate-400' : 'border-gray-200 text-gray-500'
      }`}>
        <div className="flex justify-between items-center mb-2">
          <span>Created: {apiKey.createdAt ? new Date(apiKey.createdAt).toLocaleDateString() : 'Unknown'}</span>
          {solutionCount > 0 && (
            <span className="text-xs">
              {solutionCount} solution{solutionCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
