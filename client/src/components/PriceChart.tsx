import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react'

interface PricePoint {
  id: number
  productId: number
  price: string
  currency: string
  scrapedAt: string
  isAvailable: boolean
}

interface PriceChartProps {
  productId: number
  targetPrice?: string
  onClose?: () => void
}

export function PriceChart({ productId, targetPrice, onClose }: PriceChartProps) {
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d')

  const fetchPriceHistory = async () => {
    try {
      setLoading(true)
      const limit = timeRange === '7d' ? 168 : timeRange === '30d' ? 720 : timeRange === '90d' ? 2160 : 1000
      const response = await fetch(`/api/products/${productId}/history?limit=${limit}`)
      const data = await response.json()
      
      if (data.success) {
        setPriceHistory(data.history)
        setError(null)
      } else {
        setError(data.error || 'Failed to load price history')
      }
    } catch (err) {
      setError('Failed to connect to API')
      console.error('Error fetching price history:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatChartData = () => {
    return priceHistory
      .map(point => ({
        date: new Date(point.scrapedAt).toLocaleDateString(),
        time: new Date(point.scrapedAt).toLocaleString(),
        price: parseFloat(point.price),
        available: point.isAvailable
      }))
      .reverse() // Show oldest to newest
  }

  const getStats = () => {
    if (priceHistory.length === 0) return null
    
    const prices = priceHistory.map(p => parseFloat(p.price))
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const currentPrice = prices[0] // First item is most recent
    const previousPrice = prices[1]
    
    const trend = previousPrice && currentPrice !== previousPrice
      ? currentPrice > previousPrice ? 'up' : 'down'
      : 'stable'
    
    return {
      minPrice,
      maxPrice,
      currentPrice,
      trend,
      dataPoints: priceHistory.length
    }
  }

  const stats = getStats()
  const chartData = formatChartData()

  useEffect(() => {
    fetchPriceHistory()
  }, [productId, timeRange])

  if (loading) {
    return (
      <div className="price-chart-container">
        <div className="chart-header">
          <h3>Price History</h3>
          {onClose && (
            <button onClick={onClose} className="close-button">×</button>
          )}
        </div>
        <div className="loading">Loading price history...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="price-chart-container">
        <div className="chart-header">
          <h3>Price History</h3>
          {onClose && (
            <button onClick={onClose} className="close-button">×</button>
          )}
        </div>
        <div className="error">
          <p>Error: {error}</p>
        </div>
      </div>
    )
  }

  if (priceHistory.length === 0) {
    return (
      <div className="price-chart-container">
        <div className="chart-header">
          <h3>Price History</h3>
          {onClose && (
            <button onClick={onClose} className="close-button">×</button>
          )}
        </div>
        <div className="empty-state">
          <Calendar size={48} className="empty-icon" />
          <p>No price history available yet.</p>
          <p>Price data will appear after the first check.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="price-chart-container">
      <div className="chart-header">
        <h3>Price History</h3>
        <div className="header-controls">
          <div className="time-range-selector">
            <button
              className={`range-button ${timeRange === '7d' ? 'active' : ''}`}
              onClick={() => setTimeRange('7d')}
            >
              7D
            </button>
            <button
              className={`range-button ${timeRange === '30d' ? 'active' : ''}`}
              onClick={() => setTimeRange('30d')}
            >
              30D
            </button>
            <button
              className={`range-button ${timeRange === '90d' ? 'active' : ''}`}
              onClick={() => setTimeRange('90d')}
            >
              90D
            </button>
            <button
              className={`range-button ${timeRange === 'all' ? 'active' : ''}`}
              onClick={() => setTimeRange('all')}
            >
              ALL
            </button>
          </div>
          {onClose && (
            <button onClick={onClose} className="close-button">×</button>
          )}
        </div>
      </div>

      {stats && (
        <div className="price-stats">
          <div className="stat-item">
            <span className="stat-label">Current:</span>
            <span className={`stat-value current ${stats.trend}`}>
              ${stats.currentPrice.toFixed(2)}
              {stats.trend === 'up' && <TrendingUp size={14} />}
              {stats.trend === 'down' && <TrendingDown size={14} />}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Lowest:</span>
            <span className="stat-value lowest">${stats.minPrice.toFixed(2)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Highest:</span>
            <span className="stat-value highest">${stats.maxPrice.toFixed(2)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Data Points:</span>
            <span className="stat-value">{stats.dataPoints}</span>
          </div>
        </div>
      )}

      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              stroke="#666"
            />
            <YAxis 
              domain={['dataMin - 5', 'dataMax + 5']}
              tick={{ fontSize: 12 }}
              stroke="#666"
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip 
              formatter={(value: any, _name: string) => [`$${value.toFixed(2)}`, 'Price']}
              labelFormatter={(label, payload) => {
                if (payload && payload[0]) {
                  return payload[0].payload.time
                }
                return label
              }}
              contentStyle={{
                backgroundColor: '#f8f9fa',
                border: '1px solid #dee2e6',
                borderRadius: '4px'
              }}
            />
            
            {/* Target price reference line */}
            {targetPrice && (
              <ReferenceLine 
                y={parseFloat(targetPrice)} 
                stroke="#28a745" 
                strokeDasharray="5 5"
                label={{ value: `Target: $${targetPrice}`, position: 'right' }}
              />
            )}
            
            <Line 
              type="monotone" 
              dataKey="price" 
              stroke="#007bff" 
              strokeWidth={2}
              dot={{ fill: '#007bff', strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5, stroke: '#007bff', strokeWidth: 2 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-footer">
        <p className="data-note">
          Showing {timeRange === 'all' ? 'all available' : timeRange} price data. 
          Prices are checked automatically every 30 minutes.
        </p>
      </div>
    </div>
  )
}