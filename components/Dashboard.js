'use client';

import { useState } from 'react';
import styles from '@/styles/dashboard.module.css';

export default function Dashboard({ token, user, onLogout }) {
  const [activeTab, setActiveTab] = useState('facebook');
  const [url, setUrl] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [credits, setCredits] = useState(user?.credits || 0);

  const handleDownload = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/download/facebook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.data);
        setCredits(data.creditsRemaining);
      } else {
        setError(data.message || 'Download failed');
      }
    } catch (err) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <nav className={styles.navbar}>
        <h1>ZAYRA API Dashboard</h1>
        <div className={styles.userInfo}>
          <span>User: {user?.username}</span>
          <span className={styles.credits}>💰 Credits: {credits}</span>
          <button onClick={onLogout} className={styles.logoutBtn}>Logout</button>
        </div>
      </nav>

      <div className={styles.content}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'facebook' ? styles.active : ''}`}
            onClick={() => setActiveTab('facebook')}
          >
            📥 Facebook Download
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'history' ? styles.active : ''}`}
            onClick={() => setActiveTab('history')}
          >
            📜 History
          </button>
        </div>

        {activeTab === 'facebook' && (
          <div className={styles.panel}>
            <h2>Facebook Video Downloader</h2>
            <form onSubmit={handleDownload}>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.facebook.com/watch/?v=..."
                required
              />
              <button type="submit" disabled={loading} className={styles.submitBtn}>
                {loading ? '⏳ Processing...' : '⬇️ Download Video'}
              </button>
            </form>

            {error && <div className={styles.error}>{error}</div>}

            {result && (
              <div className={styles.result}>
                <h3>{result.title}</h3>
                {result.thumbnail && <img src={result.thumbnail} alt="thumbnail" />}
                <p>{result.description}</p>
                <p><strong>Duration:</strong> {result.duration}s</p>
                <div className={styles.downloads}>
                  {result.video && (
                    <a href={result.video} download className={styles.dlBtn}>📹 Download Video</a>
                  )}
                  {result.audio && (
                    <a href={result.audio} download className={styles.dlBtn}>🔊 Download Audio</a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className={styles.panel}>
            <h2>Request History</h2>
            <p>Coming soon...</p>
          </div>
        )}
      </div>
    </div>
  );
}
