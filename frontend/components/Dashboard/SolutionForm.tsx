import React, { useState } from 'react';
import { Button } from '../Common/Button';
import { Toggle } from '../Common/Toggle';
import type { Visibility } from '@/types';

export interface SolutionFormData {
  title: string;
  errorMessage: string;
  errorType: string;
  context: string;
  rootCause: string;
  solution: string;
  tags: string;
  visibility?: Visibility;
}

export interface SolutionFormProps {
  onSubmit: (data: SolutionFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  theme: 'light' | 'dark';
}

export const SolutionForm: React.FC<SolutionFormProps> = ({
  onSubmit,
  onCancel,
  isLoading = false,
  theme,
}) => {
  const [formData, setFormData] = useState<SolutionFormData>({
    title: '',
    errorMessage: '',
    errorType: '',
    context: '',
    rootCause: '',
    solution: '',
    tags: '',
    visibility: 'private',
  });

  const handleChange = (field: keyof SolutionFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  const inputClass = `w-full px-3 py-2 rounded-md border ${
    theme === 'dark'
      ? 'bg-slate-800 border-slate-600 text-slate-100 placeholder-slate-400'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
  } focus:outline-none focus:ring-2 focus:ring-emerald-500`;

  const labelClass = `block text-sm font-medium mb-1 ${
    theme === 'dark' ? 'text-slate-200' : 'text-gray-700'
  }`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={formData.title}
          onChange={(e) => handleChange('title', e.target.value)}
          className={inputClass}
          placeholder="Brief description of the error"
        />
      </div>

      <div>
        <label className={labelClass}>
          Error Message <span className="text-red-500">*</span>
        </label>
        <textarea
          required
          rows={3}
          value={formData.errorMessage}
          onChange={(e) => handleChange('errorMessage', e.target.value)}
          className={inputClass}
          placeholder="The actual error message"
        />
      </div>

      <div>
        <label className={labelClass}>
          Error Type <span className="text-red-500">*</span>
        </label>
        <select
          required
          value={formData.errorType}
          onChange={(e) => handleChange('errorType', e.target.value)}
          className={inputClass}
        >
          <option value="">Select error type</option>
          <option value="compile">Compile Error</option>
          <option value="runtime">Runtime Error</option>
          <option value="configuration">Configuration Error</option>
          <option value="dependency">Dependency Error</option>
          <option value="network">Network Error</option>
          <option value="logic">Logic Error</option>
          <option value="performance">Performance Issue</option>
          <option value="security">Security Issue</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div>
        <label className={labelClass}>
          Context <span className="text-red-500">*</span>
        </label>
        <textarea
          required
          rows={3}
          value={formData.context}
          onChange={(e) => handleChange('context', e.target.value)}
          className={inputClass}
          placeholder="When and where the error occurred"
        />
      </div>

      <div>
        <label className={labelClass}>
          Root Cause <span className="text-red-500">*</span>
        </label>
        <textarea
          required
          rows={3}
          value={formData.rootCause}
          onChange={(e) => handleChange('rootCause', e.target.value)}
          className={inputClass}
          placeholder="Why the error happened"
        />
      </div>

      <div>
        <label className={labelClass}>
          Solution <span className="text-red-500">*</span>
        </label>
        <textarea
          required
          rows={4}
          value={formData.solution}
          onChange={(e) => handleChange('solution', e.target.value)}
          className={inputClass}
          placeholder="How you fixed it"
        />
      </div>

      <div>
        <label className={labelClass}>
          Tags <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={formData.tags}
          onChange={(e) => handleChange('tags', e.target.value)}
          className={inputClass}
          placeholder="Comma-separated tags (e.g., react, typescript, hooks)"
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Toggle
            checked={formData.visibility === 'team'}
            onChange={(checked) => handleChange('visibility', checked ? 'team' : 'private')}
            label="Share with team"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          type="submit"
          variant="primary"
          isLoading={isLoading}
          disabled={isLoading}
        >
          Create Solution
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
};
