import { useState, useEffect } from 'react'
import { Trash2, RefreshCw, TrendingDown, TrendingUp, Calendar, ExternalLink, BarChart3, Edit3 } from 'lucide-react'
import { PriceChart } from './PriceChart'

interface Product {
  id: number
  name: string
  url: string
  store: string
  currentPrice?: string
  targetPrice?: string
  isActive: boolean
  lastChecked?: string
  createdAt: string
  updatedAt: string
}

export function ProductList() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [editingProduct, setEditingProduct] = useState<{id: number, targetPrice: string} | null>(null)

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/products')
      const data = await response.json()
      
      if (data.success) {
        setProducts(data.products)
        setError(null)
      } else {
        setError(data.error || 'Failed to load products')
      }
    } catch (err) {
      setError('Failed to connect to API')
      console.error('Error fetching products:', err)
    } finally {
      setLoading(false)
    }
  }

  const deleteProduct = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product?')) return
    
    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        await fetchProducts()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to delete product')
      }
    } catch (err) {
      alert('Failed to delete product')
      console.error('Error deleting product:', err)
    }
  }

  const checkPrice = async (id: number) => {
    try {
      const response = await fetch(`/api/products/${id}/check-price`, {
        method: 'POST'
      })
      
      if (response.ok) {
        await fetchProducts()
        alert('Price check completed!')
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to check price')
      }
    } catch (err) {
      alert('Failed to check price')
      console.error('Error checking price:', err)
    }
  }

  const toggleActive = async (id: number, isActive: boolean) => {
    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive: !isActive })
      })
      
      if (response.ok) {
        await fetchProducts()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to update product')
      }
    } catch (err) {
      alert('Failed to update product')
      console.error('Error updating product:', err)
    }
  }

  const updateTargetPrice = async (id: number, targetPrice: number | null) => {
    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ targetPrice })
      })
      
      if (response.ok) {
        await fetchProducts()
        setEditingProduct(null)
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to update target price')
      }
    } catch (err) {
      alert('Failed to update target price')
      console.error('Error updating target price:', err)
    }
  }

  const startEditing = (id: number, currentTargetPrice?: string) => {
    setEditingProduct({
      id,
      targetPrice: currentTargetPrice || ''
    })
  }

  const cancelEditing = () => {
    setEditingProduct(null)
  }

  const saveTargetPrice = () => {
    if (!editingProduct) return
    
    const price = editingProduct.targetPrice.trim()
    const numericPrice = price === '' ? null : parseFloat(price)
    
    if (price !== '' && (isNaN(numericPrice!) || numericPrice! <= 0)) {
      alert('Please enter a valid price greater than 0')
      return
    }
    
    updateTargetPrice(editingProduct.id, numericPrice)
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center space-x-3 text-gray-600">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading products...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800 mb-4">Error: {error}</p>
            <button onClick={fetchProducts} className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg border bg-primary-600 text-white border-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors">
              <RefreshCw size={16} />
              <span>Retry</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Tracked Products</h2>
          <p className="text-sm text-gray-600 mt-1">{products.length} products being monitored</p>
        </div>
        <button onClick={fetchProducts} className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg border bg-white text-gray-700 border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors">
          <RefreshCw size={16} />
          <span>Refresh</span>
        </button>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-12">
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-200">
              <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No products tracked yet</h3>
              <p className="text-gray-600 mb-4">Add your first product to start monitoring prices across different stores.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div key={product.id} className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 ${!product.isActive ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 line-clamp-2 flex-1" title={product.name}>
                  {product.name}
                </h3>
                <div className="flex items-center space-x-1 ml-3">
                  <button
                    onClick={() => setSelectedProductId(product.id)}
                    className="p-1.5 text-gray-400 hover:text-primary-600 rounded-md hover:bg-gray-100 transition-colors"
                    title="View price history"
                  >
                    <BarChart3 size={16} />
                  </button>
                  <button
                    onClick={() => startEditing(product.id, product.targetPrice)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 rounded-md hover:bg-gray-100 transition-colors"
                    title="Edit target price"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => checkPrice(product.id)}
                    className="p-1.5 text-gray-400 hover:text-green-600 rounded-md hover:bg-gray-100 transition-colors"
                    title="Check price now"
                  >
                    <RefreshCw size={16} />
                  </button>
                  <button
                    onClick={() => toggleActive(product.id, product.isActive)}
                    className={`p-1.5 rounded-md hover:bg-gray-100 transition-colors ${
                      product.isActive ? 'text-orange-500 hover:text-orange-600' : 'text-gray-400 hover:text-green-600'
                    }`}
                    title={product.isActive ? 'Pause tracking' : 'Resume tracking'}
                  >
                    {product.isActive ? '⏸️' : '▶️'}
                  </button>
                  <button
                    onClick={() => deleteProduct(product.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-gray-100 transition-colors"
                    title="Delete product"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-2 mb-4">
                <span className="text-sm font-medium text-gray-600">{product.store}</span>
                <a 
                  href={product.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <ExternalLink size={12} />
                </a>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Current Price:</span>
                  <span className="text-lg font-semibold text-gray-900">
                    {product.currentPrice ? `$${product.currentPrice}` : 'Unknown'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Target Price:</span>
                  {editingProduct?.id === product.id ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editingProduct.targetPrice}
                        onChange={(e) => setEditingProduct({...editingProduct, targetPrice: e.target.value})}
                        onKeyPress={(e) => e.key === 'Enter' && saveTargetPrice()}
                        className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="0.00"
                        autoFocus
                      />
                      <button onClick={saveTargetPrice} className="p-1 text-green-600 hover:bg-green-50 rounded">
                        ✓
                      </button>
                      <button onClick={cancelEditing} className="p-1 text-red-600 hover:bg-red-50 rounded">
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className="text-lg font-semibold text-gray-900">
                        {product.targetPrice ? `$${product.targetPrice}` : 'Not set'}
                      </span>
                      {product.targetPrice && product.currentPrice && (
                        <div className={`flex items-center ${
                          parseFloat(product.currentPrice) <= parseFloat(product.targetPrice) 
                            ? 'text-green-600' 
                            : 'text-orange-600'
                        }`}>
                          {parseFloat(product.currentPrice) <= parseFloat(product.targetPrice) ? (
                            <TrendingDown size={16} />
                          ) : (
                            <TrendingUp size={16} />
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {product.targetPrice && product.currentPrice && parseFloat(product.currentPrice) <= parseFloat(product.targetPrice) && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-green-800 font-medium">🎉 Target price reached!</p>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center text-xs text-gray-500">
                  <Calendar size={12} className="mr-1" />
                  {product.lastChecked ? (
                    <span>Last checked: {new Date(product.lastChecked).toLocaleDateString()}</span>
                  ) : (
                    <span>Never checked</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Price Chart Modal */}
      {selectedProductId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedProductId(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <PriceChart 
              productId={selectedProductId} 
              targetPrice={products.find(p => p.id === selectedProductId)?.targetPrice}
              onClose={() => setSelectedProductId(null)} 
            />
          </div>
        </div>
      )}
    </div>
  )
}