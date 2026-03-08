import axios from 'axios';
import { db, auth } from './firebase';
import { doc, setDoc, getDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';

export interface GitHubAccount {
  id: string; // GitHub User ID
  username: string;
  avatarUrl: string;
  accessToken: string;
  connectedAt: number;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  default_branch: string;
}

const GITHUB_API_BASE = 'https://api.github.com';

export const GitHubService = {
  /**
   * Initiates the OAuth flow by opening a popup
   */
  connectAccount: (): Promise<GitHubAccount> => {
    return new Promise((resolve, reject) => {
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      // We need to fetch the auth URL from our backend to keep secrets safe
      // But for the popup to work immediately, we might need the URL ready.
      // Let's assume the backend endpoint redirects.
      
      const popup = window.open(
        '/api/auth/github',
        'Github Auth',
        `width=${width},height=${height},top=${top},left=${left}`
      );

      if (!popup) {
        reject(new Error('Popup blocked'));
        return;
      }

      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'GITHUB_AUTH_SUCCESS') {
          window.removeEventListener('message', handleMessage);
          popup.close();
          
          const { accessToken, profile } = event.data.payload;
          
          const account: GitHubAccount = {
            id: profile.id.toString(),
            username: profile.login,
            avatarUrl: profile.avatar_url,
            accessToken: accessToken,
            connectedAt: Date.now()
          };

          // Save to Firestore
          if (auth.currentUser) {
            await setDoc(doc(db, 'users', auth.currentUser.uid, 'github_accounts', account.id), account);
          }
          
          resolve(account);
        } else if (event.data.type === 'GITHUB_AUTH_ERROR') {
          window.removeEventListener('message', handleMessage);
          popup.close();
          reject(new Error(event.data.error));
        }
      };

      window.addEventListener('message', handleMessage);
    });
  },

  getConnectedAccounts: async (): Promise<GitHubAccount[]> => {
    if (!auth.currentUser) return [];
    const snapshot = await getDocs(collection(db, 'users', auth.currentUser.uid, 'github_accounts'));
    return snapshot.docs.map(doc => doc.data() as GitHubAccount);
  },

  disconnectAccount: async (accountId: string) => {
    if (!auth.currentUser) return;
    await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'github_accounts', accountId));
  },

  getRepositories: async (token: string): Promise<GitHubRepo[]> => {
    const response = await axios.get(`${GITHUB_API_BASE}/user/repos?sort=updated&per_page=100`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  createRepository: async (token: string, name: string, isPrivate: boolean): Promise<GitHubRepo> => {
    const response = await axios.post(
      `${GITHUB_API_BASE}/user/repos`,
      { name, private: isPrivate, auto_init: true },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  },

  /**
   * Syncs files to GitHub using the Git Data API (Tree/Commit)
   */
  pushToRepository: async (
    token: string, 
    owner: string, 
    repo: string, 
    branch: string, 
    files: { path: string, content: string }[], 
    message: string
  ) => {
    const headers = { Authorization: `Bearer ${token}` };
    const repoUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}`;

    // 1. Get reference to HEAD
    const refRes = await axios.get(`${repoUrl}/git/ref/heads/${branch}`, { headers });
    const latestCommitSha = refRes.data.object.sha;

    // 2. Get the commit to get the tree
    const commitRes = await axios.get(`${repoUrl}/git/commits/${latestCommitSha}`, { headers });
    const baseTreeSha = commitRes.data.tree.sha;

    // 3. Create blobs for each file
    const treeItems = [];
    for (const file of files) {
      const blobRes = await axios.post(`${repoUrl}/git/blobs`, {
        content: file.content,
        encoding: 'utf-8'
      }, { headers });
      
      treeItems.push({
        path: file.path,
        mode: '100644', // file mode
        type: 'blob',
        sha: blobRes.data.sha
      });
    }

    // 4. Create a new tree
    const treeRes = await axios.post(`${repoUrl}/git/trees`, {
      base_tree: baseTreeSha,
      tree: treeItems
    }, { headers });
    const newTreeSha = treeRes.data.sha;

    // 5. Create a new commit
    const newCommitRes = await axios.post(`${repoUrl}/git/commits`, {
      message: message,
      tree: newTreeSha,
      parents: [latestCommitSha]
    }, { headers });
    const newCommitSha = newCommitRes.data.sha;

    // 6. Update the reference
    await axios.patch(`${repoUrl}/git/refs/heads/${branch}`, {
      sha: newCommitSha
    }, { headers });

    return newCommitSha;
  },

  /**
   * Pulls files from GitHub repository
   */
  pullFromRepository: async (
    token: string,
    owner: string,
    repo: string,
    branch: string
  ): Promise<{ path: string, content: string }[]> => {
    const headers = { Authorization: `Bearer ${token}` };
    const repoUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}`;

    // 1. Get reference to HEAD
    const refRes = await axios.get(`${repoUrl}/git/ref/heads/${branch}`, { headers });
    const latestCommitSha = refRes.data.object.sha;

    // 2. Get the commit to get the tree
    const commitRes = await axios.get(`${repoUrl}/git/commits/${latestCommitSha}`, { headers });
    const treeSha = commitRes.data.tree.sha;

    // 3. Get the tree recursively
    const treeRes = await axios.get(`${repoUrl}/git/trees/${treeSha}?recursive=1`, { headers });
    const tree = treeRes.data.tree;

    // 4. Fetch blobs (files)
    const files: { path: string, content: string }[] = [];
    
    // Filter for blobs (files) only, ignore subtrees (directories)
    const blobs = tree.filter((item: any) => item.type === 'blob');

    // Limit to avoid fetching too many files if repo is huge
    // For now, let's fetch up to 50 files to be safe, or maybe just fetch them.
    // We should probably fetch them in parallel but with a limit.
    
    for (const blob of blobs) {
      // Skip images or binary files if possible, or handle them.
      // For now, let's try to fetch content.
      // We can use the raw content URL or the blob API.
      // Blob API returns base64 or utf-8.
      
      try {
        const blobRes = await axios.get(blob.url, { headers });
        const base64Content = blobRes.data.content.replace(/\n/g, '');
        const binaryString = atob(base64Content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const content = new TextDecoder().decode(bytes);
        files.push({ path: blob.path, content });
      } catch (err) {
        console.warn(`Failed to fetch ${blob.path}`, err);
      }
    }

    return files;
  }
};
