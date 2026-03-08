import React, { useState, useEffect } from 'react';
import { Github, UploadCloud, DownloadCloud, Plus, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button, Badge } from './UI';
import { GitHubService, GitHubAccount, GitHubRepo } from '../services/githubService';
import { useToast } from './Toast';

interface GitSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: any;
  onProjectUpdate?: (project: any) => Promise<void>;
}

export const GitSyncModal: React.FC<GitSyncModalProps> = ({ isOpen, onClose, project, onProjectUpdate }) => {
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState<GitHubAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [mode, setMode] = useState<'push' | 'pull'>('push');
  const [commitMessage, setCommitMessage] = useState('Update project files');
  const [newRepoName, setNewRepoName] = useState('');
  const [isCreatingRepo, setIsCreatingRepo] = useState(false);
  const [isPrivate, setIsPrivate] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadAccounts();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedAccount) {
      loadRepos(selectedAccount);
    }
  }, [selectedAccount]);

  const loadAccounts = async () => {
    try {
      const accs = await GitHubService.getConnectedAccounts();
      setAccounts(accs);
      if (accs.length > 0 && !selectedAccount) {
        setSelectedAccount(accs[0].id);
      }
    } catch (error) {
      console.error("Failed to load accounts", error);
      showToast("Failed to load GitHub accounts", "error");
    }
  };

  const loadRepos = async (accountId: string) => {
    setLoading(true);
    try {
      const account = accounts.find(a => a.id === accountId);
      if (account) {
        const repositories = await GitHubService.getRepositories(account.accessToken);
        setRepos(repositories);
      }
    } catch (error) {
      console.error("Failed to load repos", error);
      showToast("Failed to load repositories", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRepo = async () => {
    if (!newRepoName || !selectedAccount) return;
    setLoading(true);
    try {
      const account = accounts.find(a => a.id === selectedAccount);
      if (account) {
        const newRepo = await GitHubService.createRepository(account.accessToken, newRepoName, isPrivate);
        setRepos([newRepo, ...repos]);
        setSelectedRepo(newRepo.name);
        setIsCreatingRepo(false);
        setNewRepoName('');
        showToast("Repository created successfully", "success");
      }
    } catch (error) {
      console.error("Failed to create repo", error);
      showToast("Failed to create repository", "error");
    } finally {
      setLoading(false);
    }
  };

  const handlePush = async () => {
    if (!selectedAccount || !selectedRepo || !project) return;
    setSyncing(true);
    try {
      const account = accounts.find(a => a.id === selectedAccount);
      const repo = repos.find(r => r.name === selectedRepo);
      
      if (account && repo) {
        // Prepare files from project
        // Assuming project.codeFiles contains { name: string, content: string }
        const files = project.codeFiles.map((f: any) => ({
          path: f.name,
          content: f.content
        }));

        await GitHubService.pushToRepository(
          account.accessToken,
          account.username,
          repo.name,
          repo.default_branch || 'main',
          files,
          commitMessage
        );
        
        showToast("Successfully pushed to GitHub", "success");
        onClose();
      }
    } catch (error: any) {
      console.error("Push failed", error);
      showToast(`Push failed: ${error.message}`, "error");
    } finally {
      setSyncing(false);
    }
  };

  const handlePull = async () => {
    if (!selectedAccount || !selectedRepo || !project) return;
    setSyncing(true);
    try {
      const account = accounts.find(a => a.id === selectedAccount);
      const repo = repos.find(r => r.name === selectedRepo);
      
      if (account && repo) {
        const files = await GitHubService.pullFromRepository(
          account.accessToken,
          account.username,
          repo.name,
          repo.default_branch || 'main'
        );
        
        // Update project files
        const updatedProject = { ...project };
        if (!updatedProject.codeFiles) updatedProject.codeFiles = [];
        
        // Create a map for faster lookup
        const fileMap = new Map(updatedProject.codeFiles.map((f: any) => [f.name, f]));
        
        files.forEach(f => {
          fileMap.set(f.path, { name: f.path, content: f.content, type: 'file' });
        });
        
        updatedProject.codeFiles = Array.from(fileMap.values());
        
        if (onProjectUpdate) {
          await onProjectUpdate(updatedProject);
        }
        
        showToast(`Successfully pulled ${files.length} files from GitHub`, "success");
        onClose();
      }
    } catch (error: any) {
      console.error("Pull failed", error);
      showToast(`Pull failed: ${error.message}`, "error");
    } finally {
      setSyncing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md p-6 shadow-2xl space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Github className="text-white" size={24} />
            <h2 className="text-xl font-bold text-white">GitHub Sync</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <AlertTriangle size={20} className="rotate-45" /> {/* Using AlertTriangle as X icon replacement if X not imported, but X is imported in Chat.tsx, let's just use text or X if available. Wait, I imported X? No. I'll use a simple close button */}
             ✕
          </button>
        </div>

        {accounts.length === 0 ? (
          <div className="text-center py-8 space-y-4">
            <p className="text-zinc-400">No GitHub accounts connected.</p>
            <Button onClick={() => {
              onClose();
              // Navigate to settings? Or just open auth here?
              // Let's open auth here for convenience
               GitHubService.connectAccount().then(() => loadAccounts());
            }}>
              <Plus size={16} /> Connect Account
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Account Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase">Account</label>
              <select 
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-orange-500 outline-none"
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.username}</option>
                ))}
              </select>
            </div>

            {/* Repo Selection */}
            {!isCreatingRepo ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-zinc-400 uppercase">Repository</label>
                  <button 
                    onClick={() => setIsCreatingRepo(true)}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <Plus size={12} /> New Repo
                  </button>
                </div>
                <select 
                  value={selectedRepo}
                  onChange={(e) => setSelectedRepo(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-orange-500 outline-none"
                  disabled={loading}
                >
                  <option value="">Select a repository...</option>
                  {repos.map(repo => (
                    <option key={repo.id} value={repo.name}>{repo.name} {repo.private ? '(Private)' : ''}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-3 p-3 bg-zinc-950/50 rounded-lg border border-zinc-800">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-white">Create Repository</h4>
                  <button onClick={() => setIsCreatingRepo(false)} className="text-xs text-zinc-500 hover:text-white">Cancel</button>
                </div>
                <input 
                  type="text"
                  value={newRepoName}
                  onChange={(e) => setNewRepoName(e.target.value)}
                  placeholder="Repository Name"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox"
                    id="private-repo"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-900 text-blue-500"
                  />
                  <label htmlFor="private-repo" className="text-sm text-zinc-400">Private Repository</label>
                </div>
                <Button onClick={handleCreateRepo} disabled={!newRepoName || loading} className="w-full py-1 text-sm">
                  {loading ? 'Creating...' : 'Create & Select'}
                </Button>
              </div>
            )}

            {/* Action */}
            <div className="pt-4 border-t border-zinc-800 space-y-4">
              <div className="flex gap-2 bg-zinc-950 p-1 rounded-lg">
                <button 
                  onClick={() => setMode('push')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'push' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <UploadCloud size={16} /> Push
                </button>
                <button 
                  onClick={() => setMode('pull')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'pull' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <DownloadCloud size={16} /> Pull
                </button>
              </div>

              {mode === 'push' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase">Commit Message</label>
                  <input 
                    type="text"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                  <Button 
                    onClick={handlePush} 
                    disabled={syncing || !selectedRepo} 
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    {syncing ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" /> Pushing...
                      </>
                    ) : (
                      <>
                        <UploadCloud size={16} /> Push to GitHub
                      </>
                    )}
                  </Button>
                </div>
              )}

              {mode === 'pull' && (
                <div className="space-y-4">
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex gap-3">
                    <AlertTriangle className="text-yellow-500 shrink-0" size={20} />
                    <div className="text-sm text-yellow-200">
                      <p className="font-bold mb-1">Warning: Overwrite</p>
                      <p>Pulling will overwrite local files with the same name. Unsaved changes might be lost.</p>
                    </div>
                  </div>
                  <Button 
                    onClick={handlePull} 
                    disabled={syncing || !selectedRepo} 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {syncing ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" /> Pulling...
                      </>
                    ) : (
                      <>
                        <DownloadCloud size={16} /> Pull from GitHub
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
