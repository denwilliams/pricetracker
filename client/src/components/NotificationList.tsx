import { useState, useEffect } from 'react'
import { Bell, TrendingDown, Target, Package, Trash2, RefreshCw, Send } from 'lucide-react'

interface Notification {
  id: number
  productId: number
  productName: string
  type: 'price_drop' | 'target_reached' | 'back_in_stock'
  message: string
  sent: boolean
  sentAt?: string
  createdAt: string
}

interface NotificationStats {
  total: number
  sent: number
  pending: number
  byType: Record<string, number>
}

export function NotificationList() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [stats, setStats] = useState<NotificationStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'sent'>('all')
  const [error, setError] = useState<string | null>(null)

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const sentParam = filter === 'all' ? '' : `?sent=${filter === 'sent'}`
      const response = await fetch(`/api/notifications${sentParam}`)
      const data = await response.json()
      
      if (data.success) {
        setNotifications(data.notifications)
        setError(null)
      } else {
        setError(data.error || 'Failed to load notifications')
      }
    } catch (err) {
      setError('Failed to connect to API')
      console.error('Error fetching notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/notifications/stats')
      const data = await response.json()
      
      if (data.success) {
        setStats(data.stats)
      }
    } catch (err) {
      console.error('Error fetching notification stats:', err)
    }
  }

  const deleteNotification = async (id: number) => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        await fetchNotifications()
        await fetchStats()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to delete notification')
      }
    } catch (err) {
      alert('Failed to delete notification')
      console.error('Error deleting notification:', err)
    }
  }

  const sendTestNotification = async () => {
    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST'
      })
      
      const data = await response.json()
      if (data.success) {
        alert(data.message)
      } else {
        alert(data.error || 'Failed to send test notification')
      }
    } catch (err) {
      alert('Failed to send test notification')
      console.error('Error sending test notification:', err)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'price_drop':
        return <TrendingDown size={16} className="notification-icon price-drop" />
      case 'target_reached':
        return <Target size={16} className="notification-icon target-reached" />
      case 'back_in_stock':
        return <Package size={16} className="notification-icon back-in-stock" />
      default:
        return <Bell size={16} className="notification-icon default" />
    }
  }

  const getNotificationTitle = (type: string) => {
    switch (type) {
      case 'price_drop':
        return 'Price Drop'
      case 'target_reached':
        return 'Target Reached'
      case 'back_in_stock':
        return 'Stock Alert'
      default:
        return 'Notification'
    }
  }

  useEffect(() => {
    fetchNotifications()
    fetchStats()
  }, [filter])

  if (loading) {
    return <div className="loading">Loading notifications...</div>
  }

  if (error) {
    return (
      <div className="error">
        <p>Error: {error}</p>
        <button onClick={fetchNotifications} className="retry-button">
          <RefreshCw size={16} />
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="notification-list">
      <div className="list-header">
        <h2>Notifications</h2>
        <div className="header-actions">
          <button onClick={sendTestNotification} className="test-button">
            <Send size={16} />
            Test Notification
          </button>
          <button onClick={() => { fetchNotifications(); fetchStats(); }} className="refresh-button">
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {stats && (
        <div className="notification-stats">
          <div className="stat-item">
            <span className="stat-label">Total:</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Sent:</span>
            <span className="stat-value sent">{stats.sent}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Pending:</span>
            <span className="stat-value pending">{stats.pending}</span>
          </div>
        </div>
      )}

      <div className="filter-tabs">
        <button
          className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          className={`filter-tab ${filter === 'pending' ? 'active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          Pending
        </button>
        <button
          className={`filter-tab ${filter === 'sent' ? 'active' : ''}`}
          onClick={() => setFilter('sent')}
        >
          Sent
        </button>
      </div>

      {notifications.length === 0 ? (
        <div className="empty-state">
          <Bell size={48} className="empty-icon" />
          <p>No notifications yet.</p>
          <p>Notifications will appear when prices drop or targets are reached.</p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map((notification) => (
            <div key={notification.id} className={`notification-card ${notification.sent ? 'sent' : 'pending'}`}>
              <div className="notification-header">
                <div className="notification-type">
                  {getNotificationIcon(notification.type)}
                  <span className="type-label">{getNotificationTitle(notification.type)}</span>
                </div>
                <div className="notification-actions">
                  <button
                    onClick={() => deleteNotification(notification.id)}
                    className="action-button delete"
                    title="Delete notification"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="notification-content">
                <div className="product-name">{notification.productName}</div>
                <div className="notification-message">{notification.message}</div>
              </div>

              <div className="notification-footer">
                <div className="notification-time">
                  <span>Created: {new Date(notification.createdAt).toLocaleString()}</span>
                  {notification.sent && notification.sentAt && (
                    <span>Sent: {new Date(notification.sentAt).toLocaleString()}</span>
                  )}
                </div>
                <div className={`notification-status ${notification.sent ? 'sent' : 'pending'}`}>
                  {notification.sent ? '✓ Sent' : '⏳ Pending'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}