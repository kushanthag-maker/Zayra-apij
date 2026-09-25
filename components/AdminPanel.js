'use client';

import { useState, useEffect } from 'react';
import styles from '@/styles/admin.module.css';

export default function AdminPanel({ token, onLogout }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <nav className={styles.navbar}>
        <h1>🛡️ ZAYRA API - Admin Panel</h1>
        <button onClick={onLogout} className={styles.logoutBtn}>Logout</button>
      </nav>

      <div className={styles.content}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'overview' ? styles.active : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📊 Overview
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'users' ? styles.active : ''}`}
            onClick={() => setActiveTab('users')}
          >
            👥 Users
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'analytics' ? styles.active : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            📈 Analytics
          </button>
        </div>

        {loading ? (
          <div className={styles.loading}>Loading...</div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div className={styles.panel}>
                <h2>System Overview</h2>
                <div className={styles.stats}>
                  <div className={styles.statCard}>
                    <h3>👥 Total Users</h3>
                    <p className={styles.number}>{stats?.stats?.totalUsers}</p>
                  </div>
                  <div className={styles.statCard}>
                    <h3>📡 Total Requests</h3>
                    <p className={styles.number}>{stats?.stats?.totalRequests}</p>
                  </div>
                  <div className={styles.statCard}>
                    <h3>💳 Credits Used</h3>
                    <p className={styles.number}>{stats?.stats?.totalCreditsUsed}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div className={styles.panel}>
                <h2>Top Users</h2>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Credits</th>
                      <th>Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats?.topUsers?.map((user) => (
                      <tr key={user._id}>
                        <td>{user.username}</td>
                        <td>{user.credits}</td>
                        <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className={styles.panel}>
                <h2>Recent API Requests</h2>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Endpoint</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th>Time (ms)</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats?.recentRequests?.map((req, idx) => (
                      <tr key={idx}>
                        <td>{req.endpoint}</td>
                        <td>{req.method}</td>
                        <td>{req.statusCode}</td>
                        <td>{req.responseTime}</td>
                        <td>{new Date(req.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
