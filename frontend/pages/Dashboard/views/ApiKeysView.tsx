import React, { useMemo, useState } from 'react';
import { Plus, Key } from 'lucide-react';
import { ApiKeyCard } from '../../../components/Dashboard/ApiKeyCard';
import { Button } from '../../../components/Common/Button';
import { Modal } from '../../../components/Common/Modal';
import { useApiKeys } from '../../../hooks/useApiKeys';
import { useToast } from '../../../hooks/useToast';
import { ToastContainer } from '../../../components/Common/Toast';
import { ThemeMode } from '../../../types';

export interface ApiKeysViewProps {
  token: string | null;
  theme: ThemeMode;
  solutionCounts?: Record<string, number>;
}

export const ApiKeysView: React.FC<ApiKeysViewProps> = ({
  token,
  theme,
  solutionCounts = {},
}) => {
  const { apiKeys, isLoading, createApiKey, deleteApiKey, updateApiKeyLimits } = useApiKeys(token);
  const { toasts, success, error, dismiss } = useToast();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [createdKeyValue, setCreatedKeyValue] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [newDailyLimit, setNewDailyLimit] = useState('');
  const [newMonthlyLimit, setNewMonthlyLimit] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [editKeyId, setEditKeyId] = useState<string | null>(null);
  const [editDailyLimit, setEditDailyLimit] = useState('');
  const [editMonthlyLimit, setEditMonthlyLimit] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const deleteTarget = useMemo(
    () => apiKeys.find((key) => key.id === deleteKeyId) || null,
    [apiKeys, deleteKeyId],
  );
  const editTarget = useMemo(
    () => apiKeys.find((key) => key.id === editKeyId) || null,
    [apiKeys, editKeyId],
  );
  const deletePrompt = deleteTarget ? `I CONFIRM DELETE ${deleteTarget.name}` : '';
  const isDeleteConfirmValid = deleteConfirmText.trim() === deletePrompt;

  const parseLimit = (value: string, label: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!/^[0-9]+$/.test(trimmed)) {
      error(`${label} must be a non-negative integer`);
      return undefined;
    }
    return Number(trimmed);
  };

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      error('Please enter a name for the API key');
      return;
    }

    const dailyLimit = parseLimit(newDailyLimit, 'Daily limit');
    if (dailyLimit === undefined) return;
    const monthlyLimit = parseLimit(newMonthlyLimit, 'Monthly limit');
    if (monthlyLimit === undefined) return;

    setIsCreating(true);
    try {
      const created = await createApiKey(newKeyName.trim(), { dailyLimit, monthlyLimit });
      success('API key created successfully!');
      setShowCreateModal(false);
      setNewKeyName('');
      setNewDailyLimit('');
      setNewMonthlyLimit('');
      setCreatedKeyValue(created.apiKey);
      setShowKeyModal(true);
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to create API key');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteRequest = (id: string) => {
    setDeleteKeyId(id);
    setDeleteConfirmText('');
  };

  const handleEditRequest = (id: string) => {
    const target = apiKeys.find((key) => key.id === id);
    if (!target) return;
    setEditKeyId(id);
    setEditDailyLimit(target.dailyLimit == null ? '' : String(target.dailyLimit));
    setEditMonthlyLimit(target.monthlyLimit == null ? '' : String(target.monthlyLimit));
  };

  const handleEditConfirm = async () => {
    if (!editTarget) return;
    const dailyLimit = parseLimit(editDailyLimit, 'Daily limit');
    if (dailyLimit === undefined) return;
    const monthlyLimit = parseLimit(editMonthlyLimit, 'Monthly limit');
    if (monthlyLimit === undefined) return;

    setIsUpdating(true);
    try {
      await updateApiKeyLimits(editTarget.id, { dailyLimit, monthlyLimit });
      success('API key limits updated');
      setEditKeyId(null);
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to update API key limits');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    if (!isDeleteConfirmValid) {
      error('Please type the confirmation phrase exactly to continue');
      return;
    }

    setIsDeleting(true);
    try {
      await deleteApiKey(deleteTarget.id);
      success('API key deleted successfully');
      setDeleteKeyId(null);
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to delete API key');
    } finally {
      setIsDeleting(false);
    }
  };


  const inputClass = `w-full px-3 py-2 rounded-md border ${
    theme === 'dark'
      ? 'bg-slate-800 border-slate-600 text-slate-100 placeholder-slate-400'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
  } focus:outline-none focus:ring-2 focus:ring-emerald-500`;

  return (
    <div className="space-y-6">
      <ToastContainer
        toasts={toasts}
        onClose={dismiss}
      />

      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-slate-100' : 'text-gray-900'}`}>
            API Keys
          </h2>
          <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            Manage your API keys for accessing solutions
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus size={18} />
          <span className="ml-2">New API Key</span>
        </Button>
      </div>

      {isLoading && apiKeys.length === 0 ? (
        <div className="text-center py-12">
          <p className={theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}>
            Loading API keys...
          </p>
        </div>
      ) : apiKeys.length === 0 ? (
        <div className="text-center py-12">
          <Key size={48} className={`mx-auto mb-4 ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`} />
          <h3 className={`text-lg font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
            No API keys yet
          </h3>
          <p className={`mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            Create your first API key to get started
          </p>
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={18} />
            <span className="ml-2">Create API Key</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {apiKeys.map((apiKey) => (
            <ApiKeyCard
              key={apiKey.id}
              apiKey={apiKey}
              onRequestDelete={handleDeleteRequest}
              onEditLimits={handleEditRequest}
              onCopy={() => success('API Key ID copied to clipboard')}
              theme={theme}
              solutionCount={solutionCounts[apiKey.id]}
            />
          ))}
        </div>
      )}

      <Modal
        isOpen={showCreateModal}
        onClose={() => !isCreating && setShowCreateModal(false)}
        title="Create New API Key"
      >
        <div className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-1 ${
              theme === 'dark' ? 'text-slate-200' : 'text-gray-700'
            }`}>
              API Key Name
            </label>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="e.g., Production, Development"
              className={inputClass}
              disabled={isCreating}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={`block text-sm font-medium mb-1 ${
                theme === 'dark' ? 'text-slate-200' : 'text-gray-700'
              }`}>
                Daily limit (optional)
              </label>
              <input
                type="number"
                min="0"
                value={newDailyLimit}
                onChange={(e) => setNewDailyLimit(e.target.value)}
                placeholder="Leave empty for unlimited"
                className={inputClass}
                disabled={isCreating}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${
                theme === 'dark' ? 'text-slate-200' : 'text-gray-700'
              }`}>
                Monthly limit (optional)
              </label>
              <input
                type="number"
                min="0"
                value={newMonthlyLimit}
                onChange={(e) => setNewMonthlyLimit(e.target.value)}
                placeholder="Leave empty for unlimited"
                className={inputClass}
                disabled={isCreating}
              />
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              variant="primary"
              onClick={handleCreate}
              isLoading={isCreating}
              disabled={isCreating}
            >
              Create
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showKeyModal}
        onClose={() => setShowKeyModal(false)}
        title="API Key Created"
      >
        <div className="space-y-4">
          <p className={theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}>
            This key is shown only once. Copy it now and store it securely.
          </p>
          <div className={`flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-sm ${
            theme === 'dark'
              ? 'bg-slate-800 border-slate-600 text-slate-100'
              : 'bg-gray-50 border-gray-200 text-gray-900'
          }`}>
            <span className="truncate">{createdKeyValue}</span>
            <button
              className={`ml-auto text-xs ${
                theme === 'dark' ? 'text-emerald-300' : 'text-emerald-700'
              }`}
              onClick={() => {
                if (createdKeyValue) {
                  navigator.clipboard.writeText(createdKeyValue);
                  success('API Key copied to clipboard');
                }
              }}
            >
              Copy
            </button>
          </div>
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => setShowKeyModal(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(editTarget)}
        onClose={() => !isUpdating && setEditKeyId(null)}
        title="Edit API Key Limits"
      >
        {editTarget && (
          <div className="space-y-4">
            <p className={theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}>
              Update limits for <span className="font-medium">{editTarget.name}</span>.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={`block text-sm font-medium mb-1 ${
                  theme === 'dark' ? 'text-slate-200' : 'text-gray-700'
                }`}>
                  Daily limit (optional)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editDailyLimit}
                  onChange={(e) => setEditDailyLimit(e.target.value)}
                  placeholder="Leave empty for unlimited"
                  className={inputClass}
                  disabled={isUpdating}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${
                  theme === 'dark' ? 'text-slate-200' : 'text-gray-700'
                }`}>
                  Monthly limit (optional)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editMonthlyLimit}
                  onChange={(e) => setEditMonthlyLimit(e.target.value)}
                  placeholder="Leave empty for unlimited"
                  className={inputClass}
                  disabled={isUpdating}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="primary"
                onClick={handleEditConfirm}
                isLoading={isUpdating}
                disabled={isUpdating}
              >
                Save
              </Button>
              <Button
                variant="secondary"
                onClick={() => setEditKeyId(null)}
                disabled={isUpdating}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => !isDeleting && setDeleteKeyId(null)}
        title="Delete API Key"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className={theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}>
              Deleting an API key is irreversible.
            </p>
            <div>
              <p className={`text-xs mb-2 ${
                theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
              }`}>
                API key name to confirm: <span className="font-mono select-all">{deleteTarget.name}</span>
              </p>
              <label className={`block text-sm font-medium mb-1 ${
                theme === 'dark' ? 'text-slate-200' : 'text-gray-700'
              }`}>
                Type the phrase below to confirm
              </label>
              <div className={`mb-2 rounded-md border px-3 py-2 font-mono text-xs ${
                theme === 'dark'
                  ? 'bg-slate-800 border-slate-700 text-slate-200'
                  : 'bg-gray-50 border-gray-200 text-gray-700'
              }`}>
                {deletePrompt}
              </div>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type the confirmation phrase"
                className={inputClass}
                disabled={isDeleting}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="danger"
                onClick={handleDeleteConfirm}
                isLoading={isDeleting}
                disabled={!isDeleteConfirmValid || isDeleting}
              >
                Confirm Delete
              </Button>
              <Button
                variant="secondary"
                onClick={() => setDeleteKeyId(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
