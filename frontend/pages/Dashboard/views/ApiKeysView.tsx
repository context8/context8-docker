import React, { useMemo, useState } from 'react';
import { Plus, Key } from 'lucide-react';
import { ApiKeyCard } from '../../../components/Dashboard/ApiKeyCard';
import { Button } from '../../../components/Common/Button';
import { Modal } from '../../../components/Common/Modal';
import { useApiKeys } from '../../../hooks/useApiKeys';
import { useToast } from '../../../hooks/useToast';
import { ToastContainer } from '../../../components/Common/Toast';
import { ThemeMode, SubApiKey } from '../../../types';

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
  const {
    apiKeys,
    subKeysByParent,
    isLoading,
    createApiKey,
    deleteApiKey,
    updateApiKeyLimits,
    createSubKey,
    updateSubKey,
    deleteSubKey,
  } = useApiKeys(token);
  const { toasts, success, error, dismiss } = useToast();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [createdKeyLabel, setCreatedKeyLabel] = useState('API Key Created');
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
  const [subKeyParentId, setSubKeyParentId] = useState<string | null>(null);
  const [subKeyName, setSubKeyName] = useState('');
  const [subKeyCanRead, setSubKeyCanRead] = useState(true);
  const [subKeyCanWrite, setSubKeyCanWrite] = useState(true);
  const [subKeyDailyLimit, setSubKeyDailyLimit] = useState('');
  const [subKeyMonthlyLimit, setSubKeyMonthlyLimit] = useState('');
  const [isCreatingSubKey, setIsCreatingSubKey] = useState(false);
  const [editSubKey, setEditSubKey] = useState<SubApiKey | null>(null);
  const [editSubKeyName, setEditSubKeyName] = useState('');
  const [editSubKeyCanRead, setEditSubKeyCanRead] = useState(true);
  const [editSubKeyCanWrite, setEditSubKeyCanWrite] = useState(true);
  const [editSubKeyDailyLimit, setEditSubKeyDailyLimit] = useState('');
  const [editSubKeyMonthlyLimit, setEditSubKeyMonthlyLimit] = useState('');
  const [isUpdatingSubKey, setIsUpdatingSubKey] = useState(false);

  const deleteTarget = useMemo(
    () => apiKeys.find((key) => key.id === deleteKeyId) || null,
    [apiKeys, deleteKeyId],
  );
  const editTarget = useMemo(
    () => apiKeys.find((key) => key.id === editKeyId) || null,
    [apiKeys, editKeyId],
  );
  const subKeyParent = useMemo(
    () => apiKeys.find((key) => key.id === subKeyParentId) || null,
    [apiKeys, subKeyParentId],
  );
  const subKeysForParent = useMemo(
    () => (subKeyParentId ? subKeysByParent[subKeyParentId] || [] : []),
    [subKeyParentId, subKeysByParent],
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
      setCreatedKeyLabel('API Key Created');
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

  const handleSubKeyManage = (id: string) => {
    setSubKeyParentId(id);
    setSubKeyName('');
    setSubKeyCanRead(true);
    setSubKeyCanWrite(true);
    setSubKeyDailyLimit('');
    setSubKeyMonthlyLimit('');
  };

  const normalizeSubPermissions = (canRead: boolean, canWrite: boolean) => {
    if (canWrite && !canRead) {
      return { canRead: true, canWrite: true };
    }
    if (!canRead && !canWrite) {
      error('At least one permission must be enabled');
      return null;
    }
    return { canRead, canWrite };
  };

  const handleCreateSubKey = async () => {
    if (!subKeyParentId || !subKeyName.trim()) {
      error('Please enter a name for the sub API key');
      return;
    }
    const dailyLimit = parseLimit(subKeyDailyLimit, 'Daily limit');
    if (dailyLimit === undefined) return;
    const monthlyLimit = parseLimit(subKeyMonthlyLimit, 'Monthly limit');
    if (monthlyLimit === undefined) return;
    const perms = normalizeSubPermissions(subKeyCanRead, subKeyCanWrite);
    if (!perms) return;

    setIsCreatingSubKey(true);
    try {
      const created = await createSubKey(subKeyParentId, {
        name: subKeyName.trim(),
        canRead: perms.canRead,
        canWrite: perms.canWrite,
        dailyLimit,
        monthlyLimit,
      });
      success('Sub API key created');
      setSubKeyName('');
      setSubKeyCanRead(true);
      setSubKeyCanWrite(true);
      setSubKeyDailyLimit('');
      setSubKeyMonthlyLimit('');
      if (created.apiKey) {
        setCreatedKeyLabel('Sub API Key Created');
        setCreatedKeyValue(created.apiKey);
        setShowKeyModal(true);
      }
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to create sub API key');
    } finally {
      setIsCreatingSubKey(false);
    }
  };

  const handleEditSubKeyRequest = (item: SubApiKey) => {
    setEditSubKey(item);
    setEditSubKeyName(item.name);
    setEditSubKeyCanRead(item.canRead);
    setEditSubKeyCanWrite(item.canWrite);
    setEditSubKeyDailyLimit(item.dailyLimit == null ? '' : String(item.dailyLimit));
    setEditSubKeyMonthlyLimit(item.monthlyLimit == null ? '' : String(item.monthlyLimit));
  };

  const handleUpdateSubKey = async () => {
    if (!editSubKey || !subKeyParentId) return;
    if (!editSubKeyName.trim()) {
      error('Please enter a name for the sub API key');
      return;
    }
    const dailyLimit = parseLimit(editSubKeyDailyLimit, 'Daily limit');
    if (dailyLimit === undefined) return;
    const monthlyLimit = parseLimit(editSubKeyMonthlyLimit, 'Monthly limit');
    if (monthlyLimit === undefined) return;
    const perms = normalizeSubPermissions(editSubKeyCanRead, editSubKeyCanWrite);
    if (!perms) return;

    setIsUpdatingSubKey(true);
    try {
      await updateSubKey(subKeyParentId, editSubKey.id, {
        name: editSubKeyName.trim(),
        canRead: perms.canRead,
        canWrite: perms.canWrite,
        dailyLimit,
        monthlyLimit,
      });
      success('Sub API key updated');
      setEditSubKey(null);
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to update sub API key');
    } finally {
      setIsUpdatingSubKey(false);
    }
  };

  const handleDeleteSubKey = async (item: SubApiKey) => {
    if (!subKeyParentId) return;
    setIsUpdatingSubKey(true);
    try {
      await deleteSubKey(subKeyParentId, item.id);
      success('Sub API key revoked');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to revoke sub API key');
    } finally {
      setIsUpdatingSubKey(false);
    }
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
              onManageSubKeys={handleSubKeyManage}
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
        title={createdKeyLabel}
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
        isOpen={Boolean(subKeyParent)}
        onClose={() => !isCreatingSubKey && !isUpdatingSubKey && setSubKeyParentId(null)}
        title="Sub API Keys"
      >
        {subKeyParent && (
          <div className="space-y-5">
            <div>
              <p className={theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}>
                Manage sub keys for <span className="font-medium">{subKeyParent.name}</span>.
              </p>
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                Sub keys inherit access to this API key and can be restricted to read-only.
              </p>
            </div>

            <div className="space-y-3">
              <div className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>
                Existing sub keys
              </div>
              {subKeysForParent.length === 0 ? (
                <div className={`rounded-md border px-3 py-2 text-sm ${
                  theme === 'dark' ? 'border-slate-700 text-slate-400' : 'border-gray-200 text-gray-500'
                }`}>
                  No sub keys yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {subKeysForParent.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-md border px-3 py-2 text-xs ${
                        theme === 'dark' ? 'border-slate-700 text-slate-300' : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{item.name}</div>
                          <div className="mt-1 font-mono">ID: {item.id}</div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditSubKeyRequest(item)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteSubKey(item)}
                          >
                            Revoke
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3">
                        <span>Read: {item.canRead ? 'Yes' : 'No'}</span>
                        <span>Write: {item.canWrite ? 'Yes' : 'No'}</span>
                        <span>Daily: {item.dailyLimit == null ? 'Unlimited' : item.dailyLimit}</span>
                        <span>Monthly: {item.monthlyLimit == null ? 'Unlimited' : item.monthlyLimit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>
                Create sub key
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${
                  theme === 'dark' ? 'text-slate-200' : 'text-gray-700'
                }`}>
                  Sub key name
                </label>
                <input
                  type="text"
                  value={subKeyName}
                  onChange={(e) => setSubKeyName(e.target.value)}
                  placeholder="e.g., Read-only client"
                  className={inputClass}
                  disabled={isCreatingSubKey}
                />
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className={`flex items-center gap-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-600'}`}>
                  <input
                    type="checkbox"
                    checked={subKeyCanRead}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setSubKeyCanRead(next);
                      if (!next && subKeyCanWrite) setSubKeyCanWrite(false);
                    }}
                    disabled={isCreatingSubKey}
                  />
                  Read
                </label>
                <label className={`flex items-center gap-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-600'}`}>
                  <input
                    type="checkbox"
                    checked={subKeyCanWrite}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setSubKeyCanWrite(next);
                      if (next && !subKeyCanRead) setSubKeyCanRead(true);
                    }}
                    disabled={isCreatingSubKey}
                  />
                  Write
                </label>
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
                    value={subKeyDailyLimit}
                    onChange={(e) => setSubKeyDailyLimit(e.target.value)}
                    placeholder="Leave empty for unlimited"
                    className={inputClass}
                    disabled={isCreatingSubKey}
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
                    value={subKeyMonthlyLimit}
                    onChange={(e) => setSubKeyMonthlyLimit(e.target.value)}
                    placeholder="Leave empty for unlimited"
                    className={inputClass}
                    disabled={isCreatingSubKey}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="primary"
                  onClick={handleCreateSubKey}
                  isLoading={isCreatingSubKey}
                  disabled={isCreatingSubKey}
                >
                  Create sub key
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setSubKeyParentId(null)}
                  disabled={isCreatingSubKey || isUpdatingSubKey}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(editSubKey)}
        onClose={() => !isUpdatingSubKey && setEditSubKey(null)}
        title="Edit Sub API Key"
      >
        {editSubKey && (
          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-1 ${
                theme === 'dark' ? 'text-slate-200' : 'text-gray-700'
              }`}>
                Name
              </label>
              <input
                type="text"
                value={editSubKeyName}
                onChange={(e) => setEditSubKeyName(e.target.value)}
                className={inputClass}
                disabled={isUpdatingSubKey}
              />
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className={`flex items-center gap-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-600'}`}>
                <input
                  type="checkbox"
                  checked={editSubKeyCanRead}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setEditSubKeyCanRead(next);
                    if (!next && editSubKeyCanWrite) setEditSubKeyCanWrite(false);
                  }}
                  disabled={isUpdatingSubKey}
                />
                Read
              </label>
              <label className={`flex items-center gap-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-600'}`}>
                <input
                  type="checkbox"
                  checked={editSubKeyCanWrite}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setEditSubKeyCanWrite(next);
                    if (next && !editSubKeyCanRead) setEditSubKeyCanRead(true);
                  }}
                  disabled={isUpdatingSubKey}
                />
                Write
              </label>
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
                  value={editSubKeyDailyLimit}
                  onChange={(e) => setEditSubKeyDailyLimit(e.target.value)}
                  placeholder="Leave empty for unlimited"
                  className={inputClass}
                  disabled={isUpdatingSubKey}
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
                  value={editSubKeyMonthlyLimit}
                  onChange={(e) => setEditSubKeyMonthlyLimit(e.target.value)}
                  placeholder="Leave empty for unlimited"
                  className={inputClass}
                  disabled={isUpdatingSubKey}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="primary"
                onClick={handleUpdateSubKey}
                isLoading={isUpdatingSubKey}
                disabled={isUpdatingSubKey}
              >
                Save
              </Button>
              <Button
                variant="secondary"
                onClick={() => setEditSubKey(null)}
                disabled={isUpdatingSubKey}
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
