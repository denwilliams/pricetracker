import { useState, useEffect } from 'react'
import { Activity, Database, Clock, Zap, Play, Square, RefreshCw } from 'lucide-react'

interface SystemStats {
  products: {
    total: number
    active: number
    inactive: number
  }
  priceHistory: {
    total: number
  }
  notifications: {
    total: number
    sent: number
    pending: number
    byType: Record<string, number>
  }
  jobs: {
    running: number
    total: number
    jobs: Array<{ name: string; running: boolean }>
  }
  system: {
    uptime: number
    memory: {
      rss: number
      heapUsed: number
      heapTotal: number
      external: number
    }
    nodeVersion: string
    timestamp: string
  }
}

export function SystemStats() {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/system/stats')
      const data = await response.json()
      
      if (data.success) {
        setStats(data.stats)
        setError(null)
      } else {
        setError(data.error || 'Failed to load system stats')
      }
    } catch (err) {
      setError('Failed to connect to API')
      console.error('Error fetching system stats:', err)
    } finally {
      setLoading(false)
    }
  }

  const controlScheduler = async (action: 'start' | 'stop') => {
    try {
      const response = await fetch(`/api/system/scheduler/${action}`, {
        method: 'POST'
      })
      
      const data = await response.json()
      if (data.success) {
        alert(data.message)
        await fetchStats()
      } else {
        alert(data.error || `Failed to ${action} scheduler`)
      }
    } catch (err) {
      alert(`Failed to ${action} scheduler`)
      console.error(`Error ${action}ing scheduler:`, err)
    }
  }

  const triggerPriceCheck = async () => {
    try {
      const response = await fetch('/api/system/check-all-prices', {
        method: 'POST'
      })
      
      const data = await response.json()
      if (data.success) {
        alert(data.message)
      } else {
        alert(data.error || 'Failed to trigger price check')
      }
    } catch (err) {
      alert('Failed to trigger price check')
      console.error('Error triggering price check:', err)
    }
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else {
      return `${minutes}m`
    }
  }

  const formatMemory = (bytes: number) => {
    const mb = bytes / 1024 / 1024
    return `${mb.toFixed(1)} MB`
  }

  useEffect(() => {
    fetchStats()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return <div className="loading">Loading system stats...</div>
  }

  if (error || !stats) {
    return (
      <div className="error">
        <p>Error: {error}</p>
        <button onClick={fetchStats} className="retry-button">
          <RefreshCw size={16} />
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="system-stats">
      <div className="stats-header">
        <h2>System Statistics</h2>
        <div className="header-actions">
          <button onClick={triggerPriceCheck} className="trigger-button">
            <Zap size={16} />
            Check All Prices
          </button>
          <button onClick={fetchStats} className="refresh-button">
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      <div className="stats-grid">
        {/* Products Stats */}
        <div className="stat-card">
          <div className="stat-header">
            <Database size={20} />
            <h3>Products</h3>
          </div>
          <div className="stat-content">
            <div className="stat-item large">
              <span className="stat-value">{stats.products.total}</span>
              <span className="stat-label">Total Products</span>
            </div>
            <div className="stat-row">
              <div className="stat-item">
                <span className="stat-value active">{stats.products.active}</span>
                <span className="stat-label">Active</span>
              </div>
              <div className="stat-item">
                <span className="stat-value inactive">{stats.products.inactive}</span>
                <span className="stat-label">Inactive</span>
              </div>
            </div>
          </div>
        </div>

        {/* Price History Stats */}
        <div className="stat-card">
          <div className="stat-header">
            <Activity size={20} />
            <h3>Price History</h3>
          </div>
          <div className="stat-content">
            <div className="stat-item large">
              <span className="stat-value">{stats.priceHistory.total}</span>
              <span className="stat-label">Total Records</span>
            </div>
          </div>
        </div>

        {/* Notifications Stats */}
        <div className="stat-card">
          <div className="stat-header">
            <RefreshCw size={20} />
            <h3>Notifications</h3>
          </div>
          <div className="stat-content">
            <div className="stat-item large">
              <span className="stat-value">{stats.notifications.total}</span>
              <span className="stat-label">Total Notifications</span>
            </div>
            <div className="stat-row">
              <div className="stat-item">
                <span className="stat-value sent">{stats.notifications.sent}</span>
                <span className="stat-label">Sent</span>
              </div>
              <div className="stat-item">
                <span className="stat-value pending">{stats.notifications.pending}</span>
                <span className="stat-label">Pending</span>
              </div>
            </div>
            {Object.keys(stats.notifications.byType).length > 0 && (
              <div className="notification-types">
                <h4>By Type:</h4>
                {Object.entries(stats.notifications.byType).map(([type, count]) => (
                  <div key={type} className="type-stat">
                    <span className="type-name">{type.replace('_', ' ')}</span>
                    <span className="type-count">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Jobs Stats */}
        <div className="stat-card">
          <div className="stat-header">
            <Clock size={20} />
            <h3>Scheduled Jobs</h3>
          </div>
          <div className="stat-content">
            <div className="stat-row">
              <div className="stat-item">
                <span className="stat-value running">{stats.jobs.running}</span>
                <span className="stat-label">Running</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.jobs.total}</span>
                <span className="stat-label">Total</span>
              </div>
            </div>
            <div className="jobs-list">
              {stats.jobs.jobs.map((job) => (
                <div key={job.name} className={`job-item ${job.running ? 'running' : 'stopped'}`}>
                  <span className="job-name">{job.name}</span>
                  <span className="job-status">
                    {job.running ? (
                      <><Play size={12} /> Running</>
                    ) : (
                      <><Square size={12} /> Stopped</>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <div className="scheduler-controls">
              <button
                onClick={() => controlScheduler('start')}
                className="control-button start"
                disabled={stats.jobs.running === stats.jobs.total}
              >
                <Play size={14} />
                Start Scheduler
              </button>
              <button
                onClick={() => controlScheduler('stop')}
                className="control-button stop"
                disabled={stats.jobs.running === 0}
              >
                <Square size={14} />
                Stop Scheduler
              </button>
            </div>
          </div>
        </div>

        {/* System Info */}
        <div className="stat-card system-info">
          <div className="stat-header">
            <Activity size={20} />
            <h3>System Info</h3>
          </div>
          <div className="stat-content">
            <div className="info-row">
              <span className="info-label">Uptime:</span>
              <span className="info-value">{formatUptime(stats.system.uptime)}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Node.js:</span>
              <span className="info-value">{stats.system.nodeVersion}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Memory Used:</span>
              <span className="info-value">{formatMemory(stats.system.memory.heapUsed)}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Memory Total:</span>
              <span className="info-value">{formatMemory(stats.system.memory.heapTotal)}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Last Updated:</span>
              <span className="info-value">
                {new Date(stats.system.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}